"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  type: "PURCHASE" | "ESCAPE" | "CHECKOUT" | "ATC";
  utm: string;
  value?: string;
  ago: string;
};

// Pool of realistic-looking events to cycle through.
const POOL: Omit<Item, "id" | "ago">[] = [
  { type: "PURCHASE", utm: "instagram", value: "$58.32" },
  { type: "ESCAPE", utm: "instagram" },
  { type: "PURCHASE", utm: "ig", value: "$77.50" },
  { type: "CHECKOUT", utm: "facebook", value: "$42.10" },
  { type: "ESCAPE", utm: "facebook" },
  { type: "ATC", utm: "instagram" },
  { type: "PURCHASE", utm: "meta", value: "$31.99" },
  { type: "ESCAPE", utm: "ig" },
  { type: "CHECKOUT", utm: "instagram", value: "$94.40" },
  { type: "PURCHASE", utm: "instagram", value: "$128.00" },
  { type: "ATC", utm: "facebook" },
  { type: "ESCAPE", utm: "meta" },
];

const MAX = 5;

function seedItems(): Item[] {
  const seed: Item[] = [];
  for (let i = 0; i < MAX; i++) {
    const sample = POOL[(POOL.length - i - 1 + POOL.length) % POOL.length];
    seed.push({
      id: `seed-${i}`,
      ...sample,
      ago: `${(i + 1) * 7}s`,
    });
  }
  return seed;
}

export function AnimatedList({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<Item[]>(seedItems);

  // Inject a new event every ~2.4s.
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      const sample = POOL[i % POOL.length];
      i += 1;
      setItems((prev) => {
        const next: Item = {
          id: `evt-${Date.now()}-${i}`,
          ...sample,
          ago: "just now",
        };
        const aged = prev.map((p) => ({
          ...p,
          ago: bumpAgo(p.ago),
        }));
        return [next, ...aged].slice(0, MAX);
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={`rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]/80 backdrop-blur p-3 ${className}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
          Live · last hour
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-[var(--color-success)]">
          <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
          streaming
        </span>
      </div>
      <div className="space-y-1.5 min-h-[210px]">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function Row({ item }: { item: Item }) {
  const pillCls =
    item.type === "PURCHASE"
      ? "pill pill-success"
      : item.type === "ESCAPE"
        ? "pill pill-info"
        : item.type === "CHECKOUT"
          ? "pill pill-warn"
          : "pill pill-muted";
  return (
    <div className="magic-list-item flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-bg-elev)]/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className={pillCls}>{item.type}</span>
        <span className="text-[11.5px] font-mono text-[var(--color-fg-dim)] truncate">utm: {item.utm}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.value ? (
          <span className="text-[12.5px] tnum font-medium">{item.value}</span>
        ) : null}
        <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">{item.ago}</span>
      </div>
    </div>
  );
}

function bumpAgo(prev: string): string {
  if (prev === "just now") return "2s";
  const m = prev.match(/^(\d+)([sm])$/);
  if (!m) return prev;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit === "s" && n + 2 >= 60) return `${Math.floor((n + 2) / 60)}m`;
  if (unit === "s") return `${n + 2}s`;
  return `${n}m`;
}
