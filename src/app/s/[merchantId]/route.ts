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
  let paidOnly = true;
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
        paidOnly = m.paid_only !== false;
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
  });
  const body = await obfuscateSnippet(raw);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      // Short edge cache so we can ship fixes fast (e.g., when IG patches).
      "cache-control": "public, max-age=300, s-maxage=300",
      "x-eh-version": CURRENT_VERSION,
      "access-control-allow-origin": "*",
    },
  });
}
