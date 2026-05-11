import Link from "next/link";
import { mockData as d } from "../_mock";

const BG = "#fdfcfb";
const CARD = "#ffffff";
const FG = "#37352f";
const FG_DIM = "#787671";
const FG_MUTED = "#a4a097";
const LINE = "#ece9e3";
const PURPLE = "#9b6bff";
const PURPLE_SOFT = "rgba(155, 107, 255, 0.10)";
const GREEN = "#4cae87";
const GREEN_SOFT = "rgba(76, 174, 135, 0.10)";
const BLUE = "#4a8fd8";
const BLUE_SOFT = "rgba(74, 143, 216, 0.10)";
const ORANGE = "#dd8855";
const ORANGE_SOFT = "rgba(221, 136, 85, 0.10)";

export default function V5NotionSoft() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div className="min-h-dvh" style={{ background: BG, color: FG }}>
      {/* Top nav */}
      <header className="h-14 px-6 flex items-center justify-between border-b" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-3">
          <span className="size-7 rounded-xl grid place-items-center" style={{ background: PURPLE_SOFT }}>
            <span style={{ color: PURPLE, fontSize: "16px" }}>↗</span>
          </span>
          <span className="text-[14px] font-medium">EscapeHatch</span>
          <span className="text-[14px]" style={{ color: FG_MUTED }}>/</span>
          <span className="text-[14px]">{d.merchant.name}</span>
        </div>
        <nav className="flex items-center gap-1 text-[13px]">
          {["Overview", "Install", "Settings"].map((t) => (
            <span key={t} className="px-3 py-1.5 rounded-lg"
              style={{
                background: t === "Overview" ? "rgba(0,0,0,0.04)" : "transparent",
                color: t === "Overview" ? FG : FG_DIM,
                fontWeight: t === "Overview" ? 500 : 400,
              }}>
              {t}
            </span>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Hero — friendly, with emoji */}
        <div className="rounded-2xl p-6 border" style={{ background: GREEN_SOFT, borderColor: "transparent" }}>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl grid place-items-center text-[24px]" style={{ background: "#ffffff" }}>
              🚀
            </div>
            <div className="flex-1">
              <div className="text-[12px] uppercase tracking-[0.08em]" style={{ color: GREEN, fontWeight: 600 }}>
                Test is winning
              </div>
              <div className="mt-1 text-[28px] font-semibold tracking-tight tnum">
                Bucket A converts <span style={{ color: GREEN }}>+{(d.liftPct * 100).toFixed(1)}%</span> better than control
              </div>
              <div className="mt-2 text-[13.5px]" style={{ color: FG_DIM }}>
                {(d.confident * 100).toFixed(0)}% confident over the last {d.rangeLabel.toLowerCase()} · p = {d.pValue.toFixed(3)}. You can call this one.
              </div>
            </div>
          </div>
        </div>

        {/* Range picker — pill row */}
        <div className="mt-6 flex items-center gap-1.5">
          {["24h", "7d", "14d", "30d", "90d"].map((r) => (
            <button key={r} className="text-[13px] px-3 py-1.5 rounded-xl transition-colors"
              style={{
                background: r === "14d" ? "rgba(0,0,0,0.05)" : "transparent",
                color: r === "14d" ? FG : FG_DIM,
                fontWeight: r === "14d" ? 500 : 400,
              }}>
              {r}
            </button>
          ))}
        </div>

        {/* KPI grid — color-coded soft cards */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Impressions", v: d.impressions.toLocaleString(), s: `${d.escapeAttempts} escapes`, delta: "+8.4%", color: BLUE, soft: BLUE_SOFT, icon: "👁️" },
            { l: "Escape rate", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "of bucket A", delta: "+1.2%", color: ORANGE, soft: ORANGE_SOFT, icon: "🚪" },
            { l: "Revenue", v: `$${d.revenue.toLocaleString()}`, s: `${d.purchases} purchases`, delta: "+18.7%", color: GREEN, soft: GREEN_SOFT, icon: "💸" },
            { l: "Lift A v B", v: `+${(d.liftPct * 100).toFixed(1)}%`, s: `${(d.confident * 100).toFixed(0)}% confident`, delta: null, color: PURPLE, soft: PURPLE_SOFT, icon: "✨" },
          ].map((k, i) => (
            <div key={i} className="rounded-2xl p-4 border" style={{ borderColor: LINE, background: CARD }}>
              <div className="flex items-center justify-between">
                <span className="size-7 rounded-lg grid place-items-center text-[14px]" style={{ background: k.soft }}>{k.icon}</span>
                {k.delta ? (
                  <span className="text-[11px] tnum px-2 py-0.5 rounded-full" style={{ background: GREEN_SOFT, color: GREEN, fontWeight: 500 }}>
                    ↑ {k.delta}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-[11.5px]" style={{ color: FG_DIM }}>{k.l}</div>
              <div className="mt-0.5 text-[22px] font-semibold tnum tracking-tight">{k.v}</div>
              <div className="text-[11.5px] mt-1" style={{ color: FG_MUTED }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Funnel — friendly rounded */}
        <div className="mt-8 rounded-2xl p-6 border" style={{ borderColor: LINE, background: CARD }}>
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-[16px] font-medium">Funnel</div>
            <div className="text-[11.5px]" style={{ color: FG_MUTED }}>A vs B · {d.rangeLabel}</div>
          </div>
          <p className="text-[12.5px] mb-5" style={{ color: FG_DIM }}>
            Where visitors fall off, stage by stage. Wider bar = winning bucket.
          </p>
          <div className="space-y-4">
            {d.funnel.map((s, i) => {
              const cvrA = baseA > 0 ? s.a / baseA : 0;
              const cvrB = baseB > 0 ? s.b / baseB : 0;
              const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
              return (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-[13.5px] font-medium">{s.label}</span>
                      <span className="text-[11.5px] ml-2" style={{ color: FG_MUTED }}>{s.sub}</span>
                    </div>
                    {lift != null && i > 0 ? (
                      <span className="text-[12px] tnum px-2 py-0.5 rounded-full" style={{
                        background: lift > 0 ? GREEN_SOFT : "rgba(220, 38, 38, 0.08)",
                        color: lift > 0 ? GREEN : "#dc2626",
                        fontWeight: 500,
                      }}>
                        {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.04)", color: FG_MUTED }}>
                        baseline
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[10.5px] uppercase tracking-[0.08em] font-mono" style={{ color: FG_MUTED }}>A</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                        <div className="h-full rounded-full" style={{ width: `${cvrA * 100}%`, background: PURPLE }} />
                      </div>
                      <span className="w-[120px] text-right text-[12px] tnum" style={{ color: FG }}>
                        {s.a.toLocaleString()} <span style={{ color: FG_MUTED }}>· {(cvrA * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[10.5px] uppercase tracking-[0.08em] font-mono" style={{ color: FG_MUTED }}>B</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
                        <div className="h-full rounded-full" style={{ width: `${cvrB * 100}%`, background: `${PURPLE}66` }} />
                      </div>
                      <span className="w-[120px] text-right text-[12px] tnum" style={{ color: FG_DIM }}>
                        {s.b.toLocaleString()} <span style={{ color: FG_MUTED }}>· {(cvrB * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-[12px]" style={{ color: FG_MUTED }}>
          <Link href="/preview/dashboard" className="hover:underline">← all variants</Link>
          <span>V5 · Notion Soft</span>
        </div>
      </div>
    </div>
  );
}
