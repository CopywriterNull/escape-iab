import { createHmac, timingSafeEqual } from "node:crypto";
import { isMerchantDisabled } from "@/lib/merchant-state";
import { normalizeShopifyOrderRevenue } from "@/lib/revenue";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

// Shopify Order Created/Paid webhook handler.
//
// Configure in G FUEL Shopify admin:
//   Settings → Notifications → Webhooks → Create webhook
//   Event: "Order paid" (or "Order created")
//   Format: JSON
//   URL: https://getescapehatch.com/api/webhooks/shopify/orders
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

function paramFromUrl(url: string | null, name: string, max: number): string | null {
  if (!url) return null;
  try {
    // Shopify sometimes sends path-only like "/cart/c/...?key=..." — make absolute.
    const abs = url.startsWith("http") ? url : `https://example.com${url}`;
    const u = new URL(abs);
    const v = u.searchParams.get(name);
    return v && v.length > 0 && v.length < max ? v : null;
  } catch {
    return null;
  }
}

function valueFromAttrs(attrs: unknown, key: string): string | null {
  if (!attrs) return null;
  try {
    if (Array.isArray(attrs)) {
      for (const a of attrs as { name?: string; key?: string; value?: string }[]) {
        const k = a?.name ?? a?.key;
        if (k === key && typeof a.value === "string" && a.value) return a.value;
      }
    } else if (typeof attrs === "object") {
      const v = (attrs as Record<string, unknown>)[key];
      if (typeof v === "string" && v) return v;
    }
  } catch {}
  return null;
}

// Look across every place Shopify might carry our markers.
function findKey(order: Record<string, unknown>, key: string, max: number): string | null {
  // 1. URL params on landing_site / referring_site
  const ls = typeof order.landing_site === "string" ? order.landing_site : null;
  const rs = typeof order.referring_site === "string" ? order.referring_site : null;
  let v = paramFromUrl(ls, key, max) ?? paramFromUrl(rs, key, max);
  if (v) return v;
  // 2. note_attributes — array of {name, value}. Shopify carries
  //    cart.attributes here for most order paths.
  v = valueFromAttrs(order.note_attributes, key);
  if (v) return v;
  // 3. attributes — newer checkout API.
  v = valueFromAttrs(order.attributes, key);
  if (v) return v;
  // 4. checkout.attributes / checkout.note_attributes nested.
  const checkout = order.checkout as Record<string, unknown> | undefined;
  if (checkout) {
    v = valueFromAttrs(checkout.attributes, key) ?? valueFromAttrs(checkout.note_attributes, key);
    if (v) return v;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const globalSecret = process.env.SHOPIFY_WEBHOOK_SECRET ?? null;
  const fallbackMerchantId = process.env.SHOPIFY_WEBHOOK_MERCHANT_ID;

  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

  // Multi-tenant routing: resolve the merchant (and its per-store webhook
  // secret) from the shop-domain header BEFORE verifying HMAC. Shopify signs
  // Notifications-created webhooks with a per-STORE secret, so a single global
  // secret can't validate every store (this is why Huppy's orders 401'd).
  // The header is untrusted — it only picks which secret to TRY; the HMAC check
  // below is still the real auth, so a forged domain can't inject orders
  // without also forging a valid signature.
  const shopDomain = req.headers.get("x-shopify-shop-domain")?.toLowerCase() ?? null;
  const admin = getSupabaseAdmin();
  let merchantId: string | null = null;
  let merchantSecret: string | null = null;
  if (shopDomain && admin) {
    const { data } = await admin
      .from("merchants")
      .select("id,shopify_webhook_secret")
      .eq("shopify_domain", shopDomain)
      .maybeSingle();
    if (data?.id) {
      merchantId = data.id as string;
      merchantSecret = (data.shopify_webhook_secret as string | null) ?? null;
    }
  }

  // Verify against the merchant's own Notifications secret first, then the
  // global app secret (app-created webhooks / legacy single-merchant install).
  const candidateSecrets = [merchantSecret, globalSecret].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  if (candidateSecrets.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "webhook_not_configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  if (!candidateSecrets.some((s) => verifyHmac(rawBody, hmacHeader, s))) {
    return new Response(JSON.stringify({ ok: false, error: "bad_hmac" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  if (!merchantId) merchantId = fallbackMerchantId ?? null;
  if (!merchantId) {
    return new Response(
      JSON.stringify({ ok: false, error: "unknown_shop_domain", shopDomain }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
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

  // Filter to online-storefront orders only. Excludes subscription orders
  // (Recharge etc.), POS retail, draft/manual orders, B2B wholesale —
  // matches what merchants typically see as "Online store" AOV/CVR in
  // Shopify Analytics, Triple Whale, Northbeam.
  const sourceName = typeof order.source_name === "string" ? order.source_name : null;
  const isOnlineStore = sourceName === "web" || sourceName === null;
  if (!isOnlineStore) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: "non_web_source", source: sourceName }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const orderId = (order.id != null ? String(order.id) : null) as string | null;
  const revenue = normalizeShopifyOrderRevenue(order);
  const landingSite = typeof order.landing_site === "string" ? order.landing_site : null;
  const referringSite = typeof order.referring_site === "string" ? order.referring_site : null;
  const cartToken = typeof order.cart_token === "string" ? order.cart_token : null;
  const ehSid = findKey(order, "eh_sid", 64);
  const fbclid = findKey(order, "fbclid", 512);

  // Diagnostic: opt in briefly when debugging Shopify payload shape.
  if (process.env.NODE_ENV !== "production" || process.env.EH_DEBUG_SHOPIFY_WEBHOOK === "1") {
    console.log("[shopify-webhook]", {
      orderId,
      cart_token: cartToken,
      checkout_token: typeof order.checkout_token === "string" ? order.checkout_token : null,
      landing_site: landingSite,
      has_note_attributes: Array.isArray(order.note_attributes) ? (order.note_attributes as unknown[]).length : 0,
      has_attributes: Array.isArray(order.attributes) ? (order.attributes as unknown[]).length : 0,
      eh_sid: ehSid,
      fbclid: fbclid ? "yes" : "no",
    });
  }

  if (!admin) {
    return new Response(JSON.stringify({ ok: true, joined: false, reason: "no_db" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (await isMerchantDisabled(admin, merchantId)) {
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: "merchant_disabled" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Multi-key join, in order of precision:
  //   1. cart_token — Shopify-native, survives every checkout flow including
  //      Shop Pay / Apple Pay / returning customers / subscriptions. Most
  //      reliable. Set on cart_check events when our snippet touched the cart.
  //   2. eh_sid — works when landing_site URL preserved our marker.
  //   3. fbclid — fallback for paid Meta clicks where neither above survived.
  const since = new Date(Date.now() - JOIN_WINDOW_DAYS * 86400_000).toISOString();
  let imp: { bucket: "a" | "b"; iab_kind: string | null } | null = null;
  let joinMethod: string | null = null;
  if (cartToken) {
    const { data: cartAttr } = await admin
      .from("cart_attributions")
      .select("bucket,iab_kind")
      .eq("merchant_id", merchantId)
      .eq("cart_token", cartToken)
      .eq("in_test", true)
      .gte("last_seen_at", since)
      .maybeSingle();
    imp = cartAttr as { bucket: "a" | "b"; iab_kind: string | null } | null;
    if (imp) joinMethod = "cart_attribution";

    if (!imp) {
      const { data } = await admin
        .from("escape_events")
        .select("bucket,iab_kind")
        .eq("merchant_id", merchantId)
        .eq("cart_token", cartToken)
        .eq("in_test", true)
        .neq("event_type", "purchase")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      imp = data as { bucket: "a" | "b"; iab_kind: string | null } | null;
      if (imp) joinMethod = "cart_token_legacy";
    }
  }
  if (!imp && ehSid) {
    const { data } = await admin
      .from("escape_events")
      .select("bucket,iab_kind")
      .eq("merchant_id", merchantId)
      .eq("eh_sid", ehSid)
      .eq("event_type", "impression")
      .eq("in_test", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    imp = data as { bucket: "a" | "b"; iab_kind: string | null } | null;
    if (imp) joinMethod = "eh_sid";
  }
  if (!imp && fbclid) {
    const { data } = await admin
      .from("escape_events")
      .select("bucket,iab_kind")
      .eq("merchant_id", merchantId)
      .eq("fbclid", fbclid)
      .eq("event_type", "impression")
      .eq("in_test", true)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    imp = data as { bucket: "a" | "b"; iab_kind: string | null } | null;
    if (imp) joinMethod = "fbclid";
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
    iab_kind: imp?.iab_kind ?? null,
    eh_sid: ehSid,
    fbclid,
    cart_token: cartToken,
    order_id: orderId,
    value_cents: revenue.valueCents,
    currency: revenue.currency,
    original_value_cents: revenue.originalValueCents,
    original_currency: revenue.originalCurrency,
    value_currency: revenue.valueCurrency,
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
  if (error && String(error.message).includes("duplicate") && orderId) {
    await admin
      .from("escape_events")
      .update({
        value_cents: revenue.valueCents,
        currency: revenue.currency,
        original_value_cents: revenue.originalValueCents,
        original_currency: revenue.originalCurrency,
        value_currency: revenue.valueCurrency,
      })
      .eq("merchant_id", merchantId)
      .eq("event_type", "purchase")
      .eq("order_id", orderId);
  }

  if (inTest && !error) {
    const today = new Date().toISOString().slice(0, 10);
    await admin.rpc("eh_increment_rollup", {
      p_merchant_id: merchantId,
      p_day: today,
      p_bucket: bucket,
      p_field: "purchases",
      p_revenue_cents: revenue.valueCents ?? 0,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      joined: inTest,
      bucket: inTest ? bucket : null,
      method: joinMethod,
      had_cart_token: !!cartToken,
      had_eh_sid: !!ehSid,
      had_fbclid: !!fbclid,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
