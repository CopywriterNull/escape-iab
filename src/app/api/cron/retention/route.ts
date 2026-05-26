import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
// Fluid Compute ceiling. The rollup refresh RPC over 4h still aggregates
// hundreds of thousands of escape_events rows; without this it hits the
// default 60s timeout and the whole hour silently fails (see SquidHaus
// 3-day blackout 2026-05-23 → 2026-05-26).
export const maxDuration = 300;

type EscapeEventIdRow = { id: string };

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
  const rollupSince = new Date(Date.now() - HOURLY_ROLLUP_REFRESH_HOURS * 3600_000).toISOString();
  try {
    const { data: rollupRows, error: rollupError } = await admin.rpc(
      "eh_refresh_hourly_funnel_rollups",
      {
        p_since: rollupSince,
        p_until: new Date().toISOString(),
      },
    );
    if (rollupError) {
      steps.hourly_rollups = {
        ok: false,
        error: rollupError.message,
        code: rollupError.code,
        since: rollupSince,
      };
    } else {
      steps.hourly_rollups = {
        ok: true,
        refreshed: Number(rollupRows ?? 0),
        since: rollupSince,
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

  // Step 3: event retention policies. Each policy isolated.
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
      steps,
    },
    anyOk ? 200 : 500,
  );
}
