"use client";

import { useState, useTransition } from "react";
import { generateDashboardShareLink } from "@/app/actions/billing";

/** Mints (or reuses) the merchant's stable share token and puts the
 *  read-only dashboard URL on the clipboard. Shows the URL inline so it
 *  can be grabbed manually when clipboard access is denied. */
export function ShareDashboardLink({ merchantId }: { merchantId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await generateDashboardShareLink(merchantId);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setUrl(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        setMessage("Share link copied");
      } catch {
        setMessage("Copy manually:");
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-bg-elev)] press focus-ring transition-colors disabled:opacity-50"
      >
        {isPending ? "Minting…" : "Copy share link"}
      </button>
      {message ? (
        <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">{message}</span>
      ) : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono text-[var(--color-accent)] underline underline-offset-2 break-all"
        >
          {url}
        </a>
      ) : null}
    </span>
  );
}
