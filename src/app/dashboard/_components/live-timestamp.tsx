"use client";

import { useEffect, useState } from "react";

export function LiveTimestamp({ label = "Updated" }: { label?: string }) {
  const [mounted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.floor((now - mounted) / 1000);
  const rel =
    seconds < 60
      ? `${seconds}s`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m`
        : `${Math.floor(seconds / 3600)}h`;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
      <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
      {label} {rel} ago
    </span>
  );
}
