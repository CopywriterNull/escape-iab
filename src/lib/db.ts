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
  };
  for (const r of rows) {
    const b = r.bucket === "b" ? "b" : "a";
    out.impressions[b] += r.impressions ?? 0;
    out.escape_attempts[b] += r.escape_attempts ?? 0;
    out.iab_detected[b] += r.iab_detected ?? 0;
    out.escape_skipped[b] += r.escape_skipped ?? 0;
    out.fallback_shown[b] += r.fallback_shown ?? 0;
    out.fallback_clicked[b] += r.fallback_clicked ?? 0;
  }
  return out;
}
