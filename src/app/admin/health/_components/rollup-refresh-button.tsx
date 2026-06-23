"use client";

import { useState, useTransition } from "react";

type RefreshResponse = {
  ok: boolean;
  partial?: boolean;
  hours?: number;
  merchants?: number;
  refreshed?: number;
  failed?: number;
  error?: string;
};

export function RollupRefreshButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function refreshRollups() {
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/rollups/refresh?hours=24", {
          method: "POST",
          headers: { accept: "application/json" },
        });
        const body = (await res.json()) as RefreshResponse;

        if (!res.ok || !body.ok) {
          const failed = body.failed ? ` · ${body.failed} failed` : "";
          setStatus(body.error ? `Failed: ${body.error}` : `Partial refresh${failed}`);
          return;
        }

        setStatus(
          `Refreshed ${body.refreshed ?? 0} rows across ${body.merchants ?? 0} merchants`,
        );
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Refresh failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={refreshRollups}
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium hover:bg-[var(--color-bg-elev)] disabled:cursor-wait disabled:opacity-60 focus-ring"
      >
        {isPending ? "Rolling up..." : "Roll up last 24h"}
      </button>
      {status ? (
        <div className="max-w-[260px] text-right text-[10.5px] font-mono text-[var(--color-fg-muted)]">
          {status}
        </div>
      ) : null}
    </div>
  );
}
