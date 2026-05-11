import Link from "next/link";
import { mockData as d } from "../_mock";

const ACCENT = "#7c70ff";

export default function V1LinearDark() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div
      data-theme="dark"
      className="min-h-dvh"
      style={{ background: "#08080a", color: "#e6e8eb" }}
    >
      <div className="flex min-h-dvh">
        {/* Sidebar */}
        <aside className="w-[220px] shrink-0 border-r flex flex-col" style={{ borderColor: "#1c1d24", background: "#0c0c0f" }}>
          <div className="h-12 px-4 flex items-center gap-2 border-b" style={{ borderColor: "#1c1d24" }}>
            <span className="size-5 rounded-md grid place-items-center" style={{ background: ACCENT }}>
              <svg viewBox="0 0 24 24" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            <span className="text-[13px] font-semibold tracking-tight">EscapeHatch</span>
          </div>
          <nav className="flex-1 px-2 py-3 space-y-0.5 text-[12.5px]">
            <div className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] font-mono" style={{ color: "#5e6573" }}>Workspace</div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(124,112,255,0.12)", color: "#e6e8eb" }}>
              <span className="size-1 rounded-full" style={{ background: ACCENT }} /> Overview
            </div>
            <div className="px-2.5 py-1.5 rounded-md hover:bg-white/5" style={{ color: "#9097a3" }}>Install</div>
            <div className="px-2.5 py-1.5 rounded-md hover:bg-white/5" style={{ color: "#9097a3" }}>Settings</div>
            <div className="mt-4 px-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] font-mono" style={{ color: "#5e6573" }}>Test</div>
            <div className="px-2.5 py-1.5 text-[11px] font-mono" style={{ color: "#9097a3" }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: "#3fcf8e" }} /> A/B running
              </span>
            </div>
          </nav>
          <div className="px-3 py-3 border-t text-[11.5px]" style={{ borderColor: "#1c1d24", color: "#9097a3" }}>
            <div className="flex items-center gap-2">
              <span className="size-5 rounded-full grid place-items-center text-[10px] font-semibold" style={{ background: "rgba(124,112,255,0.18)", color: ACCENT }}>L</span>
              <span className="truncate">lennyhuynh526@…</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Top breadcrumb bar */}
          <div className="h-10 px-6 flex items-center justify-between border-b text-[12px]" style={{ borderColor: "#1c1d24", background: "#0a0a0c" }}>
            <div className="flex items-center gap-2" style={{ color: "#9097a3" }}>
              <span>{d.merchant.name}</span>
              <span style={{ color: "#5e6573" }}>/</span>
              <span style={{ color: "#e6e8eb" }}>Overview</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]" style={{ color: "#9097a3" }}>
              <span>{d.merchant.domain}</span>
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Hero */}
            <div className="flex items-end justify-between gap-4 pb-5 border-b" style={{ borderColor: "#1c1d24" }}>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] font-mono" style={{ color: "#5e6573" }}>
                  Lift · {d.rangeLabel}
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <div className="text-[44px] font-semibold tnum tracking-tight leading-none" style={{ color: "#3fcf8e" }}>
                    +{(d.liftPct * 100).toFixed(1)}%
                  </div>
                  <div className="text-[12.5px] font-mono tnum" style={{ color: "#9097a3" }}>
                    p = {d.pValue.toFixed(3)} · {(d.confident * 100).toFixed(0)}% confident
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {["1d", "7d", "14d", "30d", "90d"].map((r) => (
                  <button key={r} className={`px-2.5 py-1 rounded text-[11.5px] font-mono tnum ${r === "14d" ? "" : ""}`}
                    style={{
                      background: r === "14d" ? "rgba(124,112,255,0.14)" : "transparent",
                      color: r === "14d" ? ACCENT : "#9097a3",
                      border: `1px solid ${r === "14d" ? "rgba(124,112,255,0.30)" : "transparent"}`,
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI strip — dense, no card chrome */}
            <div className="grid grid-cols-4 gap-0 py-4 border-b" style={{ borderColor: "#1c1d24" }}>
              {[
                { l: "Impressions", v: d.impressions.toLocaleString(), s: `${d.escapeAttempts.toLocaleString()} escapes`, delta: "+8.4%" },
                { l: "Escape rate", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "of bucket A landings", delta: "+1.2%" },
                { l: "Revenue", v: `$${d.revenue.toLocaleString()}`, s: `${d.purchases} purchases`, delta: "+18.7%" },
                { l: "Lift", v: `+${(d.liftPct * 100).toFixed(1)}%`, s: `${(d.confident * 100).toFixed(0)}% confident`, delta: null },
              ].map((k, i) => (
                <div key={i} className={`px-5 ${i > 0 ? "border-l" : ""}`} style={{ borderColor: "#1c1d24" }}>
                  <div className="text-[10.5px] uppercase tracking-[0.1em] font-mono" style={{ color: "#5e6573" }}>{k.l}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <div className="text-[22px] font-semibold tnum tracking-tight">{k.v}</div>
                    {k.delta ? (
                      <span className="text-[11px] font-mono tnum" style={{ color: "#3fcf8e" }}>↑ {k.delta}</span>
                    ) : null}
                  </div>
                  <div className="text-[10.5px] mt-1 font-mono tnum" style={{ color: "#5e6573" }}>{k.s}</div>
                </div>
              ))}
            </div>

            {/* Funnel — dense rows */}
            <div className="py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12.5px] font-semibold tracking-tight">Funnel · A vs B</div>
                <div className="text-[10.5px] font-mono" style={{ color: "#5e6573" }}>5 stages · 30% MDE</div>
              </div>
              <div className="space-y-2">
                {d.funnel.map((s, i) => {
                  const cvrA = baseA > 0 ? s.a / baseA : 0;
                  const cvrB = baseB > 0 ? s.b / baseB : 0;
                  const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
                  return (
                    <div key={s.label}>
                      <div className="flex items-center gap-3 text-[12px]">
                        <div className="w-[140px] shrink-0">
                          <div className="font-medium">{s.label}</div>
                          <div className="text-[10.5px] font-mono" style={{ color: "#5e6573" }}>{s.sub}</div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] uppercase tracking-[0.1em] font-mono w-3" style={{ color: "#5e6573" }}>A</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div className="h-full" style={{ width: `${cvrA * 100}%`, background: ACCENT }} />
                            </div>
                            <span className="w-[110px] text-right font-mono tnum text-[10.5px]" style={{ color: "#9097a3" }}>
                              {s.a.toLocaleString()} · {(cvrA * 100).toFixed(i === 0 ? 0 : 1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] uppercase tracking-[0.1em] font-mono w-3" style={{ color: "#5e6573" }}>B</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div className="h-full" style={{ width: `${cvrB * 100}%`, background: `${ACCENT}66` }} />
                            </div>
                            <span className="w-[110px] text-right font-mono tnum text-[10.5px]" style={{ color: "#5e6573" }}>
                              {s.b.toLocaleString()} · {(cvrB * 100).toFixed(i === 0 ? 0 : 1)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-[60px] shrink-0 text-right">
                          {lift != null && i > 0 ? (
                            <span className="font-mono tnum text-[11.5px] font-semibold" style={{ color: lift > 0 ? "#3fcf8e" : "#ff5876" }}>
                              {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between text-[11px] font-mono" style={{ color: "#5e6573" }}>
              <Link href="/preview/dashboard" className="hover:opacity-80">← all variants</Link>
              <span>V1 · Linear Dark</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
