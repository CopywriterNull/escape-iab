import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

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
  const results: Record<string, { deleted: number; cutoff: string }> = {};

  const rollupSince = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: rollupRows, error: rollupError } = await admin.rpc(
    "eh_refresh_hourly_funnel_rollups",
    {
      p_since: rollupSince,
      p_until: new Date().toISOString(),
    },
  );
  if (rollupError) {
    return json(
      {
        ok: false,
        error: "hourly_rollup_refresh_failed",
        details: rollupError.message,
      },
      500,
    );
  }

  const cartAttributionCutoff = cutoffIso(CART_ATTRIBUTION_RETENTION_DAYS);
  const { count: cartAttributionsDeleted, error: cartAttributionsError } = await admin
    .from("cart_attributions")
    .delete({ count: "exact" })
    .lt("last_seen_at", cartAttributionCutoff);
  if (cartAttributionsError) {
    return json(
      {
        ok: false,
        error: "cart_attribution_delete_failed",
        details: cartAttributionsError.message,
      },
      500,
    );
  }
  results.cart_attributions = {
    deleted: cartAttributionsDeleted ?? 0,
    cutoff: cartAttributionCutoff,
  };

  for (const policy of POLICIES) {
    const cutoff = cutoffIso(policy.retentionDays);
    let deleted = 0;

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
        return json(
          {
            ok: false,
            error: "select_failed",
            policy: policy.name,
            details: selectError.message,
            results,
          },
          500,
        );
      }

      const ids = ((data ?? []) as EscapeEventIdRow[]).map((row) => row.id);
      if (ids.length === 0) break;

      const { error: deleteError } = await admin.from("escape_events").delete().in("id", ids);
      if (deleteError) {
        return json(
          {
            ok: false,
            error: "delete_failed",
            policy: policy.name,
            details: deleteError.message,
            results,
          },
          500,
        );
      }

      deleted += ids.length;
      if (ids.length < batchSize) break;
    }

    results[policy.name] = { deleted, cutoff };
  }

  return json({
    ok: true,
    batchSize,
    maxBatches: MAX_BATCHES_PER_RUN,
    hourlyRollups: { refreshed: Number(rollupRows ?? 0), since: rollupSince },
    results,
  });
}
