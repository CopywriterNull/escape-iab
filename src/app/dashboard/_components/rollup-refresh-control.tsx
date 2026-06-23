"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function agoLabel(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * "Updated X ago" counter + manual Refresh, with a one-shot auto-refresh on
 * mount when the data is stale. Renders instantly from the server-provided
 * timestamp; the background refresh updates it without blocking first paint.
 */
export function RollupRefreshControl({
  lastRefresh,
  stale,
}: {
  lastRefresh: string | null;
  stale: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState<string | null>(lastRefresh);
  const [, setTick] = useState(0);
  const autoTriggered = useRef(false);

  // Keep the "X ago" label live without a server round-trip.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/dashboard/refresh", {
          method: "POST",
          headers: { accept: "application/json" },
        });
        const body = (await res.json()) as {
          ok?: boolean;
          freshness?: { lastRefresh?: string | null };
        };
        if (body?.freshness?.lastRefresh) setCurrent(body.freshness.lastRefresh);
        // Pull the freshly-rolled data into the server components.
        router.refresh();
      } catch {
        // Non-fatal: the page still shows the last-known rollups.
      }
    });
  }, [router]);

  // Load instantly, then refresh in the background once if stale.
  useEffect(() => {
    if (stale && !autoTriggered.current) {
      autoTriggered.current = true;
      refresh();
    }
  }, [stale, refresh]);

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] font-mono text-[var(--color-fg-muted)] tabular-nums"
        title={current ? `Rollups last refreshed: ${current}` : "Rollups never refreshed"}
      >
        {isPending ? "Updating…" : `Updated ${agoLabel(current)}`}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        aria-label="Refresh dashboard data"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-card)] px-2.5 text-[12px] font-medium hover:bg-[var(--color-bg-elev)] disabled:cursor-wait disabled:opacity-60 focus-ring"
      >
        <svg
          viewBox="0 0 16 16"
          className={`size-3 ${isPending ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M13.6 8a5.6 5.6 0 1 1-1.7-4M13.6 2.4V5.2H10.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Refresh
      </button>
    </div>
  );
}
