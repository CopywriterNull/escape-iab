import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
// Fluid Compute ceiling. The rollup refresh RPC over 4h still aggregates
// hundreds of thousands of escape_events rows; without this it hits the
// default 60s timeout and the whole hour silently fails (see SquidHaus
// 3-day blackout 2026-05-23 → 2026-05-26).
export const maxDuration = 300;

type EscapeEventIdRow = { id: string };
type FreshMerchantRow = { id: string; created_at: string | null };

const DEFAULT_BATCH_SIZE = 750;
const MAX_BATCH_SIZE = 1000;
const MAX_BATCHES_PER_RUN = 8;

const POLICIES = [
  {
    name: "cart_check",
    retentionDays: 1,
    eventTypes: ["cart_check"],
  },
  {
    name: "raw_non_purchase",
    retentionDays: 21,
    excludeEventTypes: ["purchase"],
  },
  {
    name: "purchase",
    retentionDays: 365,
    eventTypes: ["purchase"],
  },
] as const;

const CART_ATTRIBUTION_RETENTION_DAYS = 45;
// Refresh window. Cron runs hourly, so 4h gives 4x redundancy and stays well
// under the function timeout even at SquidHaus/COVE volume. Shrunk from 8h
// after the 2026-05-26 blackout where 8h consistently 500'd.
const HOURLY_ROLLUP_REFRESH_HOURS = 4;
const FRESH_MERCHANT_BACKFILL_DAYS = 7;
const FRESH_MERCHANT_BACKFILL_CHUNK_HOURS = 6;
const MAX_FRESH_MERCHANT_BACKFILLS = 5;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function batchSizeFrom(req: NextRequest): number {
  const requested = Number(req.nextUrl.searchParams.get("batch") ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(requested)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(requested)));
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
    return json({ ok: false, error: "missing_cron_secret" }, 503);
  }

  const admin = getSupabaseAdmin();
  if (!admin) return json({ ok: false, error: "no_db" }, 503);

  const batchSize = batchSizeFrom(req);
  const steps: Record<string, { ok: boolean; [key: string]: unknown }> = {};

  // Step 1: rollup refresh. Isolated — if it fails, retention still runs.
  // Previous architecture returned 500 here on any RPC error, which meant the
  // whole cron blocked on the slowest sub-task.
  //
  // IMPORTANT: refresh PER MERCHANT, not via the all-merchants
  // eh_refresh_hourly_funnel_rollups. That variant has no merchant_id filter,
  // so it can't use any of the (merchant_id, ...) leading indexes and ends up
  // scanning the whole 4h slice across every merchant. As volume grew that
  // single call started exceeding the 300s function ceiling on EVERY run, which
  // hard-killed the cron before it could commit — the rollups silently froze
  // 2026-06-15 → 2026-06-23 and needed an 8-day manual backfill. Looping the
  // per-merchant RPC keeps each call on the merchant-leading indexes, bounds
  // the work, and isolates a single slow/failing merchant from the rest.
  const rollupSince = new Date(Date.now() - HOURLY_ROLLUP_REFRESH_HOURS * 3600_000).toISOString();
  const rollupUntil = new Date().toISOString();
  try {
    const { data: rollupMerchants, error: rollupMerchantError } = await admin
      .from("merchants")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(500);

    if (rollupMerchantError) {
      steps.hourly_rollups = {
        ok: false,
        error: rollupMerchantError.message,
        since: rollupSince,
      };
    } else {
      const ids = ((rollupMerchants ?? []) as Array<{ id: string }>).map((row) => row.id);
      let refreshed = 0;
      const errors: string[] = [];

      for (const id of ids) {
        const { data: merchantRows, error: merchantRollupError } = await admin.rpc(
          "eh_refresh_hourly_funnel_rollups_for_merchant",
          {
            p_merchant_id: id,
            p_since: rollupSince,
            p_until: rollupUntil,
          },
        );
        if (merchantRollupError) {
          errors.push(`${id}: ${merchantRollupError.message}`);
          continue;
        }
        refreshed += Number(merchantRows ?? 0);
      }

      steps.hourly_rollups = {
        ok: errors.length === 0,
        partial: errors.length > 0 && errors.length < ids.length,
        merchants: ids.length,
        refreshed,
        since: rollupSince,
        errors,
      };
    }
  } catch (err) {
    steps.hourly_rollups = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      since: rollupSince,
    };
  }

  // Step 2: cart attribution retention. Isolated.
  const freshMerchantCutoff = cutoffIso(FRESH_MERCHANT_BACKFILL_DAYS);
  try {
    const { data: freshMerchants, error: freshMerchantError } = await admin
      .from("merchants")
      .select("id,created_at")
      .gte("created_at", freshMerchantCutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_FRESH_MERCHANT_BACKFILLS);

    if (freshMerchantError) {
      steps.fresh_merchant_rollups = {
        ok: false,
        error: freshMerchantError.message,
        cutoff: freshMerchantCutoff,
      };
    } else {
      const rows = ((freshMerchants ?? []) as FreshMerchantRow[]).filter((row) => row.created_at);
      let refreshed = 0;
      const errors: string[] = [];
      const nowIso = new Date().toISOString();

      for (const merchant of rows) {
        let cursor = new Date(merchant.created_at ?? freshMerchantCutoff).getTime();
        const end = new Date(nowIso).getTime();
        if (!Number.isFinite(cursor)) cursor = new Date(freshMerchantCutoff).getTime();

        while (cursor < end) {
          const chunkEnd = Math.min(
            cursor + FRESH_MERCHANT_BACKFILL_CHUNK_HOURS * 3600_000,
            end,
          );
          const { data: chunkRows, error: chunkError } = await admin.rpc(
            "eh_refresh_hourly_funnel_rollups_for_merchant",
            {
              p_merchant_id: merchant.id,
              p_since: new Date(cursor).toISOString(),
              p_until: new Date(chunkEnd).toISOString(),
            },
          );
          if (chunkError) {
            errors.push(`${merchant.id}: ${chunkError.message}`);
            break;
          }
          refreshed += Number(chunkRows ?? 0);
          cursor = chunkEnd;
        }
      }

      steps.fresh_merchant_rollups = {
        ok: errors.length === 0,
        merchants: rows.length,
        refreshed,
        cutoff: freshMerchantCutoff,
        errors,
      };
    }
  } catch (err) {
    steps.fresh_merchant_rollups = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      cutoff: freshMerchantCutoff,
    };
  }

  // Step 3: cart attribution retention. Isolated.
  const cartAttributionCutoff = cutoffIso(CART_ATTRIBUTION_RETENTION_DAYS);
  try {
    const { count: cartAttributionsDeleted, error: cartAttributionsError } = await admin
      .from("cart_attributions")
      .delete({ count: "exact" })
      .lt("last_seen_at", cartAttributionCutoff);
    if (cartAttributionsError) {
      steps.cart_attributions = {
        ok: false,
        error: cartAttributionsError.message,
        cutoff: cartAttributionCutoff,
      };
    } else {
      steps.cart_attributions = {
        ok: true,
        deleted: cartAttributionsDeleted ?? 0,
        cutoff: cartAttributionCutoff,
      };
    }
  } catch (err) {
    steps.cart_attributions = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      cutoff: cartAttributionCutoff,
    };
  }

  // Step 4: event retention policies. Each policy isolated.
  for (const policy of POLICIES) {
    const cutoff = cutoffIso(policy.retentionDays);
    let deleted = 0;
    let stepError: string | null = null;

    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      let selectQuery = admin
        .from("escape_events")
        .select("id")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(batchSize);

      if ("eventTypes" in policy) {
        selectQuery = selectQuery.in("event_type", [...policy.eventTypes]);
      }
      if ("excludeEventTypes" in policy) {
        selectQuery = selectQuery.not("event_type", "in", `(${policy.excludeEventTypes.join(",")})`);
      }

      const { data, error: selectError } = await selectQuery;
      if (selectError) {
        stepError = `select_failed: ${selectError.message}`;
        break;
      }

      const ids = ((data ?? []) as EscapeEventIdRow[]).map((row) => row.id);
      if (ids.length === 0) break;

      const { error: deleteError } = await admin.from("escape_events").delete().in("id", ids);
      if (deleteError) {
        stepError = `delete_failed: ${deleteError.message}`;
        break;
      }

      deleted += ids.length;
      if (ids.length < batchSize) break;
    }

    steps[policy.name] = stepError
      ? { ok: false, deleted, error: stepError, cutoff }
      : { ok: true, deleted, cutoff };
  }

  // Return success unless every step failed. Vercel surfaces 500s prominently
  // in cron history, so we still want a 500 when nothing succeeded — but a
  // single failing step shouldn't hide that retention + other policies ran.
  const stepValues = Object.values(steps);
  const anyOk = stepValues.some((step) => step.ok === true);
  const anyFailed = stepValues.some((step) => step.ok === false);

  return json(
    {
      ok: anyOk,
      partial: anyFailed,
      batchSize,
      maxBatches: MAX_BATCHES_PER_RUN,
      rollupRefreshHours: HOURLY_ROLLUP_REFRESH_HOURS,
      freshMerchantBackfillDays: FRESH_MERCHANT_BACKFILL_DAYS,
      freshMerchantBackfillChunkHours: FRESH_MERCHANT_BACKFILL_CHUNK_HOURS,
      steps,
    },
    anyOk ? 200 : 500,
  );
}
