import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRollupFreshness } from "@/lib/db";
import { fetchReferrerEarnings, type Referrer, type ReferredMerchantRow } from "@/lib/referrals";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Daily ops digest → Slack. Phase 1 of the automation roadmap
// (docs/OPERATIONS.md §Automation): composes the same signals the operator
// checks by hand every morning — went-dark brands, rollup freshness, the
// approval queue, the invoice queue, 24h portfolio numbers, top movers, and
// partner accruals — and posts them to SLACK_WEBHOOK_URL as Block Kit.
//
// Design rule: no metric is computed a second way. Everything reads the same
// tables/RPCs the admin pages use, so Slack can never disagree with the
// dashboards. (24h brand numbers are the untrimmed eh_admin_brand_performance
// read — same as /admin/performance's raw view; the digest labels them as
// directional.)
//
// Without SLACK_WEBHOOK_URL (or with ?dry=1) it returns the digest as JSON
// instead of posting — same auth, safe to curl.

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type PerfRow = {
  merchant_id: string;
  impressions_a: number | string | null;
  impressions_b: number | string | null;
  purchases_a: number | string | null;
  purchases_b: number | string | null;
  revenue_cents_a: number | string | null;
  revenue_cents_b: number | string | null;
};

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const sb = getSupabaseAdmin();
  if (!sb) return new Response("not configured", { status: 500 });

  const origin = siteOrigin();
  const now = Date.now();
  const since24hIso = new Date(now - 24 * 3600_000).toISOString();

  const [merchantsRes, invoicesRes, referrersRes, perfRes, freshness] = await Promise.all([
    sb
      .from("merchants")
      .select(
        "id, name, domain, status, escape_enabled, billing_status, referrer_id, referral_share_pct, created_at",
      ),
    sb
      .from("billing_invoices")
      .select("id, merchant_id, kind, total_cents, status, created_at")
      .in("status", ["pending_review", "failed", "charging"])
      .order("created_at", { ascending: false })
      .limit(100),
    sb.from("referrers").select("*"),
    sb.rpc("eh_admin_brand_performance", { p_since: since24hIso }),
    getRollupFreshness(),
  ]);

  type MerchantRow = {
    id: string;
    name: string | null;
    domain: string | null;
    status: string | null;
    escape_enabled: boolean | null;
    billing_status: string;
    referrer_id: string | null;
    created_at: string;
  };
  const merchants = (merchantsRes.data ?? []) as MerchantRow[];
  const nameOf = new Map(merchants.map((m) => [m.id, m.name ?? "(unnamed)"]));

  // Went-dark detector — same rule as /admin/health: escape-enabled merchant
  // whose last IG impression is >48h old (never-had-traffic merchants excluded).
  // Indexed limit-1 lookups per merchant; ~25 merchants makes this cheap.
  const enabled = merchants.filter((m) => m.escape_enabled !== false && m.status !== "pending");
  const lastIgResults = await Promise.all(
    enabled.map(async (m) => {
      const { data } = await sb
        .from("escape_events")
        .select("created_at")
        .eq("merchant_id", m.id)
        .eq("event_type", "impression")
        .eq("iab_kind", "instagram")
        .order("created_at", { ascending: false })
        .limit(1);
      const last = (data ?? [])[0]?.created_at as string | undefined;
      return { m, lastIgAt: last ?? null };
    }),
  );
  const wentDark = lastIgResults.filter(({ lastIgAt }) => {
    if (!lastIgAt) return false; // never had IG traffic → "needs traffic", not dark
    const hours = (now - new Date(lastIgAt).getTime()) / 3600_000;
    return hours > 48 && hours < 7 * 24; // quiet >48h but was alive this week
  });

  const pendingSignups = merchants.filter((m) => m.status === "pending");
  const invoices = (invoicesRes.data ?? []) as {
    id: string;
    merchant_id: string;
    kind: string;
    total_cents: number;
    status: string;
  }[];

  // 24h portfolio + top movers (untrimmed, directional — same source as the
  // /admin/performance raw view).
  const perfRows = ((perfRes.data ?? []) as PerfRow[]).filter(
    (r) => toInt(r.impressions_a) + toInt(r.impressions_b) > 0,
  );
  const totals = perfRows.reduce(
    (acc, r) => {
      acc.impA += toInt(r.impressions_a);
      acc.impB += toInt(r.impressions_b);
      acc.purch += toInt(r.purchases_a) + toInt(r.purchases_b);
      acc.revA += toInt(r.revenue_cents_a);
      acc.revB += toInt(r.revenue_cents_b);
      return acc;
    },
    { impA: 0, impB: 0, purch: 0, revA: 0, revB: 0 },
  );
  const topMovers = [...perfRows]
    .sort((a, b) => toInt(b.revenue_cents_a) - toInt(a.revenue_cents_a))
    .slice(0, 3)
    .map((r) => ({
      name: nameOf.get(r.merchant_id) ?? r.merchant_id.slice(0, 8),
      revACents: toInt(r.revenue_cents_a),
      impA: toInt(r.impressions_a),
      purchases: toInt(r.purchases_a) + toInt(r.purchases_b),
    }));

  // Partner accruals (paid + pending cuts, straight from the invoice ledger).
  const referrers = (referrersRes.data ?? []) as Referrer[];
  const partnerLines: string[] = [];
  for (const r of referrers) {
    const theirMerchants = merchants.filter(
      (m) => m.referrer_id === r.id,
    ) as unknown as ReferredMerchantRow[];
    if (theirMerchants.length === 0) continue;
    try {
      const e = await fetchReferrerEarnings(sb, r, theirMerchants);
      partnerLines.push(
        `${r.name}: earned ${money(e.paidShareCents)}${e.pendingShareCents > 0 ? ` · pending ${money(e.pendingShareCents)}` : ""} (${theirMerchants.length} brands)`,
      );
    } catch {
      partnerLines.push(`${r.name}: earnings unavailable`);
    }
  }

  const digest = {
    date: new Date(now).toISOString().slice(0, 10),
    rollups: {
      stale: freshness.stale,
      ageHours: Math.round(freshness.ageHours * 10) / 10,
    },
    wentDark: wentDark.map(({ m, lastIgAt }) => ({
      name: m.name,
      domain: m.domain,
      lastIgAt,
    })),
    pendingSignups: pendingSignups.map((m) => ({ name: m.name, domain: m.domain })),
    invoiceQueue: invoices.map((i) => ({
      merchant: nameOf.get(i.merchant_id) ?? i.merchant_id.slice(0, 8),
      status: i.status,
      total: money(i.total_cents),
    })),
    last24h: {
      brandsWithTraffic: perfRows.length,
      visitors: totals.impA + totals.impB,
      purchases: totals.purch,
      revenue: money(totals.revA + totals.revB),
      topMovers,
    },
    partners: partnerLines,
  };

  const webhook = process.env.SLACK_WEBHOOK_URL;
  const dry = req.nextUrl.searchParams.get("dry") === "1" || !webhook;
  if (dry) {
    return Response.json({ posted: false, reason: webhook ? "dry=1" : "no SLACK_WEBHOOK_URL", digest });
  }

  const attention: string[] = [];
  if (digest.rollups.stale) {
    attention.push(
      `:rotating_light: *Rollups stale* — newest refresh ${digest.rollups.ageHours}h old. Fix: <${origin}/admin/health|Health → Roll up last 24h>.`,
    );
  }
  for (const d of digest.wentDark) {
    attention.push(
      `:new_moon: *${d.name}* went dark — no IG impressions since ${String(d.lastIgAt).slice(0, 16).replace("T", " ")} UTC. Check the storefront tag / their ads.`,
    );
  }
  for (const s of digest.pendingSignups) {
    attention.push(`:inbox_tray: Signup awaiting approval: *${s.name}* (${s.domain ?? "no domain"}) → <${origin}/admin/merchants|review>`);
  }
  for (const i of digest.invoiceQueue) {
    const icon = i.status === "failed" ? ":x:" : i.status === "charging" ? ":hourglass:" : ":page_facing_up:";
    attention.push(`${icon} Invoice ${i.status}: *${i.merchant}* ${i.total} → <${origin}/admin/billing|billing>`);
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `EscapeHatch daily digest — ${digest.date}`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Last 24h:* ${digest.last24h.visitors.toLocaleString("en-US")} IAB visitors · ${digest.last24h.purchases} purchases · ${digest.last24h.revenue} tracked across ${digest.last24h.brandsWithTraffic} brands _(untrimmed, directional)_`,
      },
    },
  ];
  if (digest.last24h.topMovers.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Top movers (escaped revenue):*\n" +
          digest.last24h.topMovers
            .map((t) => `• ${t.name} — ${money(t.revACents)} · ${t.impA.toLocaleString("en-US")} escaped visitors`)
            .join("\n"),
      },
    });
  }
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        attention.length > 0
          ? `*Needs attention (${attention.length}):*\n` + attention.join("\n")
          : ":white_check_mark: *Nothing needs attention.* Queues clear, rollups fresh, all snippets firing.",
    },
  });
  if (digest.partners.length > 0) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `*Partners:* ${digest.partners.join(" · ")}` }],
    });
  }
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `<${origin}/admin|Admin> · <${origin}/admin/health|Health> · <${origin}/admin/billing|Billing> · <${origin}/admin/links|Links>`,
      },
    ],
  });

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json({ posted: false, slackStatus: res.status, slackBody: body, digest }, { status: 502 });
  }
  return Response.json({ posted: true, attention: attention.length, digest });
}
