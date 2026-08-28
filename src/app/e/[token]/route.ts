import { NextResponse, type NextRequest } from "next/server";

// Escape hop landing route.
//
// x-web-search:// hands Safari a bare string and Safari decides whether it is a
// URL or a search phrase. Anything with ? & or # in it loses that coin flip —
// an inline query reads as a search phrase, and a # fragment is swallowed
// before Safari ever sees it. A path-only URL has no special characters at all,
// so it always parses as a URL.
//
// So the escape sends `getescapehatch.com/e/<token>` and we 302 from here to the
// real destination with every param restored. One extra hop, zero dependence on
// Safari's URL-vs-search heuristic.
//
// Token is base64url of the absolute destination URL. It is self-contained (no
// DB lookup), so this route stays fast and works before any merchant record
// exists.

export const dynamic = "force-dynamic";

function decodeToken(token: string): string | null {
  try {
    let b = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const url = Buffer.from(b, "base64").toString("utf8");
    const parsed = new URL(url);
    // Only ever bounce to http(s). A token is attacker-supplyable, so refuse
    // javascript:, data:, and app schemes outright — this route must never be
    // usable as an open redirect into a non-web scheme.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const dest = decodeToken(token);
  if (!dest) {
    return NextResponse.json({ error: "bad token" }, { status: 400 });
  }
  return NextResponse.redirect(dest, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      // Keep the original ad referrer off the merchant request; the params on
      // the destination carry everything attribution needs.
      "referrer-policy": "no-referrer",
    },
  });
}
