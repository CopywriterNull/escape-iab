import type { SupabaseClient } from "@supabase/supabase-js";
import { zTestTwoProp } from "@/lib/db";
import { computeAccruing } from "@/lib/billing/earnings";
import { fetchReferrerEarnings, type Referrer, type ReferredMerchantRow } from "@/lib/referrals";

// Daily ops digest data layer. Everything here reads the same tables/RPCs the
// admin pages use — no metric is computed a second way, so Slack can never
// disagree with the dashboards.
//
// Segmentation is the point of this file. Raw portfolio revenue is dominated by
// rolled-out flat-fee clients (COVE, SquidHaus, G FUEL…) who have no live test
// and nothing to report on. The brands that need daily eyes are the ones still
// running a randomized 50/50 (the pipeline we can graduate onto a performance
// plan) and the ones already on one. So:
//
//   on-plan     billing_status = 'active'            → accruing revenue
//   in-test     ab_enabled = true, escape on         → lift, significance, readiness
//   rolled out  ab_enabled = false (100% escape)     → one collapsed line
//
// Lift for the pipeline is read over 14 days, never 24h: a single day's control
// arm is far too small to say anything, and calling tests early is how you ship
// a wrong number to a client.

export type MerchantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  status: string | null;
  escape_enabled: boolean | null;
  ab_enabled: boolean | null;
  billing_status: string;
  billing_view_token: string | null;
  billing_anchor: string | null;
  rev_share_pct: number | string;
  base_fee_cents: number;
  base_fee_waived: boolean;
  referrer_id: string | null;
  referral_share_pct: number | null;
  created_at: string;
};

export type PerfRow = {
  merchant_id: string;
  impressions_a: number | string | null;
  impressions_b: number | string | null;
  purchases_a: number | string | null;
  purchases_b: number | string | null;
  revenue_cents_a: number | string | null;
  revenue_cents_b: number | string | null;
};

export type Totals = {
  visitors: number;
  purchases: number;
  revenueCents: number;
  brands: number;
};

export type AttentionItem = {
  severity: "critical" | "warn" | "info";
  emoji: string;
  text: string;
  actionLabel: string;
  actionPath: string;
};

export type PipelineBrand = {
  name: string;
  shareToken: string | null;
  liftPct: number | null;
  z: number | null;
  cvrA: number;
  cvrB: number;
  ordersA: number;
  ordersB: number;
  visitors: number;
  /** ready = significant + positive; watch = significant + negative; building otherwise. */
  state: "ready" | "watch" | "building" | "quiet";
};

export type PlanBrand = {
  name: string;
  shareToken: string | null;
  accruingCents: number;
  periodEnd: string | null;
  liftPct: number | null;
};

export type Digest = {
  dateLabel: string;
  attention: AttentionItem[];
  totals: Totals;
  priorTotals: Totals;
  pipeline: PipelineBrand[];
  plan: PlanBrand[];
  rolledOut: { count: number; names: string[]; revenueCents: number };
  partners: { name: string; earnedCents: number; pendingCents: number; brands: number }[];
  rollupAgeHours: number;
};

export function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function sumTotals(rows: PerfRow[]): Totals {
  const withTraffic = rows.filter((r) => toInt(r.impressions_a) + toInt(r.impressions_b) > 0);
  return {
    visitors: withTraffic.reduce((n, r) => n + toInt(r.impressions_a) + toInt(r.impressions_b), 0),
    purchases: withTraffic.reduce((n, r) => n + toInt(r.purchases_a) + toInt(r.purchases_b), 0),
    revenueCents: withTraffic.reduce(
      (n, r) => n + toInt(r.revenue_cents_a) + toInt(r.revenue_cents_b),
      0,
    ),
    brands: withTraffic.length,
  };
}

/** Minimum control-arm evidence before we let a test claim anything. */
const MIN_CONTROL_VISITORS = 300;
export const MIN_CONTROL_ORDERS = 8;

function classify(row: PerfRow): PipelineBrand["state"] {
  const impB = toInt(row.impressions_b);
  const purB = toInt(row.purchases_b);
  if (impB < MIN_CONTROL_VISITORS) return "quiet";
  if (purB < MIN_CONTROL_ORDERS) return "building";
  const t = zTestTwoProp(
    toInt(row.purchases_a),
    toInt(row.impressions_a),
    purB,
    impB,
  );
  if (!t) return "building";
  if (Math.abs(t.z) < 1.96) return "building";
  return t.z > 0 ? "ready" : "watch";
}

export async function buildDigest(sb: SupabaseClient, now: number): Promise<Digest> {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const H = 3600_000;

  const [merchantsRes, invoicesRes, referrersRes, perf24, perf48, perf14d, rollupRes] =
    await Promise.all([
      sb
        .from("merchants")
        .select(
          "id, name, domain, status, escape_enabled, ab_enabled, billing_status, billing_view_token, billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived, referrer_id, referral_share_pct, created_at",
        ),
      sb
        .from("billing_invoices")
        .select("id, merchant_id, kind, total_cents, status")
        .in("status", ["pending_review", "failed", "charging"])
        .limit(100),
      sb.from("referrers").select("*"),
      sb.rpc("eh_admin_brand_performance", { p_since: iso(24 * H) }),
      sb.rpc("eh_admin_brand_performance", { p_since: iso(48 * H) }),
      sb.rpc("eh_admin_brand_performance", { p_since: iso(14 * 24 * H) }),
      sb
        .from("hourly_funnel_rollups")
        .select("refreshed_at")
        .order("refreshed_at", { ascending: false })
        .limit(1),
    ]);

  const merchants = (merchantsRes.data ?? []) as MerchantRow[];
  const byId = new Map(merchants.map((m) => [m.id, m]));
  const rows24 = (perf24.data ?? []) as PerfRow[];
  const rows48 = (perf48.data ?? []) as PerfRow[];
  const rows14 = (perf14d.data ?? []) as PerfRow[];

  const totals = sumTotals(rows24);
  const totals48 = sumTotals(rows48);
  // The 48h read is cumulative, so the previous day is the difference. Brand
  // counts don't subtract meaningfully — carry the 24h count instead.
  const priorTotals: Totals = {
    visitors: Math.max(0, totals48.visitors - totals.visitors),
    purchases: Math.max(0, totals48.purchases - totals.purchases),
    revenueCents: Math.max(0, totals48.revenueCents - totals.revenueCents),
    brands: totals.brands,
  };

  const lastRefresh = ((rollupRes.data ?? []) as { refreshed_at: string | null }[])[0]?.refreshed_at;
  const rollupAgeHours = lastRefresh ? (now - new Date(lastRefresh).getTime()) / H : 999;

  // ---- Attention queue, ordered by how much it costs to ignore ----
  const attention: AttentionItem[] = [];

  if (rollupAgeHours > 3) {
    attention.push({
      severity: "critical",
      emoji: ":rotating_light:",
      text: `*Rollups are ${Math.round(rollupAgeHours)}h stale* — every dashboard is undercounting until they refresh.`,
      actionLabel: "Refresh now",
      actionPath: "/admin/health",
    });
  }

  const liveMerchants = merchants.filter(
    (m) => m.escape_enabled !== false && m.status !== "pending",
  );
  const lastIg = await Promise.all(
    liveMerchants.map(async (m) => {
      const { data } = await sb
        .from("escape_events")
        .select("created_at")
        .eq("merchant_id", m.id)
        .eq("event_type", "impression")
        .eq("iab_kind", "instagram")
        .order("created_at", { ascending: false })
        .limit(1);
      return { m, at: ((data ?? [])[0]?.created_at as string | undefined) ?? null };
    }),
  );
  for (const { m, at } of lastIg) {
    if (!at) continue; // never had IG traffic → "needs traffic", not dark
    const hours = (now - new Date(at).getTime()) / H;
    if (hours > 48 && hours < 7 * 24) {
      attention.push({
        severity: "critical",
        emoji: ":new_moon:",
        text: `*${m.name ?? m.domain}* went dark — no Instagram traffic for ${Math.round(hours)}h. Check their ad spend and the theme tag.`,
        actionLabel: "Health",
        actionPath: "/admin/health",
      });
    }
  }

  const invoices = (invoicesRes.data ?? []) as {
    merchant_id: string;
    status: string;
    total_cents: number;
  }[];
  for (const inv of invoices) {
    const name = byId.get(inv.merchant_id)?.name ?? "a merchant";
    if (inv.status === "failed") {
      attention.push({
        severity: "critical",
        emoji: ":x:",
        text: `*${name}* — charge failed on ${money(inv.total_cents)}. Void the old Stripe invoice before retrying.`,
        actionLabel: "Billing",
        actionPath: "/admin/billing",
      });
    } else if (inv.status === "charging") {
      attention.push({
        severity: "warn",
        emoji: ":hourglass_flowing_sand:",
        text: `*${name}* — ${money(inv.total_cents)} mid-charge. Wait for the webhook before touching it.`,
        actionLabel: "Billing",
        actionPath: "/admin/billing",
      });
    } else {
      attention.push({
        severity: "warn",
        emoji: ":page_facing_up:",
        text: `*${name}* — ${money(inv.total_cents)} invoice drafted, waiting on your review.`,
        actionLabel: "Review",
        actionPath: "/admin/billing",
      });
    }
  }

  for (const m of merchants.filter((x) => x.status === "pending")) {
    attention.push({
      severity: "info",
      emoji: ":inbox_tray:",
      text: `*${m.name ?? "New signup"}* (${m.domain ?? "no domain"}) is waiting for approval.`,
      actionLabel: "Approve",
      actionPath: "/admin/merchants",
    });
  }

  const rank = { critical: 0, warn: 1, info: 2 } as const;
  attention.sort((a, b) => rank[a.severity] - rank[b.severity]);

  // ---- Segments ----
  const rows14ById = new Map(rows14.map((r) => [r.merchant_id, r]));

  const planMerchants = merchants.filter((m) => m.billing_status === "active");
  const plan: PlanBrand[] = [];
  for (const m of planMerchants) {
    let accruingCents = 0;
    let periodEnd: string | null = null;
    if (m.billing_anchor) {
      try {
        const a = await computeAccruing(sb, {
          id: m.id,
          billing_anchor: m.billing_anchor,
          rev_share_pct: Number(m.rev_share_pct),
          base_fee_cents: m.base_fee_cents,
          base_fee_waived: m.base_fee_waived,
        });
        accruingCents = a.totalCents;
        periodEnd = a.periodEnd;
      } catch {
        // Leave at zero — a billing hiccup shouldn't take the digest down.
      }
    }
    const r = rows14ById.get(m.id);
    const t = r
      ? zTestTwoProp(
          toInt(r.purchases_a),
          toInt(r.impressions_a),
          toInt(r.purchases_b),
          toInt(r.impressions_b),
        )
      : null;
    plan.push({
      name: m.name ?? "(unnamed)",
      shareToken: m.billing_view_token,
      accruingCents,
      periodEnd,
      liftPct: t?.liftRel != null ? t.liftRel * 100 : null,
    });
  }

  const inTest = merchants.filter(
    (m) =>
      m.billing_status !== "active" &&
      m.ab_enabled === true &&
      m.escape_enabled !== false &&
      m.status !== "pending",
  );
  const pipeline: PipelineBrand[] = inTest
    .map((m) => {
      const r = rows14ById.get(m.id);
      if (!r) return null;
      const impA = toInt(r.impressions_a);
      const impB = toInt(r.impressions_b);
      if (impA + impB === 0) return null;
      const t = zTestTwoProp(toInt(r.purchases_a), impA, toInt(r.purchases_b), impB);
      return {
        name: m.name ?? "(unnamed)",
        shareToken: m.billing_view_token,
        liftPct: t?.liftRel != null ? t.liftRel * 100 : null,
        z: t?.z ?? null,
        cvrA: impA > 0 ? toInt(r.purchases_a) / impA : 0,
        cvrB: impB > 0 ? toInt(r.purchases_b) / impB : 0,
        ordersA: toInt(r.purchases_a),
        ordersB: toInt(r.purchases_b),
        visitors: impA + impB,
        state: classify(r),
      } satisfies PipelineBrand;
    })
    .filter((b): b is PipelineBrand => b !== null)
    .sort((a, b) => {
      const order = { ready: 0, watch: 1, building: 2, quiet: 3 };
      if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
      // Decided tests rank by strength of result; undecided ones rank by how
      // much evidence they've banked — otherwise a 14-order test with a lucky
      // z-score outranks a 190-order test that's nearly conclusive.
      if (a.state === "ready" || a.state === "watch") return Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0);
      return b.ordersA + b.ordersB - (a.ordersA + a.ordersB);
    });

  const rolledOutMerchants = merchants.filter(
    (m) =>
      m.billing_status !== "active" && m.ab_enabled === false && m.escape_enabled !== false,
  );
  const rolledOutIds = new Set(rolledOutMerchants.map((m) => m.id));
  const rolledOutRevenue = rows24
    .filter((r) => rolledOutIds.has(r.merchant_id))
    .reduce((n, r) => n + toInt(r.revenue_cents_a) + toInt(r.revenue_cents_b), 0);
  const rolledOutWithTraffic = rows24
    .filter((r) => rolledOutIds.has(r.merchant_id) && toInt(r.impressions_a) + toInt(r.impressions_b) > 0)
    .map((r) => byId.get(r.merchant_id)?.name ?? "")
    .filter(Boolean);

  // ---- Partners ----
  const referrers = (referrersRes.data ?? []) as Referrer[];
  const partners: Digest["partners"] = [];
  for (const r of referrers) {
    const theirs = merchants.filter((m) => m.referrer_id === r.id) as unknown as ReferredMerchantRow[];
    if (theirs.length === 0) continue;
    try {
      const e = await fetchReferrerEarnings(sb, r, theirs, { includeAccruing: true });
      partners.push({
        name: r.name,
        earnedCents: e.paidShareCents,
        pendingCents: e.pendingShareCents + e.accruingShareCents,
        brands: theirs.length,
      });
    } catch {
      // skip — never fail the digest over a partner read
    }
  }

  return {
    dateLabel: new Date(now).toISOString().slice(0, 10),
    attention,
    totals,
    priorTotals,
    pipeline,
    plan,
    rolledOut: {
      count: rolledOutWithTraffic.length,
      names: rolledOutWithTraffic,
      revenueCents: rolledOutRevenue,
    },
    partners,
    rollupAgeHours,
  };
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function compactMoney(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}K`;
  return `$${d.toFixed(0)}`;
}

export function pctDelta(current: number, prior: number): string {
  if (prior <= 0) return "";
  const change = ((current - prior) / prior) * 100;
  if (Math.abs(change) < 1) return "  ·  flat";
  const arrow = change > 0 ? "▲" : "▼";
  return `  ·  ${arrow} ${Math.abs(change).toFixed(0)}%`;
}
