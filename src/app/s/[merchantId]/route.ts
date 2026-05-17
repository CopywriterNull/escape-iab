import { buildSnippet, CURRENT_VERSION } from "@/lib/snippet";
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
  const raw = buildSnippet({
    merchantId,
    ingestUrl,
    version: CURRENT_VERSION,
    abEnabled,
    fallbackButton,
    escapeEnabled,
    fallbackText,
    paidOnly,
    abSplitPct,
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
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "x-eh-version": CURRENT_VERSION,
      "access-control-allow-origin": "*",
    },
  });
}
