import type { SupabaseClient } from "@supabase/supabase-js";
import { zTestTwoProp } from "@/lib/db";
import { fetchTrimmedViewEarnings } from "@/lib/billing/earnings";
import { classify, toInt, money, type MerchantRow, type PerfRow } from "@/lib/digest";

// Ready-to-bill agent.
//
// The daily digest already says which tests are significant. Nothing turned
// that into an invoice — that step was you noticing a green check in Slack and
// remembering to act. This closes the gap: it finds tests that have both
// crossed significance AND have real billable incremental after trimming, then
// drafts the client message with their own numbers in it.
//
// TWO DIFFERENT NUMBERS, ON PURPOSE:
//
//   Significance comes from the CVR z-test on 14 days of randomized traffic
//   (purchases / impressions, both arms). That answers "is this real".
//
//   Money comes from fetchTrimmedViewEarnings — outlier-trimmed RPV against a
//   running control, the same math computeInvoice will bill on. That answers
//   "what would we actually charge".
//
// They disagree more often than you'd think, and the disagreement is the whole
// point of the gate. A brand can be CVR-significant and still have ~zero
// trimmed incremental if its escaped revenue rode on one whale order that the
// trim removed. Pitching a performance plan off that number means the first
// invoice lands far below what you quoted. So a candidate must clear both.
//
// Nothing here sends anything to a client. It stages a draft and posts it to
// Slack for a second click, per the standing rule that agents draft and you
// send.

/** Below this the pitch isn't worth making yet — the first invoice would be
 *  mostly base fee and the rev share would read as noise. */
const MIN_MONTHLY_SHARE_CENTS = 25_000; // $250/mo of rev share

/** Re-surface a still-ready brand at most this often. */
const REPOST_AFTER_DAYS = 7;

export type AlertRow = {
  merchant_id: string;
  first_ready_at: string;
  last_posted_at: string;
  posts: number;
  dismissed_at: string | null;
};

export type GraduationCandidate = {
  merchantId: string;
  name: string;
  domain: string | null;
  shareToken: string | null;
  /** CVR lift from the randomized 14d test — the significance claim. */
  liftPct: number;
  z: number;
  ordersA: number;
  ordersB: number;
  visitors: number;
  /** Trimmed RPV lift — the billing claim. Null when there's no control. */
  trimmedLiftPct: number | null;
  incremental30dCents: number;
  shareCents: number;
  baseFeeCents: number;
  projectedMonthlyCents: number;
  revSharePct: number;
  daysTracked: number | null;
  /** null when never surfaced before. */
  firstReadyAt: string | null;
  posts: number;
  isNew: boolean;
  draft: string;
};

/** Significant and positive, but the trim ate the incremental. Not billable —
 *  surfaced separately so it reads as a finding rather than a silent drop. */
export type HeldBack = {
  name: string;
  liftPct: number;
  reason: string;
};

export type GraduationReport = {
  candidates: GraduationCandidate[];
  heldBack: HeldBack[];
  /** Ready brands suppressed because they were posted recently or dismissed. */
  suppressed: number;
};

function daysBetween(from: string, to: number): number {
  return Math.floor((to - new Date(from).getTime()) / 86_400_000);
}

/** The message you'd actually send. Plain prose, their numbers, no em-dashes,
 *  and it never promises a number the trimmed math doesn't support. */
export function draftPitch(c: {
  name: string;
  liftPct: number;
  ordersA: number;
  ordersB: number;
  shareCents: number;
  baseFeeCents: number;
  revSharePct: number;
  shareUrl: string | null;
}): string {
  const lift = `${c.liftPct >= 0 ? "+" : ""}${c.liftPct.toFixed(0)}%`;
  const orders = (c.ordersA + c.ordersB).toLocaleString("en-US");
  const lines = [
    `Hey, two weeks in and the test is conclusive, so here is where it landed.`,
    ``,
    `We split your Instagram traffic randomly. Half kept the in-app browser, half got escaped to Safari or Chrome. Same ads, same audience, same creative, so the only difference between the two groups is the browser they landed in.`,
    ``,
    `The escaped group converts ${lift} better than the control group. That is across ${orders} orders, which is enough traffic that this is not noise.`,
    ``,
    `On the plan we discussed that works out to roughly ${money(c.shareCents)} a month in performance fee, on top of the ${money(c.baseFeeCents)} platform fee. The performance side is ${c.revSharePct}% of the incremental revenue only, measured against the control group we keep running, so if a month is flat you pay nothing on that side.`,
  ];
  if (c.shareUrl) {
    lines.push(``, `Your live numbers are here, no login needed: ${c.shareUrl}`);
  }
  lines.push(
    ``,
    `Want me to switch you over at the start of next month? The control group stays on either way so you can keep checking the math.`,
  );
  return lines.join("\n");
}

export async function buildGraduationReport(
  sb: SupabaseClient,
  now: number,
  origin: string,
): Promise<GraduationReport> {
  const H = 3600_000;
  const since = new Date(now - 14 * 24 * H).toISOString();

  const [merchantsRes, perfRes, alertsRes] = await Promise.all([
    sb
      .from("merchants")
      .select(
        "id, name, domain, status, escape_enabled, ab_enabled, billing_status, billing_view_token, billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived, referrer_id, referral_share_pct, created_at",
      ),
    sb.rpc("eh_admin_brand_performance", { p_since: since }),
    sb.from("graduation_alerts").select("*"),
  ]);

  const merchants = (merchantsRes.data ?? []) as MerchantRow[];
  const perfById = new Map(((perfRes.data ?? []) as PerfRow[]).map((r) => [r.merchant_id, r]));
  const alerts = new Map(
    ((alertsRes.data ?? []) as AlertRow[]).map((a) => [a.merchant_id, a]),
  );

  // Same population the digest calls "in test": still on a randomized split,
  // not already on a performance plan.
  const inTest = merchants.filter(
    (m) =>
      m.billing_status !== "active" &&
      m.ab_enabled === true &&
      m.escape_enabled !== false &&
      m.status !== "pending",
  );

  const candidates: GraduationCandidate[] = [];
  const heldBack: HeldBack[] = [];
  let suppressed = 0;

  for (const m of inTest) {
    const row = perfById.get(m.id);
    if (!row) continue;
    if (classify(row) !== "ready") continue;

    const t = zTestTwoProp(
      toInt(row.purchases_a),
      toInt(row.impressions_a),
      toInt(row.purchases_b),
      toInt(row.impressions_b),
    );
    if (!t || t.liftRel == null) continue;
    const liftPct = t.liftRel * 100;
    const name = m.name ?? m.domain ?? "(unnamed)";

    // The billing-truth read. Heavier than the digest's estimate because it
    // pulls order rows to trim outliers, but this runs over a handful of ready
    // brands, not the whole portfolio.
    let trimmed;
    try {
      trimmed = await fetchTrimmedViewEarnings(sb, {
        id: m.id,
        rev_share_pct: Number(m.rev_share_pct),
      });
    } catch {
      heldBack.push({
        name,
        liftPct,
        reason: "billing read failed, could not confirm trimmed incremental",
      });
      continue;
    }

    const shareCents = trimmed.last30dShareCents;
    if (trimmed.last30dIncrementalCents <= 0) {
      heldBack.push({
        name,
        liftPct,
        reason:
          "CVR lift is significant but trimmed incremental revenue is zero. Outliers were carrying it, so any quoted fee would miss.",
      });
      continue;
    }
    if (shareCents < MIN_MONTHLY_SHARE_CENTS) {
      heldBack.push({
        name,
        liftPct,
        reason: `only ${money(shareCents)}/mo of rev share at ${m.rev_share_pct}%. Let it run for more volume before pitching.`,
      });
      continue;
    }

    const alert = alerts.get(m.id);
    if (alert?.dismissed_at) {
      suppressed++;
      continue;
    }
    if (alert && daysBetween(alert.last_posted_at, now) < REPOST_AFTER_DAYS) {
      suppressed++;
      continue;
    }

    const baseFeeCents = m.base_fee_waived ? 0 : m.base_fee_cents;
    const shareUrl = m.billing_view_token ? `${origin}/share/${m.billing_view_token}` : null;

    candidates.push({
      merchantId: m.id,
      name,
      domain: m.domain,
      shareToken: m.billing_view_token,
      liftPct,
      z: t.z,
      ordersA: toInt(row.purchases_a),
      ordersB: toInt(row.purchases_b),
      visitors: toInt(row.impressions_a) + toInt(row.impressions_b),
      trimmedLiftPct: trimmed.liftPct,
      incremental30dCents: trimmed.last30dIncrementalCents,
      shareCents,
      baseFeeCents,
      projectedMonthlyCents: shareCents + baseFeeCents,
      revSharePct: Number(m.rev_share_pct),
      daysTracked: trimmed.firstTrackedAt ? daysBetween(trimmed.firstTrackedAt, now) : null,
      firstReadyAt: alert?.first_ready_at ?? null,
      posts: alert?.posts ?? 0,
      isNew: !alert,
      draft: draftPitch({
        name,
        liftPct,
        ordersA: toInt(row.purchases_a),
        ordersB: toInt(row.purchases_b),
        shareCents,
        baseFeeCents,
        revSharePct: Number(m.rev_share_pct),
        shareUrl,
      }),
    });
  }

  // Biggest money first — that's the order you'd work them in.
  candidates.sort((a, b) => b.projectedMonthlyCents - a.projectedMonthlyCents);

  return { candidates, heldBack, suppressed };
}

/** Record what was surfaced so tomorrow's run stays quiet about it. */
export async function recordPosted(
  sb: SupabaseClient,
  candidates: GraduationCandidate[],
  now: number,
): Promise<void> {
  if (candidates.length === 0) return;
  const stamp = new Date(now).toISOString();
  await sb.from("graduation_alerts").upsert(
    candidates.map((c) => ({
      merchant_id: c.merchantId,
      // Keep the original first_ready_at on re-posts; upsert would otherwise
      // reset it and lose how long this has been sitting.
      first_ready_at: c.firstReadyAt ?? stamp,
      last_posted_at: stamp,
      posts: c.posts + 1,
      first_lift_pct: c.firstReadyAt ? undefined : c.liftPct,
      first_z: c.firstReadyAt ? undefined : c.z,
    })),
    { onConflict: "merchant_id" },
  );
}
