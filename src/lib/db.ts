import { getSupabaseServer } from "@/lib/supabase/server";

export type Merchant = {
  id: string;
  user_id: string;
  name: string | null;
  domain: string | null;
  plan: string;
  ab_enabled: boolean;
  fallback_button: boolean;
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
  | "facebook"
  | "messenger"
  | "tiktok"
  | "snapchat"
  | "pinterest"
  | "line"
  | "wechat"
  | "webview";

export async function getCurrentMerchant(): Promise<Merchant | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Merchant | null) ?? null;
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
  const supabase = await getSupabaseServer();
  if (!supabase) return empty;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  // Aggregate server-side via RPC to avoid the PostgREST 1000-row cap.
  const { data, error } = await supabase.rpc("eh_test_funnel", {
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
  const supabase = await getSupabaseServer();
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
  const supabase = await getSupabaseServer();
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
  const supabase = await getSupabaseServer();
  const empty: Record<IabKind, number> = {
    instagram: 0,
    facebook: 0,
    messenger: 0,
    tiktok: 0,
    snapchat: 0,
    pinterest: 0,
    line: 0,
    wechat: 0,
    webview: 0,
  };
  if (!supabase) return empty;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data } = await supabase
    .from("escape_events")
    .select("iab_kind")
    .eq("merchant_id", merchantId)
    .eq("event_type", "impression")
    .gte("created_at", since);
  const out = { ...empty };
  for (const row of (data ?? []) as { iab_kind: IabKind | null }[]) {
    if (row.iab_kind && row.iab_kind in out) out[row.iab_kind]++;
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
  const supabase = await getSupabaseServer();
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
