"use client";

import { useState } from "react";

export function CopyableCode({
  code,
  label,
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="relative group">
      <pre className="text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed pr-24">
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        className={`absolute top-3 right-3 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-colors press focus-ring ${
          copied
            ? "border-[var(--color-success)]/40 text-[var(--color-success)] bg-[var(--color-success-soft)]"
            : "border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] bg-[var(--color-bg)]/60"
        }`}
        aria-label={label ? `Copy ${label}` : "Copy"}
      >
        {copied ? "✓ copied" : "Copy"}
      </button>
    </div>
  );
}

export function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-mono px-2.5 py-1 rounded-md border transition-colors press focus-ring ${
        copied
          ? "border-[var(--color-success)]/40 text-[var(--color-success)]"
          : "border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)]"
      }`}
    >
      {copied ? "✓ link copied" : `Copy /install/…`}
    </button>
  );
}
