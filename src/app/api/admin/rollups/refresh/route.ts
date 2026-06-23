import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type MerchantRow = {
  id: string;
  name: string | null;
};

const DEFAULT_HOURS = 24;
const MAX_HOURS = 48;
const CHUNK_HOURS = 1;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestedHours(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get("hours") ?? DEFAULT_HOURS);
  if (!Number.isFinite(raw)) return DEFAULT_HOURS;
  return Math.max(1, Math.min(MAX_HOURS, Math.floor(raw)));
}

async function requireAdmin(): Promise<boolean> {
  const supabase = await getSupabaseServer();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAdminEmail(user?.email);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "no_db" }, 503);

  const hours = requestedHours(req);
  const until = new Date();
  const since = new Date(until.getTime() - hours * 3600_000);

  // Optional single-merchant scope (per-card "Refresh" on /admin/health).
  const merchantId = req.nextUrl.searchParams.get("merchantId");

  let merchantQuery = admin
    .from("merchants")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(50);
  if (merchantId) merchantQuery = merchantQuery.eq("id", merchantId);

  const { data: merchantRows, error: merchantError } = await merchantQuery;

  if (merchantError) {
    return json({ ok: false, error: merchantError.message }, 500);
  }

  const merchants = (merchantRows ?? []) as MerchantRow[];
  const results: Array<{
    id: string;
    name: string | null;
    refreshed: number;
    ok: boolean;
    error?: string;
  }> = [];

  for (const merchant of merchants) {
    let cursor = since.getTime();
    const end = until.getTime();
    let refreshed = 0;
    let error: string | undefined;

    while (cursor < end) {
      const chunkEnd = Math.min(cursor + CHUNK_HOURS * 3600_000, end);
      const { data, error: rpcError } = await admin.rpc(
        "eh_refresh_hourly_funnel_rollups_for_merchant",
        {
          p_merchant_id: merchant.id,
          p_since: new Date(cursor).toISOString(),
          p_until: new Date(chunkEnd).toISOString(),
        },
      );

      if (rpcError) {
        error = rpcError.message;
        break;
      }

      refreshed += Number(data ?? 0);
      cursor = chunkEnd;
    }

    results.push({
      id: merchant.id,
      name: merchant.name,
      refreshed,
      ok: !error,
      ...(error ? { error } : {}),
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/health");
  revalidatePath("/admin/performance");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/v2");
  revalidatePath("/dashboard/v3");

  const failed = results.filter((row) => !row.ok);
  return json(
    {
      ok: failed.length === 0,
      partial: failed.length > 0 && failed.length < results.length,
      hours,
      chunkHours: CHUNK_HOURS,
      merchants: results.length,
      refreshed: results.reduce((sum, row) => sum + row.refreshed, 0),
      failed: failed.length,
      results,
    },
    failed.length === results.length ? 500 : 200,
  );
}
