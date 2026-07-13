import {
  buildSnippet,
  buildAttributionOnlySnippet,
  isInAppBrowserUA,
  CURRENT_VERSION,
  parseAllowedDomains,
} from "@/lib/snippet";
import { obfuscateSnippet } from "@/lib/obfuscate";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function originFrom(req: NextRequest): string {
  const proto =
    req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> },
) {
  const { merchantId: rawId } = await params;
  const merchantId = rawId.replace(/\.js$/i, "");
  const isValidShape = UUID_RE.test(merchantId);

  // Resolve merchant settings if DB available; else fall back to defaults.
  // Select * defensively so pending migrations on newer columns can't take
  // the snippet endpoint offline before the schema catches up.
  let abEnabled = true;
  let fallbackButton = true;
  let escapeEnabled = true;
  let fallbackText: string | null = null;
  // Default mode = escape every Meta IAB visitor (organic + paid). Brands
  // that want to restrict to paid clicks only must opt in via settings.
  let paidOnly = false;
  // Default A/B split = 50/50 (legacy). Per-merchant override via the
  // ab_split_pct column (migration 0016). Clamped server-side too.
  let abSplitPct = 50;
  let escapeInstagram = true;
  let escapeThreads = false;
  let escapeFacebook = false;
  let escapeMessenger = false;
  let escapeDiscord = false;
  let allowedDomains: string[] = [];
  let valid = isValidShape;
  if (isValidShape) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin
        .from("merchants")
        .select("*")
        .eq("id", merchantId)
        .maybeSingle();
      if (data) {
        const m = data as Record<string, unknown>;
        abEnabled = m.ab_enabled !== false;
        fallbackButton = m.fallback_button !== false;
        // The four below are no-op defaults until the matching migration
        // (0011 / 0012) is applied — `undefined` reads as the safe default.
        escapeEnabled = m.escape_enabled !== false;
        // Gated signup: pending merchants must never serve a live snippet, even
        // if escape_enabled were flipped by other means. Belt for the RLS brace.
        if (m.status === "pending") escapeEnabled = false;
        fallbackText = (m.fallback_text as string | null | undefined) ?? null;
        // Only an explicit `true` in the DB keeps paid-only on. Missing
        // column or `false`/null reads as escape-all (the new default).
        paidOnly = m.paid_only === true;
        // ab_split_pct lands as a number when migration 0016 is applied;
        // until then, fall back to 50 so the snippet keeps serving.
        const rawSplit = m.ab_split_pct;
        if (typeof rawSplit === "number" && Number.isFinite(rawSplit)) {
          abSplitPct = Math.min(99, Math.max(1, Math.round(rawSplit)));
        }
        // Platform targeting. Missing columns read as defaults so the route
        // keeps serving while migrations roll forward.
        escapeInstagram = m.escape_instagram !== false;
        escapeThreads = m.escape_threads === true;
        escapeFacebook = m.escape_facebook === true;
        escapeMessenger = m.escape_messenger === true;
        escapeDiscord = m.escape_discord === true;
        // Hostname binding allowlist. Empty when merchant.domain is null/
        // blank — preserves the existing "works anywhere" behavior for F&F
        // installs and pre-domain merchants.
        allowedDomains = parseAllowedDomains(m.domain as string | null | undefined);
      } else {
        valid = false;
      }
    }
  }

  if (!valid) {
    return new Response(`/* EscapeHatch: unknown merchant */`, {
      status: 404,
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "public, max-age=60",
      },
    });
  }

  const ingestUrl = `${originFrom(req)}/api/track`;

  // UA gate: serve the full escape payload (scheme, IAB detection, bucketing)
  // ONLY to in-app-browser UAs. Everyone else — desktop, bots, scanners, and
  // anyone who copies the storefront <script> and pastes it into an LLM — gets
  // the attribution-only stub with nothing to reverse-engineer. A real IG/FB
  // visitor always matches the UA and gets the full payload, so the escape can
  // never regress. Disable with EH_UA_GATE=0 to serve full to everyone (revert).
  const ua = req.headers.get("user-agent") ?? "";
  const gateEnabled = process.env.EH_UA_GATE !== "0";
  const serveFull = !gateEnabled || isInAppBrowserUA(ua);

  const raw = serveFull
    ? buildSnippet({
        merchantId,
        ingestUrl,
        version: CURRENT_VERSION,
        abEnabled,
        fallbackButton,
        escapeEnabled,
        fallbackText,
        paidOnly,
        abSplitPct,
        escapeInstagram,
        escapeThreads,
        escapeFacebook,
        escapeMessenger,
        escapeDiscord,
        allowedDomains,
      })
    : buildAttributionOnlySnippet({
        merchantId,
        ingestUrl,
        version: CURRENT_VERSION,
        allowedDomains,
      });
  const body = await obfuscateSnippet(raw);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      // 1 hour edge cache. Settings changes trigger explicit revalidation
      // from updateMerchantSettings + admin actions, so propagation stays
      // fast despite the longer TTL. Saves ~12x function invocations on
      // /s/[id].js at steady state vs the previous 5-min cache.
      // Vary on UA because the body now depends on it — browsers still cache
      // their own variant (same UA every request); only the shared CDN cache
      // splits by UA class, and the payload is tiny.
      "cache-control": "public, max-age=3600, s-maxage=3600",
      vary: "User-Agent",
      "x-eh-version": CURRENT_VERSION,
      "x-eh-payload": serveFull ? "full" : "stub",
      "access-control-allow-origin": "*",
    },
  });
}
