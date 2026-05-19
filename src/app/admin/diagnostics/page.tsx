import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string | null;
  domain: string | null;
  shopify_domain: string | null;
  escape_enabled: boolean | null;
  paid_only: boolean | null;
  ab_enabled: boolean | null;
  fallback_button: boolean | null;
  user_id: string | null;
};

type ActivityRow = {
  merchant_id: string;
  events_24h: number | string;
  last_event_at: string | null;
  last_event_type: string | null;
};

export default async function AdminDiagnostics() {
  const admin = getSupabaseAdmin();
  const { data } = await admin!.from("merchants").select("*").order("created_at", { ascending: true });
  const rows = ((data ?? []) as unknown[]).map((r) => {
    const m = r as Record<string, unknown>;
    return {
      id: m.id as string,
      name: (m.name as string | null) ?? null,
      domain: (m.domain as string | null) ?? null,
      shopify_domain: (m.shopify_domain as string | null) ?? null,
      escape_enabled: m.escape_enabled === false ? false : true,
      paid_only: m.paid_only === true,
      ab_enabled: m.ab_enabled === false ? false : true,
      fallback_button: m.fallback_button === false ? false : true,
      user_id: (m.user_id as string | null) ?? null,
    } satisfies Row;
  });

  const lastEvent = new Map<string, { at: string; type: string }>();
  const eventCount = new Map<string, number>();
  const { data: activity } = await admin!.rpc("eh_admin_merchant_activity_24h");
  for (const row of (activity ?? []) as ActivityRow[]) {
    eventCount.set(row.merchant_id, toInt(row.events_24h));
    if (row.last_event_at) {
      lastEvent.set(row.merchant_id, {
        at: row.last_event_at,
        type: row.last_event_type ?? "event",
      });
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow">Admin · Diagnostics</div>
        <h1 className="mt-2 h-display text-[28px] tracking-tight">Live config snapshot</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-dim)] max-w-xl">
          Per-merchant view of the flags baked into their served snippet, plus recent activity. Red flags surface misconfig at a glance.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-3 border-b border-[var(--color-border-soft)] text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
          <div>Merchant</div>
          <div>Escape</div>
          <div>Paid only</div>
          <div>A/B</div>
          <div>Fallback</div>
          <div className="text-right">Last 24h</div>
        </div>
        <ul>
          {rows.map((r) => {
            const last = lastEvent.get(r.id);
            const count = eventCount.get(r.id) ?? 0;
            // Heuristic: if escape is disabled, treat as red. If no events in 24h, dim.
            const killed = !r.escape_enabled;
            const cold = count === 0;
            return (
              <li
                key={r.id}
                className={`grid grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr] gap-3 px-5 py-3 border-b border-[var(--color-border-soft)] last:border-b-0 items-center text-[12px] ${
                  killed ? "bg-[var(--color-danger-soft)]/20" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium tracking-tight truncate">{r.name ?? "(unnamed)"}</div>
                  <div className="text-[10.5px] font-mono text-[var(--color-fg-muted)] truncate">
                    {r.domain ?? "—"}
                  </div>
                  <div className="text-[10px] font-mono text-[var(--color-fg-muted)] truncate" title={r.id}>
                    {r.id.slice(0, 8)}…
                  </div>
                </div>
                <Flag on={r.escape_enabled} onLabel="LIVE" offLabel="KILLED" critical />
                <Flag on={r.paid_only} onLabel="PAID" offLabel="ALL" />
                <Flag on={r.ab_enabled} onLabel="50/50" offLabel="OFF" />
                <Flag on={r.fallback_button} onLabel="ON" offLabel="OFF" />
                <div className="text-right">
                  {cold ? (
                    <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">no events</span>
                  ) : (
                    <div>
                      <div className="text-[11.5px] font-mono tnum text-[var(--color-fg)]">{count}</div>
                      {last ? (
                        <div className="text-[10px] font-mono text-[var(--color-fg-muted)]">
                          {last.type} · {ago(last.at)}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-[11.5px] text-[var(--color-fg-muted)] font-mono leading-relaxed">
        <strong className="text-[var(--color-fg-dim)]">Legend:</strong>{" "}
        <span className="text-[var(--color-danger)]">KILLED</span> = snippet skips redirect (escape_enabled=false).{" "}
        <span className="text-[var(--color-fg-dim)]">PAID</span> = only paid Meta clicks bucketed.{" "}
        <span className="text-[var(--color-fg-dim)]">ALL</span> = every IG IAB visitor bucketed.
      </div>
    </div>
  );
}

function toInt(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function Flag({
  on,
  onLabel,
  offLabel,
  critical,
}: {
  on: boolean | null;
  onLabel: string;
  offLabel: string;
  critical?: boolean;
}) {
  const isOn = on !== false;
  const tone = isOn
    ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
    : critical
      ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
      : "bg-[var(--color-fg)]/8 text-[var(--color-fg-muted)]";
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider ${tone}`}>
      <span className={`size-1 rounded-full ${isOn ? "bg-[var(--color-success)]" : critical ? "bg-[var(--color-danger)]" : "bg-[var(--color-fg-muted)]"}`} />
      {isOn ? onLabel : offLabel}
    </span>
  );
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
