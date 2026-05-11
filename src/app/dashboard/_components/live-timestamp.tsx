"use client";

import { useEffect, useState } from "react";

export function LiveTimestamp({ label = "Updated" }: { label?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Use tick to trigger re-render; actual seconds is computed from when mount happened.
  const [mounted] = useState(() => Date.now());
  const seconds = Math.floor((Date.now() - mounted) / 1000);
  const rel =
    seconds < 60
      ? `${seconds}s`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m`
        : `${Math.floor(seconds / 3600)}h`;

  // Reference tick so React doesn't warn about unused state.
  void tick;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
      <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
      {label} {rel} ago
    </span>
  );
}
