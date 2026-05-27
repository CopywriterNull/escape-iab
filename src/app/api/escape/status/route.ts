import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isMerchantDisabled } from "@/lib/merchant-state";
import { type NextRequest } from "next/server";

// Tight remote-kill endpoint. The snippet calls this in parallel with every
// impression beacon; if it responds {disabled:true}, the snippet writes
// eh_dx into sessionStorage and bails on subsequent escapes that session.
//
// Used for inlined/copied snippets where the edge-cached /s/{id}.js path
// can't deliver a settings change. Fail-open: if Supabase is unreachable
// we return {disabled:false} so an outage can't break escape for every
// legitimate customer.

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(payload: unknown, init: ResponseInit & { cacheSeconds?: number } = {}) {
  const { cacheSeconds, ...rest } = init;
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
  if (cacheSeconds && cacheSeconds > 0) {
    headers["cache-control"] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  } else {
    headers["cache-control"] = "no-store";
  }
  return new Response(JSON.stringify(payload), { ...rest, headers });
}

export async function OPTIONS() {
  return json(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const m = req.nextUrl.searchParams.get("m");
  if (!m || !UUID_RE.test(m)) {
    // Bad merchant id (or someone fishing) → disable. No cache so we don't
    // pollute the CDN with garbage keys.
    return json({ disabled: true, reason: "invalid_merchant" }, { status: 200 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    // Fail open: don't break legitimate customers when our DB is unreachable.
    // 30s cache so we don't hammer the (down) DB during an outage either.
    return json({ disabled: false, reason: "db_unavailable" }, { status: 200, cacheSeconds: 30 });
  }

  // Unknown merchant rows also disable — protects against copies with a
  // deleted merchant_id, which could otherwise keep escaping forever.
  const { data, error } = await admin
    .from("merchants")
    .select("id")
    .eq("id", m)
    .maybeSingle();
  if (error || !data) {
    return json({ disabled: true, reason: "unknown_merchant" }, { status: 200, cacheSeconds: 60 });
  }

  const disabled = await isMerchantDisabled(admin, m);
  return json({ disabled }, { status: 200, cacheSeconds: 60 });
}
