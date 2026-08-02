import Link from "next/link";
import { mockData as d } from "../_mock";
import { PixelIcon } from "@/components/PixelIcon";

// V7 — Condensed. One-screen density: slim topbar with live-status pill,
// hero strip with inline verdict, hairline KPI row (no card-per-stat),
// funnel as paired thin bars, chart + billing + activity in one band.

const dailyChart = [
  478, 530, 581, 461, 562, 608, 665, 591, 557, 626, 647, 691, 729, 608,
].map((v, i) => ({ day: i, escapes: v, impressions: Math.round(v / 0.64) }));

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function V7Condensed() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;
  const rpvA = 1.61;
  const rpvB = 0.52;
  const lift = (rpvA - rpvB) / rpvB;
  const maxImp = Math.max(...dailyChart.map((r) => r.impressions));

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      {/* ─── Slim topbar ─── */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
            <span className="text-[13px] font-semibold tracking-tight">Escape Hatch</span>
            <span className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
              / {d.merchant.name.toLowerCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] text-[11.5px] font-medium">
              <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
              <span className="text-[var(--color-success)]">escapes live</span>
            </span>
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[2px] text-[11px] font-mono">
              {["24h", "7d", "14d", "30d"].map((r) => (
                <span
                  key={r}
                  className={`rounded-full px-2 py-[3px] ${
                    r === "14d"
                      ? "bg-[var(--color-bg)] font-medium shadow-[0_0_0_1px_var(--color-border-soft)_inset]"
                      : "text-[var(--color-fg-muted)]"
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 space-y-4">
        {/* ─── Hero strip: verdict inline, no big banner ─── */}
        <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="h-display text-[30px] tracking-tight tnum text-[var(--color-success)]">
              +{(lift * 100).toFixed(0)}%
            </span>
            <span className="text-[13px] text-[var(--color-fg-dim)]">
              revenue per visitor when shoppers escape the in-app browser
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11.5px] font-mono text-[var(--color-fg-muted)] tnum">
            <span>A ${rpvA.toFixed(2)} · B ${rpvB.toFixed(2)}</span>
            <span className="text-[var(--color-success)]">{(d.confident * 100).toFixed(0)}% confident</span>
          </div>
        </section>

        {/* ─── Hairline KPI row — one bordered strip, divided, no cards ─── */}
        <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[var(--color-border-soft)]">
          {[
            { label: "Impressions", value: d.impressions.toLocaleString(), sub: `${d.escapeAttempts.toLocaleString()} escapes`, icon: "eye" as const },
            { label: "Escape rate", value: pct(d.escapeRate), sub: "of IG landings", icon: "bolt" as const },
            { label: "Incremental", value: usd(3960), sub: "vs control baseline", icon: "dollar" as const, accent: true },
            { label: "Purchases", value: String(d.purchases), sub: usd(d.revenue) + " tracked", icon: "cart" as const },
          ].map((k) => (
            <div key={k.label} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                  {k.label}
                </span>
                <PixelIcon name={k.icon} size={11} className="text-[var(--color-fg-muted)]" />
              </div>
              <div className={`mt-1 h-section text-[19px] tnum ${k.accent ? "text-[var(--color-success)]" : ""}`}>
                {k.value}
              </div>
              <div className="text-[10.5px] text-[var(--color-fg-muted)] tnum">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* ─── Middle band: funnel (7) + chart/billing (5) ─── */}
        <div className="grid lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-soft)]">
              <h2 className="h-section text-[13px]">Funnel · A vs B</h2>
              <span className="text-[10px] font-mono text-[var(--color-fg-muted)]">A escape · B control</span>
            </header>
            <div className="px-4 py-3 space-y-2.5">
              {d.funnel.map((s) => {
                const pctA = s.a / baseA;
                const pctB = s.b / baseB;
                const liftS = pctB > 0 ? pctA / pctB - 1 : 0;
                return (
                  <div key={s.label} className="grid grid-cols-[110px_1fr_64px] items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-medium truncate">{s.label}</div>
                      <div className="text-[9.5px] font-mono text-[var(--color-fg-muted)] truncate">{s.sub}</div>
                    </div>
                    <div className="space-y-[3px]">
                      <div className="h-[7px] rounded-sm bg-[var(--color-bg-elev)] overflow-hidden">
                        <div
                          className="h-full rounded-sm bg-[var(--color-accent)]"
                          style={{ width: `${Math.max(2, pctA * 100)}%` }}
                        />
                      </div>
                      <div className="h-[7px] rounded-sm bg-[var(--color-bg-elev)] overflow-hidden">
                        <div
                          className="h-full rounded-sm bg-[var(--color-fg-muted)]/50"
                          style={{ width: `${Math.max(2, pctB * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`text-right text-[11px] font-mono tnum ${
                        liftS > 0.02
                          ? "text-[var(--color-success)]"
                          : liftS < -0.02
                            ? "text-[var(--color-danger)]"
                            : "text-[var(--color-fg-muted)]"
                      }`}
                    >
                      {s.label === "Impressions" ? "—" : `${liftS > 0 ? "+" : ""}${(liftS * 100).toFixed(0)}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="lg:col-span-5 space-y-4">
            <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]">
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-soft)]">
                <h2 className="h-section text-[13px]">Daily trend</h2>
                <span className="text-[10px] font-mono text-[var(--color-fg-muted)]">14d</span>
              </header>
              <div className="px-4 py-3">
                <div className="flex items-end gap-[3px] h-[64px]">
                  {dailyChart.map((r, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-[2px]">
                      <div
                        className="rounded-[2px] bg-[var(--color-accent)]"
                        style={{ height: `${(r.escapes / maxImp) * 100}%` }}
                      />
                      <div
                        className="rounded-[2px] bg-[var(--color-bg-elev)]"
                        style={{ height: `${((r.impressions - r.escapes) / maxImp) * 100}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono text-[var(--color-fg-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-[var(--color-accent)]" /> escaped
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-[var(--color-bg-elev)] border border-[var(--color-border)]" /> stayed
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                    Billing · accruing
                  </div>
                  <div className="mt-0.5 h-section text-[18px] tnum text-[var(--color-accent)]">$396</div>
                  <div className="text-[10.5px] text-[var(--color-fg-muted)]">10% of incremental · bills Aug 30</div>
                </div>
                <span className="pill pill-success">Unlimited Plan</span>
              </div>
            </section>
          </div>
        </div>

        {/* ─── Activity ticker — single row ─── */}
        <section className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 py-2.5 flex items-center gap-4 overflow-x-auto scrollbar-none">
          <span className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)] shrink-0">
            Live
          </span>
          {d.activity.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-mono tnum shrink-0">
              <span
                className={`size-1.5 rounded-full ${a.bucket === "A" ? "bg-[var(--color-accent)]" : "bg-[var(--color-fg-muted)]"}`}
              />
              <span className={a.type === "PURCHASE" ? "text-[var(--color-success)]" : "text-[var(--color-fg-dim)]"}>
                {a.type}
              </span>
              {a.value ? <span>{a.value}</span> : null}
              <span className="text-[var(--color-fg-muted)]">{a.ago}</span>
            </span>
          ))}
        </section>

        <div className="text-center text-[10.5px] text-[var(--color-fg-muted)] pt-2">
          <Link href="/preview/dashboard" className="underline underline-offset-2">
            ← all variants
          </Link>
        </div>
      </main>
    </div>
  );
}
