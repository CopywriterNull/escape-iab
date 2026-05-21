import { cookies } from "next/headers";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

const IMP_COOKIE = "eh_imp_merchant_id";

async function getTelemetryClient() {
  return getSupabaseAdmin() ?? (await getSupabaseServer());
}

/** Total escape_attempt events since UTC midnight for the given merchant.
 *  Uses the service-role admin client (no cookies) so callers like the
 *  marketing lander stay static-renderable. RLS on escape_events blocks the
 *  anon role, and the lander is anonymous — admin bypasses that without
 *  opting the page into dynamic rendering. */
export async function getEscapesToday(merchantId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("escape_events")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("event_type", "escape_attempt")
    .gte("created_at", midnight.toISOString());
  return count ?? 0;
}

/** Rolling last-24h escape attempts. When merchantId is omitted, this returns
 *  the platform-wide count for the marketing site's live proof badge. */
export async function getEscapesLast24Hours(merchantId?: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  let q = supabase
    .from("escape_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", "escape_attempt")
    .gte("created_at", since);
  if (merchantId) q = q.eq("merchant_id", merchantId);
  const { count } = await q;
  return count ?? 0;
}

export type Merchant = {
  id: string;
  user_id: string;
  name: string | null;
  domain: string | null;
  plan: string;
  ab_enabled: boolean;
  fallback_button: boolean;
  escape_enabled?: boolean;
  fallback_text?: string | null;
  paid_only?: boolean;
  /** Percent of in-test traffic placed in bucket A (escape). 50 = even. */
  ab_split_pct?: number;
  escape_instagram?: boolean;
  escape_threads?: boolean;
  escape_facebook?: boolean;
  escape_messenger?: boolean;
  escape_discord?: boolean;
  created_at: string;
};

export type DailyRollup = {
  merchant_id: string;
  day: string;
  bucket: "a" | "b";
  impressions: number;
  iab_detected: number;
  escape_attempts: number;
  escape_skipped: number;
  fallback_shown: number;
  fallback_clicked: number;
  product_viewed: number;
  add_to_cart: number;
  checkout_started: number;
  purchases: number;
  revenue_cents: number;
};

export type IabKind =
  | "instagram"
  | "threads"
  | "facebook"
  | "messenger"
  | "tiktok"
  | "snapchat"
  | "pinterest"
  | "discord"
  | "line"
  | "wechat"
  | "webview";

export function getEnabledDashboardIabKinds(merchant: Pick<
  Merchant,
  | "escape_instagram"
  | "escape_threads"
  | "escape_facebook"
  | "escape_messenger"
  | "escape_discord"
>): IabKind[] {
  const kinds: IabKind[] = [];
  if (merchant.escape_instagram !== false) kinds.push("instagram");
  if (merchant.escape_threads === true) kinds.push("threads");
  if (merchant.escape_facebook === true) kinds.push("facebook");
  if (merchant.escape_messenger === true) kinds.push("messenger");
  if (merchant.escape_discord === true) kinds.push("discord");
  return kinds.length > 0 ? kinds : ["instagram"];
}

export async function getCurrentMerchant(): Promise<Merchant | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Admin impersonation: if the eh_imp_merchant_id cookie is set AND
  // the current user is the admin, load that merchant via service-role.
  // Honoured only for admin emails — anyone else with the cookie set
  // is ignored (cookie alone confers no privilege).
  if (isAdminEmail(user.email)) {
    const cookieStore = await cookies();
    const impId = cookieStore.get(IMP_COOKIE)?.value;
    if (impId) {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data } = await admin
          .from("merchants")
          .select("*")
          .eq("id", impId)
          .maybeSingle();
        if (data) return data as Merchant;
      }
    }
  }

  // Use limit(1) instead of maybeSingle() — maybeSingle returns null when
  // there's more than one row, which silently breaks the dashboard if a
  // user accidentally owns multiple merchants. Return the oldest.
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (!data || data.length === 0) return null;
  return data[0] as Merchant;
}

/** True if the current user is admin AND impersonating a non-self merchant. */
export async function getImpersonationStatus(): Promise<{
  active: boolean;
  merchant: Merchant | null;
}> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { active: false, merchant: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { active: false, merchant: null };
  if (!isAdminEmail(user.email)) {
    return { active: false, merchant: null };
  }
  const cookieStore = await cookies();
  const impId = cookieStore.get(IMP_COOKIE)?.value;
  if (!impId) return { active: false, merchant: null };
  const admin = getSupabaseAdmin();
  if (!admin) return { active: false, merchant: null };
  const { data } = await admin
    .from("merchants")
    .select("*")
    .eq("id", impId)
    .maybeSingle();
  return { active: !!data, merchant: (data as Merchant | null) ?? null };
}

// Funnel computed directly from escape_events, restricted to the test
// population (in_test=true). Authoritative for the dashboard A/B comparison;
// rollups are for time-series charts only.
export type FunnelStage =
  | "impression"
  | "escape_attempt"
  | "product_viewed"
  | "add_to_cart"
  | "checkout_started"
  | "purchase";

export type Funnel = {
  impressions: { a: number; b: number };
  escape_attempts: { a: number; b: number };
  product_viewed: { a: number; b: number };
  add_to_cart: { a: number; b: number };
  checkout_started: { a: number; b: number };
  purchases: { a: number; b: number };
  revenue_cents: { a: number; b: number };
};

export async function getTestFunnel(
  merchantId: string,
  days = 14,
): Promise<Funnel> {
  const empty: Funnel = {
    impressions: { a: 0, b: 0 },
    escape_attempts: { a: 0, b: 0 },
    product_viewed: { a: 0, b: 0 },
    add_to_cart: { a: 0, b: 0 },
    checkout_started: { a: 0, b: 0 },
    purchases: { a: 0, b: 0 },
    revenue_cents: { a: 0, b: 0 },
  };
  // Service-role client (no cookies) so the marketing lander stays
  // static-renderable. The eh_test_funnel RPC is not granted to anon.
  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  // Sub-day windows need exact rolling timestamps. The rollup-backed RPC is
  // intentionally hour-grain for speed on 14d/30d windows.
  const rpcName = days < 1 ? "eh_test_funnel_exact" : "eh_test_funnel";
  const { data, error } = await supabase.rpc(rpcName, {
    p_merchant_id: merchantId,
    p_since: since,
  });
  if (error || !Array.isArray(data)) return empty;
  const out: Funnel = empty;
  for (const r of data as {
    event_type: string;
    bucket: "a" | "b";
    cnt: number | string;
    revenue_cents: number | string;
  }[]) {
    const b = r.bucket === "b" ? "b" : "a";
    const cnt = typeof r.cnt === "string" ? parseInt(r.cnt, 10) : r.cnt;
    const rev =
      typeof r.revenue_cents === "string"
        ? parseInt(r.revenue_cents, 10)
        : r.revenue_cents;
    switch (r.event_type) {
      case "impression":
        out.impressions[b] = cnt;
        break;
      case "escape_attempt":
        out.escape_attempts[b] = cnt;
        break;
      case "product_viewed":
        out.product_viewed[b] = cnt;
        break;
      case "add_to_cart":
        out.add_to_cart[b] = cnt;
        break;
      case "checkout_started":
        out.checkout_started[b] = cnt;
        break;
      case "purchase":
        out.purchases[b] = cnt;
        out.revenue_cents[b] = rev;
        break;
    }
  }
  return out;
}

export async function getRollups(
  merchantId: string,
  days = 14,
): Promise<DailyRollup[]> {
  const supabase = await getTelemetryClient();
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("daily_rollups")
    .select("*")
    .eq("merchant_id", merchantId)
    .gte("day", since)
    .order("day", { ascending: true });
  return (data as DailyRollup[]) ?? [];
}

/* -------- Period-over-period delta from daily_rollups -------- */

export type PeriodSummary = {
  impressions: number;
  escape_attempts: number;
  product_viewed: number;
  add_to_cart: number;
  checkout_started: number;
  purchases: number;
  revenue_cents: number;
};

export type PeriodDelta = {
  current: PeriodSummary;
  previous: PeriodSummary;
  // Relative delta in [-1, +Infinity]. Null when previous is zero (can't compute %).
  deltas: {
    impressions: number | null;
    escape_attempts: number | null;
    purchases: number | null;
    revenue_cents: number | null;
  };
  /** True only when daily_rollups can support the requested grain. */
  comparable: boolean;
  /** Label like "vs prior 14d" for display. */
  priorLabel: string;
};

const EMPTY_PERIOD: PeriodSummary = {
  impressions: 0,
  escape_attempts: 0,
  product_viewed: 0,
  add_to_cart: 0,
  checkout_started: 0,
  purchases: 0,
  revenue_cents: 0,
};

function sumRollups(rows: DailyRollup[]): PeriodSummary {
  const out: PeriodSummary = { ...EMPTY_PERIOD };
  for (const r of rows) {
    out.impressions += r.impressions ?? 0;
    out.escape_attempts += r.escape_attempts ?? 0;
    out.product_viewed += r.product_viewed ?? 0;
    out.add_to_cart += r.add_to_cart ?? 0;
    out.checkout_started += r.checkout_started ?? 0;
    out.purchases += r.purchases ?? 0;
    out.revenue_cents += r.revenue_cents ?? 0;
  }
  return out;
}

function relDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

function priorLabelFor(days: number): string {
  if (days < 1) return `vs prior ${Math.round(days * 24)}h`;
  if (days === 1) return "vs prior 24h";
  return `vs prior ${days}d`;
}

export async function getPeriodDelta(
  merchantId: string,
  days: number,
): Promise<PeriodDelta> {
  const supabase = await getTelemetryClient();
  if (!supabase || days < 1) {
    // daily_rollups is day-grain; sub-day ranges can't compare cleanly.
    return {
      current: { ...EMPTY_PERIOD },
      previous: { ...EMPTY_PERIOD },
      deltas: { impressions: null, escape_attempts: null, purchases: null, revenue_cents: null },
      comparable: false,
      priorLabel: priorLabelFor(days),
    };
  }

  const dayMs = 86400_000;
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const now = Date.now();
  const sinceDouble = toIso(new Date(now - 2 * days * dayMs));
  const midpoint = toIso(new Date(now - days * dayMs));

  const { data } = await supabase
    .from("daily_rollups")
    .select("*")
    .eq("merchant_id", merchantId)
    .gte("day", sinceDouble);

  const rows = (data as DailyRollup[]) ?? [];
  const currentRows = rows.filter((r) => r.day >= midpoint);
  const previousRows = rows.filter((r) => r.day < midpoint);

  const current = sumRollups(currentRows);
  const previous = sumRollups(previousRows);

  return {
    current,
    previous,
    deltas: {
      impressions: relDelta(current.impressions, previous.impressions),
      escape_attempts: relDelta(current.escape_attempts, previous.escape_attempts),
      purchases: relDelta(current.purchases, previous.purchases),
      revenue_cents: relDelta(current.revenue_cents, previous.revenue_cents),
    },
    comparable: true,
    priorLabel: priorLabelFor(days),
  };
}

export type SourceRow = {
  utm_source: string;
  total: number;
  bucket_a: number;
  bucket_b: number;
  purchases: number;
  revenue_cents: number;
};

export async function getSourceBreakdown(
  merchantId: string,
  days = 14,
  limit = 10,
): Promise<SourceRow[]> {
  const supabase = await getTelemetryClient();
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await supabase.rpc("eh_test_sources", {
    p_merchant_id: merchantId,
    p_since: since,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return (data as {
    utm_source: string;
    total: number | string;
    bucket_a: number | string;
    bucket_b: number | string;
    purchases: number | string;
    revenue_cents: number | string;
  }[]).map((r) => ({
    utm_source: r.utm_source,
    total: typeof r.total === "string" ? parseInt(r.total, 10) : r.total,
    bucket_a: typeof r.bucket_a === "string" ? parseInt(r.bucket_a, 10) : r.bucket_a,
    bucket_b: typeof r.bucket_b === "string" ? parseInt(r.bucket_b, 10) : r.bucket_b,
    purchases: typeof r.purchases === "string" ? parseInt(r.purchases, 10) : r.purchases,
    revenue_cents:
      typeof r.revenue_cents === "string" ? parseInt(r.revenue_cents, 10) : r.revenue_cents,
  }));
}

export async function getIabBreakdown(
  merchantId: string,
  days = 14,
): Promise<Record<IabKind, number>> {
  const supabase = getSupabaseAdmin();
  const empty: Record<IabKind, number> = {
    instagram: 0,
    threads: 0,
    facebook: 0,
    messenger: 0,
    tiktok: 0,
    snapchat: 0,
    pinterest: 0,
    discord: 0,
    line: 0,
    wechat: 0,
    webview: 0,
  };
  if (!supabase) return empty;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await supabase.rpc("eh_iab_breakdown", {
    p_merchant_id: merchantId,
    p_since: since,
  });
  if (error || !Array.isArray(data)) return empty;
  const out = { ...empty };
  for (const row of data as { iab_kind: IabKind | null; impressions: number | string }[]) {
    if (row.iab_kind && row.iab_kind in out) {
      out[row.iab_kind] =
        typeof row.impressions === "string" ? parseInt(row.impressions, 10) : row.impressions;
    }
  }
  return out;
}

export type Totals = {
  impressions: { a: number; b: number };
  escape_attempts: { a: number; b: number };
  iab_detected: { a: number; b: number };
  escape_skipped: { a: number; b: number };
  fallback_shown: { a: number; b: number };
  fallback_clicked: { a: number; b: number };
  product_viewed: { a: number; b: number };
  add_to_cart: { a: number; b: number };
  checkout_started: { a: number; b: number };
  purchases: { a: number; b: number };
  revenue_cents: { a: number; b: number };
};

export function totalize(rows: DailyRollup[]): Totals {
  const init = { a: 0, b: 0 };
  const out: Totals = {
    impressions: { ...init },
    escape_attempts: { ...init },
    iab_detected: { ...init },
    escape_skipped: { ...init },
    fallback_shown: { ...init },
    fallback_clicked: { ...init },
    product_viewed: { ...init },
    add_to_cart: { ...init },
    checkout_started: { ...init },
    purchases: { ...init },
    revenue_cents: { ...init },
  };
  for (const r of rows) {
    const b = r.bucket === "b" ? "b" : "a";
    out.impressions[b] += r.impressions ?? 0;
    out.escape_attempts[b] += r.escape_attempts ?? 0;
    out.iab_detected[b] += r.iab_detected ?? 0;
    out.escape_skipped[b] += r.escape_skipped ?? 0;
    out.fallback_shown[b] += r.fallback_shown ?? 0;
    out.fallback_clicked[b] += r.fallback_clicked ?? 0;
    out.product_viewed[b] += r.product_viewed ?? 0;
    out.add_to_cart[b] += r.add_to_cart ?? 0;
    out.checkout_started[b] += r.checkout_started ?? 0;
    out.purchases[b] += r.purchases ?? 0;
    out.revenue_cents[b] += r.revenue_cents ?? 0;
  }
  return out;
}

// All-time unattributed purchases — pixel beacons we received but couldn't
// join to a test-population impression (different clientId, expired cookie,
// Shopify checkout subdomain, multi-day journey, etc). This is the gap between
// "purchases the merchant got from IG" and "purchases we attributed to A/B".
export async function getUnattributedPurchaseStats(
  merchantId: string,
  days = 14,
): Promise<{ count: number; revenue_cents: number }> {
  const supabase = await getTelemetryClient();
  if (!supabase) return { count: 0, revenue_cents: 0 };
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await supabase
    .from("escape_events")
    .select("order_id, value_cents")
    .eq("merchant_id", merchantId)
    .eq("event_type", "purchase")
    .eq("in_test", false)
    .gte("created_at", since)
    .limit(5000);
  const seen = new Set<string>();
  let revenue = 0;
  for (const r of (data ?? []) as { order_id: string | null; value_cents: number | null }[]) {
    const k = r.order_id || `null-${revenue}`;
    if (seen.has(k)) continue;
    seen.add(k);
    revenue += r.value_cents ?? 0;
  }
  return { count: seen.size, revenue_cents: revenue };
}

// Two-proportion z-test. Returns null if either bucket has zero impressions.
export type ZTestResult = {
  pA: number; // CVR in bucket A (0..1)
  pB: number; // CVR in bucket B
  liftRel: number | null; // (pA - pB) / pB
  z: number;
  pValue: number; // two-sided
  significant: boolean; // p < 0.05
};

export function zTestTwoProp(
  xA: number,
  nA: number,
  xB: number,
  nB: number,
): ZTestResult | null {
  if (nA <= 0 || nB <= 0) return null;
  const pA = xA / nA;
  const pB = xB / nB;
  const pPool = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
  if (se === 0) {
    return {
      pA,
      pB,
      liftRel: pB > 0 ? (pA - pB) / pB : null,
      z: 0,
      pValue: 1,
      significant: false,
    };
  }
  const z = (pA - pB) / se;
  // two-sided p-value via standard normal CDF approximation
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return {
    pA,
    pB,
    liftRel: pB > 0 ? (pA - pB) / pB : null,
    z,
    pValue,
    significant: pValue < 0.05,
  };
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun approximation, max error ~7.5e-8.
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

// Sample size required per bucket for a two-proportion test, given baseline CVR
// (pB), minimum detectable RELATIVE effect (e.g., 0.20 for +20%), confidence
// 0.95 (z=1.96), power 0.80 (z=0.84). Returns visitors needed per bucket.
export function sampleSizePerBucket(pB: number, mdeRel: number): number {
  if (pB <= 0 || pB >= 1) return Infinity;
  const pA = pB * (1 + mdeRel);
  if (pA <= 0 || pA >= 1) return Infinity;
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const sd1 = Math.sqrt(2 * pB * (1 - pB));
  const sd2 = Math.sqrt(pA * (1 - pA) + pB * (1 - pB));
  const n = Math.pow(zAlpha * sd1 + zBeta * sd2, 2) / Math.pow(pA - pB, 2);
  return Math.ceil(n);
}
