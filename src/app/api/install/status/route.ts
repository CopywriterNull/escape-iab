import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public endpoint — the merchant UUID is effectively the auth.
// Anyone with the install link can poll this to confirm tracking is alive.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "no_backend" }, { status: 503 });
  }

  // Two windows: last 5 minutes (immediate "is it firing right now?")
  // and last 24h (proves history exists in case they paused).
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
  const dayAgo = new Date(now - 24 * 3600_000).toISOString();

  const [recent, last] = await Promise.all([
    admin
      .from("escape_events")
      .select("event_type, iab_kind, created_at", { count: "exact" })
      .eq("merchant_id", id)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("escape_events")
      .select("event_type, iab_kind, created_at, url")
      .eq("merchant_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  type Row = { event_type: string; iab_kind: string | null; created_at: string };
  const rows = (recent.data ?? []) as Row[];
  const eventsLast24h = recent.count ?? rows.length;
  const eventsLast5min = rows.filter((r) => r.created_at >= fiveMinAgo).length;
  const lastEvent = (last.data?.[0] as
    | { event_type: string; iab_kind: string | null; created_at: string; url: string | null }
    | undefined) ?? null;

  // Unique iab_kinds seen in the last 24h (signal that snippet detects
  // visitors across multiple platforms).
  const iabKinds = Array.from(
    new Set(rows.map((r) => r.iab_kind).filter((k): k is string => !!k)),
  );

  return NextResponse.json({
    ok: true,
    installed: !!lastEvent,
    lastEvent: lastEvent
      ? {
          type: lastEvent.event_type,
          iab: lastEvent.iab_kind,
          at: lastEvent.created_at,
          host: lastEvent.url ? safeHost(lastEvent.url) : null,
        }
      : null,
    eventsLast5min,
    eventsLast24h,
    iabKinds,
  });
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}
