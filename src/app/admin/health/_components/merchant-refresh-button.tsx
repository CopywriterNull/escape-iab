"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Per-merchant "Refresh" on the admin health cards. Refreshes just this
 * merchant's recent rollup window, then re-pulls the server data so the
 * freshness tile updates in place.
 */
export function MerchantRefreshButton({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      try {
        await fetch(`/api/admin/rollups/refresh?merchantId=${encodeURIComponent(merchantId)}&hours=6`, {
          method: "POST",
          headers: { accept: "application/json" },
        });
        router.refresh();
      } catch {
        // Non-fatal; the card keeps showing the last-known freshness.
      }
    });
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={isPending}
      className="text-[12px] rounded-md border border-[var(--color-border)] px-2.5 py-1.5 hover:bg-[var(--color-bg-elev)] disabled:cursor-wait disabled:opacity-60 focus-ring"
    >
      {isPending ? "Refreshing…" : "Refresh rollups"}
    </button>
  );
}
