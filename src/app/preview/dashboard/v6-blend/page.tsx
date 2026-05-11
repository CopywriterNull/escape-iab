import Link from "next/link";
import { mockData as d } from "../_mock";

// 14-day chart series (synthetic but plausible).
const dailyChart = [
  { day: "11/10", impressions: 760, escapes: 478 },
  { day: "11/11", impressions: 840, escapes: 530 },
  { day: "11/12", impressions: 910, escapes: 581 },
  { day: "11/13", impressions: 720, escapes: 461 },
  { day: "11/14", impressions: 880, escapes: 562 },
  { day: "11/15", impressions: 950, escapes: 608 },
  { day: "11/16", impressions: 1040, escapes: 665 },
  { day: "11/17", impressions: 920, escapes: 591 },
  { day: "11/18", impressions: 870, escapes: 557 },
  { day: "11/19", impressions: 980, escapes: 626 },
  { day: "11/20", impressions: 1010, escapes: 647 },
  { day: "11/21", impressions: 1080, escapes: 691 },
  { day: "11/22", impressions: 1140, escapes: 729 },
  { day: "11/23", impressions: 950, escapes: 608 },
];

export default function V6Blend() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain relative">
      <div aria-hidden className="gradient-dotgrid" />

      {/* Top nav — same as the real dashboard (Vercel-style) */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)] shrink-0">
              <svg viewBox="0 0 24 24" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">EscapeHatch</span>
            <span className="text-[var(--color-fg-muted)] text-[13px]">/</span>
            <span className="text-[13px] font-medium">{d.merchant.name}</span>
            <span className="hidden sm:inline text-[11.5px] font-mono text-[var(--color-fg-muted)]">· {d.merchant.domain}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--color-border-soft)] text-[11px] font-mono text-[var(--color-fg-dim)] bg-[var(--color-bg-elev)]/40">
              <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
              A/B running
            </span>
            <span className="text-[12px] text-[var(--color-fg-muted)] px-2 py-1">Sign out</span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex items-center gap-1 -mb-px">
            {["Overview", "Install", "Settings"].map((t) => (
              <span key={t}
                className="relative px-3 py-3 text-[13px] tracking-tight"
                style={{
                  color: t === "Overview" ? "var(--color-fg)" : "var(--color-fg-muted)",
                  fontWeight: t === "Overview" ? 500 : 400,
                }}>
                {t}
                {t === "Overview" ? <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-[var(--color-fg)] rounded-full" /> : null}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 relative">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3 pb-3 mb-1">
          <div className="min-w-0">
            <h1 className="h-display text-[22px] md:text-[26px] tracking-tight">{d.merchant.name}</h1>
            <div className="mt-1 text-[12px] font-mono text-[var(--color-fg-muted)]">
              {d.merchant.domain} · {d.rangeLabel} · A/B 50/50
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] p-[3px] text-[12px]">
              {["1h", "6h", "24h", "7d", "14d", "30d", "90d"].map((r) => (
                <span key={r} className="px-2.5 py-[5px] rounded-full font-mono tnum"
                  style={{
                    background: r === "14d" ? "var(--color-bg)" : "transparent",
                    color: r === "14d" ? "var(--color-fg)" : "var(--color-fg-muted)",
                    fontWeight: r === "14d" ? 500 : 400,
                    boxShadow: r === "14d" ? "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px var(--color-border-soft) inset" : undefined,
                  }}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ─── V5-style "Test is winning" banner, in our theme ─── */}
        <div
          className="rounded-2xl p-5 md:p-6 border flex items-start gap-4"
          style={{
            background: "var(--color-success-soft)",
            borderColor: "color-mix(in srgb, var(--color-success) 18%, transparent)",
          }}
        >
          <div
            aria-hidden
            className="size-11 rounded-xl grid place-items-center shrink-0"
            style={{ background: "var(--color-card)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold" style={{ color: "var(--color-success)" }}>
              Test is winning
            </div>
            <div className="mt-1 text-[22px] md:text-[26px] font-semibold tracking-tight leading-tight">
              Bucket A converts{" "}
              <span className="tnum" style={{ color: "var(--color-success)" }}>
                +{(d.liftPct * 100).toFixed(1)}%
              </span>{" "}
              better than control
            </div>
            <div className="mt-1.5 text-[13px] text-[var(--color-fg-dim)]">
              {(d.confident * 100).toFixed(0)}% confident over the last {d.rangeLabel.toLowerCase()} · p = {d.pValue.toFixed(3)}. You can call this one.
            </div>
          </div>
        </div>

        {/* KPI strip — current theme tiles, with deltas */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: "Impressions", v: d.impressions.toLocaleString(), s: `${d.escapeAttempts.toLocaleString()} escapes (bucket A)`, delta: "+8.4%" },
            { l: "Escape rate", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "of bucket A landings", delta: "+1.2%" },
            { l: "Revenue (test)", v: `$${d.revenue.toLocaleString()}`, s: `${d.purchases} purchases`, delta: "+18.7%" },
            { l: "Lift · A vs B", v: `+${(d.liftPct * 100).toFixed(1)}%`, s: `${(d.confident * 100).toFixed(0)}% confident`, delta: null, valueClass: "text-[var(--color-success)]" },
          ].map((k, i) => (
            <div key={i} className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg px-4 py-3">
              <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">{k.l}</div>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <div className={`text-[26px] font-semibold tnum tracking-tight ${k.valueClass ?? ""}`}>{k.v}</div>
                {k.delta ? (
                  <span className="text-[11.5px] font-mono tnum font-medium" style={{ color: "var(--color-success)" }}>
                    ↑ {k.delta}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11.5px] text-[var(--color-fg-muted)] tnum">{k.s}</div>
            </div>
          ))}
        </div>

        {/* ─── V3-style ASCII comparison bars, in our cobalt ─── */}
        <div className="mt-4 bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
            <h2 className="text-[14px] font-semibold tracking-tight">Funnel · A vs B</h2>
            <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
              ASCII view
            </span>
          </header>
          <div className="px-4 py-4">
            {d.funnel.map((s, i) => {
              const prev = i > 0 ? d.funnel[i - 1] : null;
              const cvrA = baseA > 0 ? s.a / baseA : 0;
              const cvrB = baseB > 0 ? s.b / baseB : 0;
              const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
              const sig = lift != null && Math.abs(lift) > 0.05;
              // 40 ASCII blocks wide max.
              const aBlocks = Math.max(1, Math.round(cvrA * 40));
              const bBlocks = Math.max(1, Math.round(cvrB * 40));
              const prevTotal = prev ? prev.a + prev.b : null;
              const total = s.a + s.b;
              const dropPct =
                prev && prevTotal && prevTotal > 0
                  ? Math.round((1 - total / prevTotal) * 100)
                  : null;

              return (
                <div key={s.label}>
                  {/* Drop-off connector */}
                  {i > 0 && dropPct != null ? (
                    <div className="flex items-center gap-2 py-1.5 text-[10.5px] font-mono text-[var(--color-fg-muted)] tnum">
                      <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M6 2v8M3 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{dropPct}% drop-off</span>
                    </div>
                  ) : null}

                  {/* Stage header */}
                  <div className="flex items-baseline justify-between gap-3 mt-1">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium tracking-tight">{s.label}</div>
                      <div className="text-[10.5px] text-[var(--color-fg-muted)] font-mono">{s.sub}</div>
                    </div>
                    <div className="shrink-0 flex items-baseline gap-2">
                      {lift != null && i > 0 ? (
                        <>
                          <span className="font-mono tnum text-[12.5px] font-semibold" style={{ color: lift > 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                            {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                          </span>
                          <span className="text-[10px] font-mono tnum" style={{ color: sig ? "var(--color-success)" : "var(--color-fg-muted)" }}>
                            p {d.pValue.toFixed(3)}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-[11px] text-[var(--color-fg-muted)]">baseline</span>
                      )}
                    </div>
                  </div>

                  {/* ASCII bars — A then B */}
                  <pre
                    className="mt-1.5 leading-[1.45] text-[11px] tnum overflow-x-auto"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                      margin: 0,
                    }}
                  >
                    <span style={{ color: "var(--color-fg-muted)" }}>A│</span>
                    <span style={{ color: "var(--color-accent)" }}>{"█".repeat(aBlocks)}</span>
                    <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(40 - aBlocks)}</span>
                    <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                    <span style={{ color: "var(--color-fg)" }}>
                      {s.a.toLocaleString().padStart(7)} {(cvrA * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                    </span>
                    {"\n"}
                    <span style={{ color: "var(--color-fg-muted)" }}>B│</span>
                    <span style={{ color: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}>{"█".repeat(bBlocks)}</span>
                    <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(40 - bBlocks)}</span>
                    <span style={{ color: "var(--color-fg-muted)" }}>│ </span>
                    <span style={{ color: "var(--color-fg-dim)" }}>
                      {s.b.toLocaleString().padStart(7)} {(cvrB * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                    </span>
                  </pre>
                </div>
              );
            })}
            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border-soft)] flex items-center gap-4 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-[var(--color-accent)]">█</span> A · escape variant
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono" style={{ color: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}>█</span> B · control
              </span>
              <span className="ml-auto">Bar width = CVR from impressions</span>
            </div>
          </div>
        </div>

        {/* ─── 2-col: Sources (primary) + Chart + Sample size (secondary) ─── */}
        <div className="mt-4 grid lg:grid-cols-12 gap-4">
          {/* Sources card */}
          <div className="lg:col-span-7 bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
              <h2 className="text-[14px] font-semibold tracking-tight">Top sources</h2>
              <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">{d.range}</span>
            </header>
            <div className="px-4 py-3 space-y-2">
              {(() => {
                const sourceMax = Math.max(...d.sources.map((s) => s.total));
                return d.sources.map((s) => {
                  const sharePct = s.total / sourceMax;
                  const blocks = Math.max(1, Math.round(sharePct * 32));
                  const cvr = s.total > 0 ? (s.purchases / s.total) * 100 : 0;
                  return (
                    <div key={s.utm_source} className="flex items-baseline gap-3">
                      <div className="w-[88px] shrink-0 text-[12.5px] font-medium tracking-tight truncate">{s.utm_source}</div>
                      <pre
                        className="flex-1 leading-none text-[11px] tnum overflow-hidden"
                        style={{ fontFamily: "var(--font-mono), ui-monospace, monospace", margin: 0 }}
                      >
                        <span style={{ color: "var(--color-accent)" }}>{"█".repeat(blocks)}</span>
                        <span style={{ color: "var(--color-border-soft)" }}>{"░".repeat(32 - blocks)}</span>
                      </pre>
                      <span className="w-[160px] shrink-0 text-right text-[11px] font-mono tnum">
                        <span className="text-[var(--color-fg)]">{s.total.toLocaleString()}</span>
                        <span className="text-[var(--color-fg-muted)]"> · {s.purchases} buys · ${s.revenue.toLocaleString()}</span>
                        {cvr > 0 ? <span className="text-[var(--color-fg-muted)]"> · {cvr.toFixed(2)}%</span> : null}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Chart + Sample size stacked */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Chart */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
              <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
                <h2 className="text-[14px] font-semibold tracking-tight">Impressions vs escapes</h2>
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">{d.range}</span>
              </header>
              <div className="px-4 py-3">
                {(() => {
                  const w = 480;
                  const h = 110;
                  const maxV = Math.max(...dailyChart.flatMap((p) => [p.impressions, p.escapes]));
                  const x = (i: number) => 6 + (i * (w - 12)) / Math.max(1, dailyChart.length - 1);
                  const y = (v: number) => h - 12 - ((h - 24) * v) / maxV;
                  const linePath = (key: "impressions" | "escapes") =>
                    dailyChart.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");
                  const areaPath =
                    linePath("escapes") +
                    ` L ${x(dailyChart.length - 1)} ${h - 12} L ${x(0)} ${h - 12} Z`;
                  return (
                    <>
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[110px]">
                        {[35, 60, 85].map((yy) => (
                          <line key={yy} x1="6" x2={w - 6} y1={yy} y2={yy} stroke="var(--color-border-soft)" />
                        ))}
                        <path d={areaPath} fill="var(--color-accent)" fillOpacity="0.07" />
                        <path d={linePath("impressions")} fill="none" stroke="var(--color-fg-muted)" strokeWidth="1.5" />
                        <path d={linePath("escapes")} fill="none" stroke="var(--color-accent)" strokeWidth="1.75" />
                      </svg>
                      <div className="mt-1 flex items-center gap-3 text-[10.5px] text-[var(--color-fg-muted)] font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-[var(--color-fg-muted)]" /> impressions
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-[var(--color-accent)]" /> escapes
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Sample size */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
              <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
                <h2 className="text-[14px] font-semibold tracking-tight">Sample size</h2>
                <span className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">30% MDE · 95% conf</span>
              </header>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-2 text-[12px] text-[var(--color-fg-muted)] font-mono tnum">
                  <span>{baseA.toLocaleString()}</span>
                  <span>8,420 / bucket</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-border-soft)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-[width] duration-500"
                    style={{ width: `${Math.min(100, (baseA / 8420) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
                  Sample size sufficient for 95% confidence at 30% MDE. You can call this test.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Activity log ─── */}
        <div className="mt-4 bg-[var(--color-card)] border border-[var(--color-border-soft)] rounded-lg">
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-soft)]">
            <h2 className="text-[14px] font-semibold tracking-tight">Recent activity</h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-muted)] font-mono">
              <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
              Updated 3s ago
            </span>
          </header>
          <div className="row-divide">
            {d.activity.map((row, i) => {
              const pillCls =
                row.type === "PURCHASE"
                  ? "pill pill-success"
                  : row.type === "ESCAPE"
                    ? "pill pill-info"
                    : row.type === "CHECKOUT"
                      ? "pill pill-warn"
                      : "pill pill-muted";
              return (
                <div key={i} className="px-4 py-2.5 hover:bg-[var(--color-bg-elev)]/50 transition-colors text-[12.5px]">
                  <div className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-2">
                      <span className={pillCls}>{row.type}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="pill pill-muted">BUCKET&nbsp;{row.bucket}</span>
                    </div>
                    <div className="col-span-3 text-[12px] text-[var(--color-fg-dim)] tnum truncate">
                      utm: {row.utm}
                    </div>
                    <div className="col-span-2 text-right tnum">{row.value}</div>
                    <div className="col-span-2 text-right text-[11.5px] text-[var(--color-fg-muted)] tnum">{row.ago} ago</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-[11px] font-mono text-[var(--color-fg-muted)]">
          <Link href="/preview/dashboard" className="hover:opacity-80">← all variants</Link>
          <span>V6 · Current theme + V5 banner + V3 ASCII funnel</span>
        </div>
      </main>
    </div>
  );
}
