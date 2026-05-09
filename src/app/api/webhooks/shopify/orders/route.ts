import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

// Shopify Order Created/Paid webhook handler.
//
// Configure in G FUEL Shopify admin:
//   Settings → Notifications → Webhooks → Create webhook
//   Event: "Order paid" (or "Order created")
//   Format: JSON
//   URL: https://escape-iab.vercel.app/api/webhooks/shopify/orders
//   API version: latest
//   After creating, copy the webhook secret into Vercel env:
//     SHOPIFY_WEBHOOK_SECRET=<value>
//
// This is the authoritative purchase-attribution path. Bypasses the pixel
// cookie nonsense entirely. Server-to-server. We extract `eh_sid` from
// `landing_site` (the URL the visitor first hit), lookup the bucket from
// the original impression, and write a purchase event with proper attribution.

const JOIN_WINDOW_DAYS = 30;

function verifyHmac(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(hmacHeader);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function extractEhSid(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get("eh_sid");
    return v && v.length > 0 && v.length < 64 ? v : null;
  } catch {
    return null;
  }
}

function extractFbclid(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get("fbclid");
    return v && v.length > 0 && v.length < 512 ? v : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const merchantId = process.env.SHOPIFY_WEBHOOK_MERCHANT_ID;

  if (!secret || !merchantId) {
    return new Response(
      JSON.stringify({ ok: false, error: "webhook_not_configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyHmac(rawBody, hmacHeader, secret)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_hmac" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let order: Record<string, unknown>;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const orderId = (order.id != null ? String(order.id) : null) as string | null;
  const totalPrice = order.total_price != null ? parseFloat(String(order.total_price)) : NaN;
  const valueCents =
    Number.isFinite(totalPrice) && totalPrice > 0
      ? Math.round(totalPrice * 100)
      : null;
  const currency = typeof order.currency === "string" ? order.currency.slice(0, 8) : null;
  const landingSite = typeof order.landing_site === "string" ? order.landing_site : null;
  const referringSite = typeof order.referring_site === "string" ? order.referring_site : null;
  const ehSid = extractEhSid(landingSite) ?? extractEhSid(referringSite);
  const fbclid = extractFbclid(landingSite) ?? extractFbclid(referringSite);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return new Response(JSON.stringify({ ok: true, joined: false, reason: "no_db" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Try eh_sid first (precise); fbclid as fallback (less reliable but works
  // for visitors who didn't make it through escape but still came via paid IG).
  const since = new Date(Date.now() - JOIN_WINDOW_DAYS * 86400_000).toISOString();
  let imp: { bucket: "a" | "b" } | null = null;
  if (ehSid) {
    const { data } = await admin
      .from("escape_events")
      .select("bucket")
      .eq("merchant_id", merchantId)
      .eq("eh_sid", ehSid)
      .eq("event_type", "impression")
      .eq("in_test", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    imp = data as { bucket: "a" | "b" } | null;
  }
  if (!imp && fbclid) {
    const { data } = await admin
      .from("escape_events")
      .select("bucket")
      .eq("merchant_id", merchantId)
      .eq("fbclid", fbclid)
      .eq("event_type", "impression")
      .eq("in_test", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    imp = data as { bucket: "a" | "b" } | null;
  }

  // Insert purchase. If imp found → in_test=true with bucket. Otherwise
  // in_test=false so the dashboard's unattributed counter shows it.
  const inTest = imp != null;
  const bucket = imp?.bucket === "b" ? "b" : "a";

  const { error } = await admin.from("escape_events").insert({
    merchant_id: merchantId,
    event_type: "purchase",
    bucket,
    in_test: inTest,
    eh_sid: ehSid,
    fbclid,
    order_id: orderId,
    value_cents: valueCents,
    currency,
    url: landingSite ? landingSite.slice(0, 1024) : null,
    referrer: referringSite ? referringSite.slice(0, 1024) : null,
  });

  // Dedup-on-conflict for purchases: same merchant + order_id should be unique.
  if (error && !String(error.message).includes("duplicate")) {
    return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  if (inTest) {
    const today = new Date().toISOString().slice(0, 10);
    await admin.rpc("eh_increment_rollup", {
      p_merchant_id: merchantId,
      p_day: today,
      p_bucket: bucket,
      p_field: "purchases",
      p_revenue_cents: valueCents ?? 0,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, joined: inTest, bucket: inTest ? bucket : null, eh_sid: ehSid, has_fbclid: !!fbclid }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
