import { NextResponse } from "next/server";
import { getCurrentMerchant, getEnabledDashboardIabKinds } from "@/lib/db";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return NextResponse.json({ rows: [] }, { status: 401 });
  }
  const supabase = getSupabaseAdmin() ?? (await getSupabaseServer());
  if (!supabase) return NextResponse.json({ rows: [] });

  const url = new URL(req.url);
  const days = Math.max(0.0417, Math.min(90, parseFloat(url.searchParams.get("days") ?? "14")));
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") ?? "12", 10)));
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data } = await supabase
    .from("escape_events")
    .select("event_type,bucket,in_test,value_cents,utm_source,iab_kind,created_at")
    .eq("merchant_id", merchant.id)
    .in("event_type", ["purchase", "checkout_started", "add_to_cart", "escape_attempt"])
    .in("iab_kind", getEnabledDashboardIabKinds(merchant))
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  return NextResponse.json({ rows: data ?? [], ts: Date.now() });
}
