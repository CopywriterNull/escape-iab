"use client";

import { useEffect, useRef, useState } from "react";

type Status = {
  installed: boolean;
  lastEvent: {
    type: string;
    iab: string | null;
    at: string;
    host: string | null;
  } | null;
  eventsLast5min: number;
  eventsLast24h: number;
  iabKinds: string[];
};

const POLL_MS = 4000;

export function InstallStatus({ merchantId }: { merchantId: string }) {
  const [s, setS] = useState<Status | null>(null);
  const [tick, setTick] = useState(0);
  const initialFetched = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const r = await fetch(`/api/install/status?id=${merchantId}`, { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as { ok?: boolean } & Status;
        if (!cancelled && json.ok) {
          setS(json);
          initialFetched.current = true;
        }
      } catch {
        /* ignore network blip */
      }
    }

    fetchStatus();
    const pollTimer = window.setInterval(fetchStatus, POLL_MS);
    const labelTimer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.clearInterval(labelTimer);
    };
  }, [merchantId]);

  // Pre-first-fetch — show a quiet skeleton.
  if (!s && !initialFetched.current) {
    return (
      <Card tone="idle">
        <Dot tone="idle" />
        <div>
          <div className="text-[13px] font-medium tracking-tight">Connecting…</div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-fg-muted)] font-mono">
            checking for events
          </div>
        </div>
      </Card>
    );
  }

  // Status loaded.
  const installed = s?.installed;
  const recent = (s?.eventsLast5min ?? 0) > 0;
  const tone: Tone = recent ? "live" : installed ? "stale" : "idle";

  if (!installed) {
    return (
      <Card tone="idle">
        <Dot tone="idle" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium tracking-tight">
            Listening for your first impression…
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-fg-muted)] font-mono">
            Once you paste the snippet and visit your store from inside IG, it&apos;ll show
            up here within seconds.
          </div>
        </div>
      </Card>
    );
  }

  const ago = s?.lastEvent ? formatAgo(s.lastEvent.at) : "—";
  // Reference tick to silence unused-var lint; this re-renders the ago label every 1s.
  void tick;

  return (
    <Card tone={tone}>
      <Dot tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium tracking-tight">
          {tone === "live" ? "Snippet is live" : "Snippet detected"}
          <span className="ml-2 text-[var(--color-fg-muted)] font-mono text-[11.5px]">
            · last event {ago} ago
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11.5px] text-[var(--color-fg-muted)] font-mono tnum flex-wrap">
          {s?.lastEvent?.host ? <span>from {s.lastEvent.host}</span> : null}
          {s?.lastEvent?.type ? <span>type · {s.lastEvent.type}</span> : null}
          {s?.lastEvent?.iab ? <span>iab · {s.lastEvent.iab}</span> : null}
          <span>· last 5m: {s?.eventsLast5min ?? 0}</span>
          <span>· last 24h: {s?.eventsLast24h ?? 0}</span>
        </div>
      </div>
    </Card>
  );
}

type Tone = "idle" | "stale" | "live";

function Card({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const bg =
    tone === "live"
      ? "var(--color-success-soft)"
      : tone === "stale"
        ? "var(--color-accent-soft)"
        : "var(--color-bg-elev)";
  const border =
    tone === "live"
      ? "color-mix(in srgb, var(--color-success) 22%, transparent)"
      : tone === "stale"
        ? "color-mix(in srgb, var(--color-accent) 22%, transparent)"
        : "var(--color-border-soft)";
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border"
      style={{ background: bg, borderColor: border }}
    >
      {children}
    </div>
  );
}

function Dot({ tone }: { tone: Tone }) {
  const color =
    tone === "live"
      ? "var(--color-success)"
      : tone === "stale"
        ? "var(--color-accent)"
        : "var(--color-fg-muted)";
  return (
    <span
      className={`mt-1 size-2 rounded-full shrink-0 ${tone === "live" ? "pulse-ring" : ""}`}
      style={{ background: color }}
    />
  );
}

function formatAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const delta = Math.max(0, Date.now() - t);
  const s = Math.floor(delta / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
