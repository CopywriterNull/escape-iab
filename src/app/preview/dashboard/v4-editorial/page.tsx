import Link from "next/link";
import { mockData as d } from "../_mock";

const BG = "#faf7f2";
const FG = "#1a1612";
const FG_DIM = "#605852";
const FG_MUTED = "#9b938a";
const ACCENT = "#b8331f";
const LINE = "#e8e2d8";
const CARD = "#fdfbf6";

export default function V4Editorial() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div className="min-h-dvh" style={{ background: BG, color: FG }}>
      {/* Editorial top — wordmark + masthead */}
      <header className="border-b" style={{ borderColor: LINE }}>
        <div className="mx-auto max-w-6xl px-8 py-6 flex items-end justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono" style={{ color: FG_MUTED }}>
              EscapeHatch / Vol. 01 / {d.merchant.name}
            </div>
            <h1 className="mt-1 leading-none" style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              fontSize: "36px",
              letterSpacing: "-0.015em",
              color: FG,
            }}>
              Overview
            </h1>
          </div>
          <nav className="flex items-center gap-5 text-[12.5px]" style={{ color: FG_DIM }}>
            <span style={{ color: FG, fontWeight: 500 }}>Overview</span>
            <span>Install</span>
            <span>Settings</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-8 py-12">
        {/* Asymmetric hero: 5/12 + 7/12 */}
        <div className="grid grid-cols-12 gap-10">
          {/* Left: editorial pull-quote style */}
          <div className="col-span-12 md:col-span-5">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono" style={{ color: FG_MUTED }}>
              The headline
            </div>
            <div className="mt-3 leading-[0.95]" style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              fontSize: "72px",
              letterSpacing: "-0.02em",
              color: ACCENT,
            }}>
              +{(d.liftPct * 100).toFixed(1)}%
            </div>
            <p className="mt-5 text-[15.5px] leading-[1.55]" style={{ color: FG_DIM, maxWidth: "32ch" }}>
              Variant A converts <strong style={{ color: FG }}>{(d.liftPct * 100).toFixed(1)}%</strong> better than control over the last {d.rangeLabel.toLowerCase()}. {(d.confident * 100).toFixed(0)}% confident — significance threshold cleared.
            </p>
            <div className="mt-6 text-[11.5px] font-mono" style={{ color: FG_MUTED }}>
              p = {d.pValue.toFixed(3)} · 5 stages tested
            </div>
          </div>

          {/* Right: stat blocks in 2x2 */}
          <div className="col-span-12 md:col-span-7 grid grid-cols-2 gap-px" style={{ background: LINE }}>
            {[
              { l: "Impressions", v: d.impressions.toLocaleString(), s: `${d.escapeAttempts.toLocaleString()} escapes` },
              { l: "Escape rate", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "on bucket A" },
              { l: "Revenue", v: `$${d.revenue.toLocaleString()}`, s: `${d.purchases} purchases` },
              { l: "Sample size", v: baseA.toLocaleString(), s: "per bucket · 8.4k goal" },
            ].map((k, i) => (
              <div key={i} className="p-6" style={{ background: CARD }}>
                <div className="text-[10.5px] uppercase tracking-[0.16em] font-mono" style={{ color: FG_MUTED }}>{k.l}</div>
                <div className="mt-3 leading-none tnum" style={{
                  fontSize: "32px",
                  letterSpacing: "-0.022em",
                  fontWeight: 500,
                  color: FG,
                }}>
                  {k.v}
                </div>
                <div className="mt-2 text-[12.5px]" style={{ color: FG_DIM, fontStyle: "italic" }}>
                  {k.s}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Range strip */}
        <div className="mt-12 flex items-center gap-1 pb-3 border-b" style={{ borderColor: LINE }}>
          {["24h", "7d", "14d", "30d", "90d"].map((r) => (
            <button key={r} className="text-[12.5px] px-3 py-1 transition-colors"
              style={{
                color: r === "14d" ? ACCENT : FG_DIM,
                fontStyle: "italic",
                fontFamily: r === "14d" ? "var(--font-display), Georgia, serif" : "inherit",
                fontSize: r === "14d" ? "16px" : "12.5px",
                lineHeight: 1,
                borderBottom: r === "14d" ? `1.5px solid ${ACCENT}` : "1.5px solid transparent",
              }}>
              {r}
            </button>
          ))}
        </div>

        {/* Funnel — editorial table */}
        <div className="mt-12 grid grid-cols-12 gap-10">
          <div className="col-span-12 md:col-span-3">
            <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono" style={{ color: FG_MUTED }}>
              Section 02
            </div>
            <h2 className="mt-2 leading-[1]" style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              fontSize: "44px",
              letterSpacing: "-0.02em",
              color: FG,
            }}>
              The funnel.
            </h2>
            <p className="mt-4 text-[13.5px] leading-[1.6]" style={{ color: FG_DIM }}>
              Five stages from first impression to completed purchase, A versus B.
              The wider bar is winning.
            </p>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="space-y-7">
              {d.funnel.map((s, i) => {
                const cvrA = baseA > 0 ? s.a / baseA : 0;
                const cvrB = baseB > 0 ? s.b / baseB : 0;
                const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
                return (
                  <div key={s.label} className="grid grid-cols-12 gap-3 items-baseline">
                    <div className="col-span-12 md:col-span-3">
                      <div className="text-[14px] tracking-tight font-medium">{s.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: FG_MUTED, fontStyle: "italic" }}>{s.sub}</div>
                    </div>
                    <div className="col-span-12 md:col-span-7 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="w-4 text-[10px] uppercase tracking-[0.1em]" style={{ color: FG_MUTED }}>A</span>
                        <div className="flex-1 h-[3px] overflow-hidden" style={{ background: LINE }}>
                          <div className="h-full" style={{ width: `${cvrA * 100}%`, background: ACCENT }} />
                        </div>
                        <span className="text-[12px] tnum w-[110px] text-right" style={{ color: FG }}>
                          {s.a.toLocaleString()} <span style={{ color: FG_MUTED }}>· {(cvrA * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-4 text-[10px] uppercase tracking-[0.1em]" style={{ color: FG_MUTED }}>B</span>
                        <div className="flex-1 h-[3px] overflow-hidden" style={{ background: LINE }}>
                          <div className="h-full" style={{ width: `${cvrB * 100}%`, background: `${ACCENT}55` }} />
                        </div>
                        <span className="text-[12px] tnum w-[110px] text-right" style={{ color: FG_DIM }}>
                          {s.b.toLocaleString()} <span style={{ color: FG_MUTED }}>· {(cvrB * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                        </span>
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-2 text-right">
                      {lift != null && i > 0 ? (
                        <span className="tnum text-[18px]" style={{
                          fontFamily: "var(--font-display), Georgia, serif",
                          fontStyle: "italic",
                          color: lift > 0 ? ACCENT : "#7b2515",
                        }}>
                          {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[11px]" style={{ color: FG_MUTED, fontStyle: "italic" }}>baseline</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t flex items-center justify-between text-[12px]" style={{ borderColor: LINE, color: FG_MUTED }}>
          <Link href="/preview/dashboard" className="hover:underline">← all variants</Link>
          <span style={{ fontStyle: "italic" }}>V4 — Editorial</span>
        </div>
      </div>
    </div>
  );
}
