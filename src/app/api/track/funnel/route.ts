import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_EVENTS = new Set([
  "product_viewed",
  "add_to_cart",
  "checkout_started",
  "purchase",
]);

const ROLLUP_FIELD: Record<string, string> = {
  product_viewed: "product_viewed",
  add_to_cart: "add_to_cart",
  checkout_started: "checkout_started",
  purchase: "purchases",
};

const JOIN_WINDOW_DAYS = 30;

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const params = url.searchParams;
  return processFunnel(
    {
      m: params.get("m") ?? "",
      e: params.get("e") ?? "",
      sy: params.get("sy") ?? null,
      v: params.get("v") ?? null,
      cy: params.get("cy") ?? null,
      oid: params.get("oid") ?? null,
      pid: params.get("pid") ?? null,
    },
    origin,
  );
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }
  return processFunnel(body, origin);
}

function json(payload: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

async function processFunnel(
  body: Record<string, unknown>,
  origin: string | null,
) {
  const merchantId = String(body.m ?? "");
  const eventType = String(body.e ?? "");
  const sy =
    typeof body.sy === "string" && body.sy.length > 0 && body.sy.length < 128
      ? body.sy
      : null;
  const orderId =
    typeof body.oid === "string" && body.oid.length > 0
      ? body.oid.slice(0, 128)
      : null;
  const currency =
    typeof body.cy === "string" && body.cy.length > 0
      ? body.cy.slice(0, 8)
      : null;
  const valueRaw = body.v;
  const valueNum =
    typeof valueRaw === "number"
      ? valueRaw
      : typeof valueRaw === "string"
        ? parseFloat(valueRaw)
        : NaN;
  const valueCents =
    Number.isFinite(valueNum) && valueNum > 0
      ? Math.round(valueNum * 100)
      : null;

  if (!UUID_RE.test(merchantId) || !ALLOWED_EVENTS.has(eventType) || !sy) {
    return json({ ok: false, error: "bad_input" }, 400, origin);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({ ok: true, joined: false, reason: "no_db" }, 200, origin);
  }

  // Join: find the most recent in-test impression for this Shopify visitor.
  // We require in_test=true so attribution is constrained to our paid-ad
  // population (matches the snippet's bucketing rule).
  const since = new Date(Date.now() - JOIN_WINDOW_DAYS * 86400_000).toISOString();
  const { data: imp } = await admin
    .from("escape_events")
    .select("bucket")
    .eq("merchant_id", merchantId)
    .eq("shopify_client_id", sy)
    .eq("event_type", "impression")
    .eq("in_test", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!imp) {
    // No matching impression by clientId. Don't drop the event — record it as
    // unattributed so the dashboard can show TRUE purchase volume from the
    // pixel even when our cookie chain breaks (Shopify checkout subdomain,
    // cookie wipe, multi-day journey, etc). bucket="a" arbitrary; in_test=false
    // makes the funnel RPC ignore these rows for A/B math.
    if (eventType === "purchase") {
      await admin.from("escape_events").insert({
        merchant_id: merchantId,
        event_type: "purchase",
        bucket: "a",
        in_test: false,
        shopify_client_id: sy,
        order_id: orderId,
        value_cents: valueCents,
        currency,
      });
    }
    return json(
      { ok: true, joined: false, reason: "no_impression" },
      200,
      origin,
    );
  }

  const bucket = imp.bucket === "b" ? "b" : "a";

  const { error } = await admin.from("escape_events").insert({
    merchant_id: merchantId,
    event_type: eventType,
    bucket,
    in_test: true,
    shopify_client_id: sy,
    order_id: eventType === "purchase" ? orderId : null,
    value_cents: valueCents,
    currency,
  });

  if (error) {
    if (!String(error.message).includes("duplicate")) {
      return json({ ok: false, error: "insert_failed" }, 500, origin);
    }
    return json(
      { ok: true, joined: true, deduped: true, bucket },
      200,
      origin,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const field = ROLLUP_FIELD[eventType];
  if (field) {
    await admin.rpc("eh_increment_rollup", {
      p_merchant_id: merchantId,
      p_day: today,
      p_bucket: bucket,
      p_field: field,
      p_revenue_cents: eventType === "purchase" ? (valueCents ?? 0) : 0,
    });
  }

  return json({ ok: true, joined: true, bucket, eventType }, 200, origin);
}
