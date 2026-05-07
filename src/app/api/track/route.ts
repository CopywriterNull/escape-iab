import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import { type NextRequest } from "next/server";

const ALLOWED_EVENTS = new Set([
  "impression",
  "iab_detected",
  "escape_attempt",
  "escape_skipped",
  "fallback_shown",
  "fallback_clicked",
]);
const ALLOWED_KINDS = new Set([
  "instagram",
  "facebook",
  "messenger",
  "tiktok",
  "snapchat",
  "pinterest",
  "line",
  "wechat",
  "webview",
]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLLUP_FIELD: Record<string, string> = {
  impression: "impressions",
  iab_detected: "iab_detected",
  escape_attempt: "escape_attempts",
  escape_skipped: "escape_skipped",
  fallback_shown: "fallback_shown",
  fallback_clicked: "fallback_clicked",
};

function ipFrom(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    ""
  );
}

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

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

  const merchantId = String(body.m ?? "");
  const eventType = String(body.t ?? "");
  const bucket = body.b === "b" ? "b" : "a";
  const isIg = body.ig === 1 || body.ig === true;
  const rawKind = typeof body.k === "string" ? body.k : null;
  const iabKind = rawKind && ALLOWED_KINDS.has(rawKind) ? rawKind : null;
  const url = typeof body.u === "string" ? body.u.slice(0, 1024) : null;
  const referrer = typeof body.r === "string" ? body.r.slice(0, 1024) : null;

  if (!UUID_RE.test(merchantId) || !ALLOWED_EVENTS.has(eventType)) {
    return new Response(JSON.stringify({ ok: false, error: "bad_input" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(origin) },
    });
  }

  const ip = ipFrom(req);
  const ipHash = ip
    ? createHash("sha256")
        .update(`${ip}:${process.env.IP_HASH_SALT ?? "eh"}`)
        .digest("hex")
        .slice(0, 16)
    : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;

  const admin = getSupabaseAdmin();
  if (admin) {
    await admin.from("escape_events").insert({
      merchant_id: merchantId,
      event_type: eventType,
      bucket,
      is_ig: Boolean(isIg),
      iab_kind: iabKind,
      url,
      referrer,
      user_agent: userAgent,
      ip_hash: ipHash,
    });

    const today = new Date().toISOString().slice(0, 10);
    const field = ROLLUP_FIELD[eventType];
    if (field) {
      await admin.rpc("eh_increment_rollup", {
        p_merchant_id: merchantId,
        p_day: today,
        p_bucket: bucket,
        p_field: field,
      });
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log("[eh-track]", { merchantId, eventType, bucket, iabKind, isIg, url });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}
