"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Selection fallback: the URL is visible next to the button.
        }
      }}
      className="text-[10.5px] px-2 py-0.5 rounded border border-[var(--color-border-soft)] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)] press transition-colors"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
