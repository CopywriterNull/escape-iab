import Link from "next/link";
import { mockData as d } from "../_mock";

const PHOSPHOR = "#00d97e";
const PHOSPHOR_DIM = "#0e9f6e";
const BG = "#0c0c0e";
const FG = "#dcdcdc";
const FG_DIM = "#7e8087";
const FG_MUTED = "#4a4d54";
const LINE = "#1d1e23";

export default function V3Terminal() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div
      className="min-h-dvh"
      style={{
        background: BG,
        color: FG,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: "13px",
        backgroundImage: `radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }}
    >
      {/* Top status bar */}
      <header className="h-9 px-4 flex items-center justify-between border-b" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-3 text-[11.5px]">
          <span style={{ color: PHOSPHOR }}>●</span>
          <span style={{ color: FG }}>ESCAPEHATCH</span>
          <span style={{ color: FG_MUTED }}>::</span>
          <span style={{ color: FG_DIM }}>{d.merchant.name.toUpperCase()}</span>
          <span style={{ color: FG_MUTED }}>::</span>
          <span style={{ color: FG_DIM }}>{d.merchant.domain}</span>
        </div>
        <div className="text-[11px]" style={{ color: FG_MUTED }}>
          [OVERVIEW] [INSTALL] [SETTINGS]
        </div>
      </header>

      <div className="px-6 py-6 max-w-6xl mx-auto">
        {"/* Hero ASCII-ish */"}
        <div className="mb-6">
          <div className="text-[10.5px] tracking-[0.18em]" style={{ color: FG_MUTED }}>
            {"// LIFT_OBSERVED · "}
            {d.rangeLabel.toUpperCase()}
          </div>
          <div className="mt-2 flex items-baseline gap-4">
            <div className="text-[56px] leading-none tnum tracking-tight font-semibold" style={{ color: PHOSPHOR }}>
              +{(d.liftPct * 100).toFixed(1)}%
            </div>
            <div className="text-[12px]" style={{ color: FG_DIM }}>
              <div>P_VALUE = {d.pValue.toFixed(3)}</div>
              <div style={{ color: FG_MUTED }}>CONFIDENCE = {(d.confident * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Range — ASCII-style */}
        <div className="mb-6 flex items-center gap-0">
          <span className="text-[11px]" style={{ color: FG_MUTED }}>[</span>
          {["24h", "7d", "14d", "30d", "90d"].map((r, i) => (
            <span key={r}>
              {i > 0 ? <span className="text-[11px]" style={{ color: FG_MUTED }}> | </span> : null}
              <span className="text-[11.5px] tnum"
                style={{ color: r === "14d" ? PHOSPHOR : FG_DIM, fontWeight: r === "14d" ? 700 : 400 }}>
                {r === "14d" ? `>${r}<` : r}
              </span>
            </span>
          ))}
          <span className="text-[11px]" style={{ color: FG_MUTED }}>]</span>
        </div>

        {/* KPI table — old-school */}
        <div className="border" style={{ borderColor: LINE }}>
          <div className="px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] border-b flex items-center justify-between" style={{ borderColor: LINE, color: FG_DIM, background: "rgba(255,255,255,0.012)" }}>
            <span>METRIC</span><span>VALUE</span><span>Δ vs PRIOR</span>
          </div>
          {[
            { l: "IMPRESSIONS", v: d.impressions.toLocaleString(), s: `${d.escapeAttempts} ESCAPES`, delta: "+8.4%" },
            { l: "ESCAPE_RATE", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "OF BUCKET A", delta: "+1.2%" },
            { l: "REVENUE_USD", v: `$${d.revenue.toLocaleString()}.00`, s: `${d.purchases} PURCHASES`, delta: "+18.7%" },
            { l: "SAMPLE/BUCKET", v: baseA.toLocaleString(), s: "8.4K NEEDED", delta: null },
          ].map((k, i) => (
            <div key={i} className="px-3 py-2 grid grid-cols-3 items-center border-b last:border-b-0" style={{ borderColor: LINE }}>
              <div>
                <div className="text-[11.5px]" style={{ color: FG }}>{k.l}</div>
                <div className="text-[10px]" style={{ color: FG_MUTED }}>{k.s}</div>
              </div>
              <div className="text-[14px] tnum" style={{ color: FG }}>{k.v}</div>
              <div className="text-right text-[11.5px] tnum">
                {k.delta ? <span style={{ color: PHOSPHOR }}>↑ {k.delta}</span> : <span style={{ color: FG_MUTED }}>—</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Funnel — ASCII bars */}
        <div className="mt-6 border" style={{ borderColor: LINE }}>
          <div className="px-3 py-2 text-[10.5px] uppercase tracking-[0.14em] border-b" style={{ borderColor: LINE, color: FG_DIM, background: "rgba(255,255,255,0.012)" }}>
            FUNNEL :: A_ESCAPE vs B_CONTROL
          </div>
          <div className="p-3">
            {d.funnel.map((s, i) => {
              const cvrA = baseA > 0 ? s.a / baseA : 0;
              const cvrB = baseB > 0 ? s.b / baseB : 0;
              const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
              const aBlocks = Math.max(1, Math.round(cvrA * 36));
              const bBlocks = Math.max(1, Math.round(cvrB * 36));
              return (
                <div key={s.label} className={i > 0 ? "mt-3" : ""}>
                  <div className="flex items-baseline justify-between text-[11.5px]">
                    <span style={{ color: FG }}>[{(i + 1).toString().padStart(2, "0")}] {s.label.toUpperCase()}</span>
                    {lift != null && i > 0 ? (
                      <span className="tnum" style={{ color: lift > 0 ? PHOSPHOR : "#ff5876" }}>
                        Δ = {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span style={{ color: FG_MUTED }}>BASELINE</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] tnum" style={{ color: PHOSPHOR }}>
                    A│{"█".repeat(aBlocks)}{"░".repeat(36 - aBlocks)}│ {s.a.toLocaleString().padStart(6)} {(cvrA * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                  </div>
                  <div className="text-[11px] tnum" style={{ color: PHOSPHOR_DIM }}>
                    B│{"█".repeat(bBlocks)}{"░".repeat(36 - bBlocks)}│ {s.b.toLocaleString().padStart(6)} {(cvrB * 100).toFixed(i === 0 ? 0 : 1).padStart(5)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[11px]" style={{ color: FG_MUTED }}>
          <Link href="/preview/dashboard" className="hover:opacity-80">← ALL_VARIANTS</Link>
          <span>V3 :: TERMINAL :: PHOSPHOR-GREEN</span>
        </div>
      </div>
    </div>
  );
}
