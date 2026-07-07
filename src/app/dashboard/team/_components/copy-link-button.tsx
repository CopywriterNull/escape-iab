"use client";

import { useState } from "react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can be unavailable (permissions/http); fall back to prompt-free noop.
        }
      }}
      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
