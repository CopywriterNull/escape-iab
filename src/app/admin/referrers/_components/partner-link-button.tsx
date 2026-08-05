"use client";

import { useState, useTransition } from "react";
import { generatePartnerLink } from "@/app/actions/referrers";

/** Mints (or reuses) the referrer's stable view token and puts the partner
 *  dashboard URL on the clipboard, showing it inline as a fallback. */
export function PartnerLinkButton({ referrerId }: { referrerId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const res = await generatePartnerLink(referrerId);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setUrl(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        setMessage("Partner link copied");
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
        className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium press lift focus-ring transition-colors disabled:opacity-50"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        {isPending ? "Minting…" : "Copy partner link"}
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
