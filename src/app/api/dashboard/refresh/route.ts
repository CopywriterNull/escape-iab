import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";
import { getCurrentMerchant, getMerchantRollupFreshness } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Recent-window refresh for a single merchant is fast (the heavy historical
// recompute is never triggered here), but cap it well under the function
// ceiling so a busy merchant can't hang a dashboard load.
export const maxDuration = 60;

// Only recompute the recent tail — this is what makes "fresh on every load"
// cheap. Wider windows are the operator's job via /api/admin/rollups/refresh.
const REFRESH_WINDOW_HOURS = 3;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(_req: NextRequest) {
  // Authorization is implicit: getCurrentMerchant() returns the logged-in
  // user's own merchant (or, for an admin, the impersonated one). A merchant
  // can only ever refresh their own rollups.
  const merchant = await getCurrentMerchant();
  if (!merchant) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "no_db" }, 503);

  const until = new Date();
  const since = new Date(until.getTime() - REFRESH_WINDOW_HOURS * 3600_000);

  const { data, error } = await admin.rpc("eh_refresh_hourly_funnel_rollups_for_merchant", {
    p_merchant_id: merchant.id,
    p_since: since.toISOString(),
    p_until: until.toISOString(),
  });

  if (error) {
    return json({ ok: false, error: error.message }, 500);
  }

  const freshness = await getMerchantRollupFreshness(merchant.id);
  revalidatePath("/dashboard");

  return json({ ok: true, refreshed: Number(data ?? 0), freshness });
}
