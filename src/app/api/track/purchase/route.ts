import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
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

// GET path for Shopify Custom Pixel beacons. Query-param form lets us bypass
// preflight/content-type hassles in the pixel sandbox.
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const body = {
    m: url.searchParams.get("m") ?? "",
    sy: url.searchParams.get("sy") ?? null,
    v: url.searchParams.get("v") ?? null,
    cy: url.searchParams.get("cy") ?? null,
    oid: url.searchParams.get("oid") ?? null,
    ts: url.searchParams.get("ts") ?? null,
  };
  return processPurchase(body as Record<string, unknown>, origin);
}

// Window for joining a purchase to a prior impression by Shopify clientId.
// 30 days matches the eh_b cookie max-age and Shopify's _shopify_y persistence.
const JOIN_WINDOW_DAYS = 30;

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(origin) },
    });
  }
  return processPurchase(body, origin);
}

async function processPurchase(
  body: Record<string, unknown>,
  origin: string | null,
) {
  const merchantId = String(body.m ?? "");
  const sy = typeof body.sy === "string" && body.sy.length > 0 ? body.sy : null;
  const orderId = typeof body.oid === "string" && body.oid.length > 0 ? body.oid : null;
  const currency = typeof body.cy === "string" ? body.cy.slice(0, 8) : null;
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

  if (!UUID_RE.test(merchantId) || !sy) {
    return new Response(JSON.stringify({ ok: false, error: "bad_input" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(origin) },
    });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[eh-purchase]", { merchantId, sy, orderId, valueCents, currency });
    }
    return new Response(JSON.stringify({ ok: true, joined: false, reason: "no_db" }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(origin) },
    });
  }

  // Look up the most recent impression for this Shopify visitor; that gives us
  // the bucket the visitor was assigned at first contact.
  const since = new Date(Date.now() - JOIN_WINDOW_DAYS * 86400_000).toISOString();
  const { data: imp } = await admin
    .from("escape_events")
    .select("bucket")
    .eq("merchant_id", merchantId)
    .eq("shopify_client_id", sy)
    .eq("event_type", "impression")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!imp) {
    // No matching impression — visitor wasn't part of our test population
    // (came in via desktop / non-mobile / before snippet was installed).
    return new Response(
      JSON.stringify({ ok: true, joined: false, reason: "no_impression" }),
      {
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders(origin) },
      },
    );
  }

  const bucket = imp.bucket === "b" ? "b" : "a";

  // Insert purchase event. ON CONFLICT (merchant_id, order_id) WHERE event_type='purchase'
  // dedups if the pixel fires twice for the same order.
  const { error } = await admin.from("escape_events").insert({
    merchant_id: merchantId,
    event_type: "purchase",
    bucket,
    shopify_client_id: sy,
    order_id: orderId,
    value_cents: valueCents,
    currency,
  });

  if (error) {
    // Most likely a dedup violation. Treat as success.
    if (!String(error.message).includes("duplicate")) {
      return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders(origin) },
      });
    }
    return new Response(
      JSON.stringify({ ok: true, joined: true, deduped: true, bucket }),
      {
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders(origin) },
      },
    );
  }

  // Bump rollup. Pass revenue in cents so the rollup tracks both count + sum.
  const today = new Date().toISOString().slice(0, 10);
  await admin.rpc("eh_increment_rollup", {
    p_merchant_id: merchantId,
    p_day: today,
    p_bucket: bucket,
    p_field: "purchases",
    p_revenue_cents: valueCents ?? 0,
  });

  return new Response(JSON.stringify({ ok: true, joined: true, bucket }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}
