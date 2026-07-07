import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Only same-origin paths in `next` — anything that resolves off-origin
  // (absolute URLs, protocol-relative "//host", backslash tricks like
  // "/\evil.com" that the URL parser normalizes to a host) would make the
  // auth callback an open redirect. Resolve against our origin and keep
  // the result only when the origin is unchanged.
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  let next = "/dashboard";
  try {
    const candidate = new URL(rawNext, url.origin);
    if (candidate.origin === url.origin) {
      next = candidate.pathname + candidate.search;
    }
  } catch {
    // Unparseable next → keep the /dashboard fallback.
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=not_configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
