// Admin-only endpoint that fetches a target URL with an IG-iOS UA and
// inspects the HTML for the EscapeHatch install tag. Answers:
//   1. Is the snippet present at all?
//   2. Is it pointed at the expected merchant ID?
//   3. Does it have async/defer (the recurring failure mode)?
//   4. Is it in <head> or further down?
//   5. Are there any STRAY tags for a different merchant ID?
//
// We do this server-side because most storefronts block cross-origin
// browser fetches of HTML (and we want to send a real IG UA so any
// UA-varying CDN serves the same body it would to a paid IG visitor).

import { getSupabaseServer } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

// Realistic IG iOS UA — what a paid Meta ad click actually sees on the
// merchant's storefront. Pinned to one string so we don't drift.
const IG_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 326.0.0.0.0";

// Match `<script ... src="...getescapehatch.com/s/<uuid>.js..."></script>`.
// Case-insensitive, allows extra attributes in any order, allows ?v= and
// other querystrings on the src. We extract the full tag, the matched
// merchant id, and async/defer flags from the attribute list.
const SCRIPT_TAG_RE =
  /<script\b[^>]*\bsrc\s*=\s*["']\s*https?:\/\/(?:www\.)?getescapehatch\.com\/s\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.js[^"']*["'][^>]*>\s*<\/script>/gi;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BYTES = 3_000_000; // 3MB cap. Andar's full HTML is ~1.3MB; this leaves headroom.
const TIMEOUT_MS = 9_000;

type Match = {
  tag: string;
  merchantId: string;
  hasAsync: boolean;
  hasDefer: boolean;
  position: "head" | "body" | "unknown";
};

function inspectTag(tag: string): { hasAsync: boolean; hasDefer: boolean } {
  // async/defer are valueless boolean attributes — match them
  // independently of any quotes/spaces around the value.
  const hasAsync = /\basync(?:\s*=\s*(?:"[^"]*"|'[^']*'|\S+))?[\s>]/i.test(tag);
  const hasDefer = /\bdefer(?:\s*=\s*(?:"[^"]*"|'[^']*'|\S+))?[\s>]/i.test(tag);
  return { hasAsync, hasDefer };
}

function positionInDocument(html: string, tagIdx: number): "head" | "body" | "unknown" {
  // Naive but good enough — find /head close tag, anything before it is head.
  const headEnd = html.toLowerCase().indexOf("</head>");
  if (headEnd < 0) return "unknown";
  return tagIdx < headEnd ? "head" : "body";
}

export async function POST(req: NextRequest) {
  // Admin gate — auth.getUser via the request's cookies.
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return jsonError("backend_not_configured", 503);
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return jsonError("forbidden", 403);
  }

  let body: { url?: string; merchantId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("bad_json", 400);
  }
  const rawUrl = String(body.url ?? "").trim();
  const merchantId = String(body.merchantId ?? "").trim().toLowerCase();
  if (!rawUrl) return jsonError("missing_url", 400);
  if (!UUID_RE.test(merchantId)) return jsonError("bad_merchant_id", 400);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return jsonError("malformed_url", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return jsonError("unsupported_protocol", 400);
  }

  // Fetch with IG iOS UA + a sensible timeout. Treat any non-2xx as a
  // soft failure so the operator still gets some signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  let html = "";
  let fetchedBytes = 0;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "user-agent": IG_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({
      ok: false,
      stage: "fetch",
      error: msg,
      url: rawUrl,
    });
  }

  // Stream the body with a hard byte cap so a hostile/huge response
  // can't OOM the function.
  try {
    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const chunks: string[] = [];
      while (fetchedBytes < MAX_BYTES) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          fetchedBytes += value.byteLength;
          chunks.push(decoder.decode(value, { stream: true }));
          if (fetchedBytes >= MAX_BYTES) {
            try {
              await reader.cancel();
            } catch {}
            break;
          }
        }
      }
      chunks.push(decoder.decode());
      html = chunks.join("");
    } else {
      html = await res.text();
      fetchedBytes = html.length;
    }
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({
      ok: false,
      stage: "read_body",
      error: msg,
      status: res.status,
      url: rawUrl,
      finalUrl: res.url,
    });
  }
  clearTimeout(timer);

  // Scan for every EscapeHatch script tag in the body.
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  SCRIPT_TAG_RE.lastIndex = 0;
  while ((m = SCRIPT_TAG_RE.exec(html)) !== null) {
    const tag = m[0];
    const mid = m[1].toLowerCase();
    const { hasAsync, hasDefer } = inspectTag(tag);
    matches.push({
      tag,
      merchantId: mid,
      hasAsync,
      hasDefer,
      position: positionInDocument(html, m.index),
    });
  }

  const expected = matches.find((x) => x.merchantId === merchantId) ?? null;
  const wrongMerchant = matches.filter((x) => x.merchantId !== merchantId);

  return Response.json({
    ok: true,
    url: rawUrl,
    finalUrl: res.url,
    status: res.status,
    bytesRead: fetchedBytes,
    truncated: fetchedBytes >= MAX_BYTES,
    expectedMerchantId: merchantId,
    snippetFound: !!expected,
    tag: expected?.tag ?? null,
    hasAsync: expected?.hasAsync ?? false,
    hasDefer: expected?.hasDefer ?? false,
    position: expected?.position ?? null,
    wrongMerchantTags: wrongMerchant.map((x) => ({
      tag: x.tag,
      merchantId: x.merchantId,
      hasAsync: x.hasAsync,
      hasDefer: x.hasDefer,
      position: x.position,
    })),
    // True if any tag was found, regardless of which merchant.
    anyEscapeHatchTag: matches.length > 0,
  });
}

function jsonError(error: string, status: number) {
  return Response.json({ ok: false, error }, { status });
}
