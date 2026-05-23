"use client";

import { useEffect, useRef, useState } from "react";
import { PixelIcon } from "@/components/PixelIcon";

type Row = {
  event_type: string;
  bucket: "a" | "b";
  in_test: boolean;
  value_cents: number | null;
  utm_source: string | null;
  iab_kind: string | null;
  created_at: string;
};

const POLL_MS = 6000; // every 6s

export function LiveActivity({
  initialRows,
  days,
  limit = 12,
}: {
  initialRows: Row[];
  days: number;
  limit?: number;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [, force] = useState(0);
  const seen = useRef(new Set(initialRows.map(rowKey)));

  // Poll the API for fresh rows. New rows get spliced in front so the
  // .magic-list-item entry animation fires.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const r = await fetch(`/api/dashboard/activity?days=${days}&limit=${limit}`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const json = (await r.json()) as { rows: Row[] };
        if (cancelled || !Array.isArray(json.rows)) return;
        // Find rows we haven't seen yet, prepend in chronological order.
        const fresh = json.rows.filter((r) => !seen.current.has(rowKey(r)));
        if (fresh.length === 0) return;
        fresh.forEach((r) => seen.current.add(rowKey(r)));
        setRows((prev) => {
          const merged = [...fresh, ...prev].slice(0, limit);
          return merged;
        });
      } catch {
        /* ignore network blip */
      }
    }

    // Tick relative-time labels every second.
    const labelTimer = window.setInterval(() => force((n) => n + 1), 1000);
    const pollTimer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(labelTimer);
      window.clearInterval(pollTimer);
    };
  }, [days, limit]);

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-[var(--color-fg-dim)]">No events yet.</p>
    );
  }

  return (
    <div className="row-divide">
      {rows.map((row) => (
        <ActivityRowClient key={rowKey(row)} row={row} />
      ))}
    </div>
  );
}

function ActivityRowClient({ row }: { row: Row }) {
  const eventPill =
    row.event_type === "purchase"
      ? { cls: "pill pill-success", label: "PURCHASE", icon: "dollar" as const, iconCls: "text-[var(--color-success)]" }
      : row.event_type === "escape_attempt"
        ? { cls: "pill pill-info", label: "ESCAPE", icon: "bolt" as const, iconCls: "text-[var(--color-accent)]" }
        : row.event_type === "checkout_started"
          ? { cls: "pill pill-warn", label: "CHECKOUT", icon: "cart" as const, iconCls: "text-[var(--color-fg-muted)]" }
          : row.event_type === "add_to_cart"
            ? { cls: "pill pill-muted", label: "ATC", icon: "cart" as const, iconCls: "text-[var(--color-fg-muted)]" }
            : { cls: "pill pill-muted", label: row.event_type.toUpperCase(), icon: "cart" as const, iconCls: "text-[var(--color-fg-muted)]" };
  const value = row.value_cents != null ? `$${(row.value_cents / 100).toFixed(2)}` : "";
  const ts = formatRelative(row.created_at);
  return (
    <div className="magic-list-item px-4 py-2.5 hover:bg-[var(--color-bg-elev)]/50 transition-colors text-[12.5px]">
      <div className="hidden sm:grid grid-cols-12 items-center gap-3">
        <div className="col-span-2 flex items-center gap-2 min-w-0">
          <PixelIcon name={eventPill.icon} size={12} className={eventPill.iconCls} />
          <span className={eventPill.cls}>{eventPill.label}</span>
        </div>
        <div className="col-span-3 flex items-center gap-2 min-w-0">
          <span className="pill pill-muted">BUCKET&nbsp;{row.bucket.toUpperCase()}</span>
          {!row.in_test ? <span className="pill pill-warn">UNATTR</span> : null}
        </div>
        <div className="col-span-3 text-[12px] text-[var(--color-fg-dim)] tnum truncate">
          {row.utm_source ? `utm: ${row.utm_source}` : ""}
          {row.iab_kind && row.iab_kind !== "instagram" ? ` · ${row.iab_kind}` : ""}
        </div>
        <div className="col-span-2 text-right tnum">{value}</div>
        <div className="col-span-2 text-right text-[11.5px] text-[var(--color-fg-muted)] tnum">{ts} ago</div>
      </div>
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <PixelIcon name={eventPill.icon} size={11} className={eventPill.iconCls} />
            <span className={eventPill.cls}>{eventPill.label}</span>
            <span className="pill pill-muted">B{row.bucket.toUpperCase()}</span>
            {!row.in_test ? <span className="pill pill-warn">UNATTR</span> : null}
          </div>
          <div className="shrink-0 text-right">
            {value ? <div className="tnum text-[13px] font-medium">{value}</div> : null}
            <div className="text-[10.5px] text-[var(--color-fg-muted)] font-mono tnum">{ts} ago</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function rowKey(r: Row): string {
  return `${r.created_at}-${r.event_type}-${r.bucket}-${r.value_cents ?? ""}`;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Math.max(0, Date.now() - t);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
