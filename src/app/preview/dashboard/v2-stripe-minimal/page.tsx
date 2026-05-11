import Link from "next/link";
import { mockData as d } from "../_mock";

const ACCENT = "#635bff";

export default function V2StripeMinimal() {
  const baseA = d.funnel[0].a;
  const baseB = d.funnel[0].b;

  return (
    <div className="min-h-dvh" style={{ background: "#ffffff", color: "#0a2540", fontFeatureSettings: '"ss01"' }}>
      {/* Top bar — minimal */}
      <header className="h-14 px-8 flex items-center justify-between border-b" style={{ borderColor: "#f0f0f4" }}>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded-md grid place-items-center" style={{ background: ACCENT }}>
            <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
            </svg>
          </span>
          <span className="text-[14px] font-semibold tracking-tight">EscapeHatch</span>
          <span className="text-[14px]" style={{ color: "#697386" }}>/</span>
          <span className="text-[14px]">{d.merchant.name}</span>
        </div>
        <div className="flex items-center gap-6 text-[13px]" style={{ color: "#697386" }}>
          <span style={{ color: "#0a2540" }}>Overview</span>
          <span>Install</span>
          <span>Settings</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-16">
        {/* Hero — single huge number */}
        <div className="mb-4 text-[12px] uppercase tracking-[0.14em] font-medium" style={{ color: "#697386" }}>
          Lift on bucket A · {d.rangeLabel}
        </div>
        <div className="flex items-baseline gap-6 flex-wrap">
          <div className="leading-none tnum tracking-tighter font-semibold" style={{ fontSize: "96px", color: "#0a2540" }}>
            +{(d.liftPct * 100).toFixed(1)}<span style={{ color: "#697386", fontSize: "64px" }}>%</span>
          </div>
          <div>
            <div className="text-[15px]" style={{ color: "#0a2540" }}>
              <span className="font-semibold">{(d.confident * 100).toFixed(0)}%</span> confident · p = {d.pValue.toFixed(3)}
            </div>
            <div className="mt-1 text-[13.5px]" style={{ color: "#697386" }}>
              Variant A converts <strong>{(d.liftPct * 100).toFixed(1)}%</strong> better than control. Continue running.
            </div>
          </div>
        </div>

        {/* Range chips */}
        <div className="mt-10 flex items-center gap-1">
          {["24h", "7d", "14d", "30d", "90d"].map((r) => (
            <button key={r} className="text-[13px] px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: r === "14d" ? "#f6f9fc" : "transparent",
                color: r === "14d" ? "#0a2540" : "#697386",
                fontWeight: r === "14d" ? 500 : 400,
              }}>
              {r}
            </button>
          ))}
        </div>

        {/* KPI grid — flat, no card chrome, just spacing */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-8">
          {[
            { l: "Impressions", v: d.impressions.toLocaleString(), s: "in test population", delta: "+8.4%" },
            { l: "Escape rate", v: `${(d.escapeRate * 100).toFixed(0)}%`, s: "of bucket A", delta: "+1.2%" },
            { l: "Revenue", v: `$${d.revenue.toLocaleString()}`, s: `${d.purchases} purchases`, delta: "+18.7%" },
            { l: "Sample / bucket", v: baseA.toLocaleString(), s: "need 8.4k for MDE", delta: null },
          ].map((k, i) => (
            <div key={i}>
              <div className="text-[12px] uppercase tracking-[0.12em] font-medium" style={{ color: "#697386" }}>{k.l}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="text-[32px] font-semibold tnum tracking-tight">{k.v}</div>
                {k.delta ? (
                  <span className="text-[13px] font-medium" style={{ color: "#0e9f6e" }}>↑ {k.delta}</span>
                ) : null}
              </div>
              <div className="mt-1 text-[12.5px]" style={{ color: "#697386" }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* Funnel — minimal */}
        <div className="mt-20">
          <div className="text-[18px] font-semibold tracking-tight">Funnel</div>
          <div className="mt-1 text-[13.5px]" style={{ color: "#697386" }}>Conversion rate from impressions, bucket A vs B.</div>

          <div className="mt-8 space-y-6">
            {d.funnel.map((s, i) => {
              const cvrA = baseA > 0 ? s.a / baseA : 0;
              const cvrB = baseB > 0 ? s.b / baseB : 0;
              const lift = cvrB > 0 ? (cvrA - cvrB) / cvrB : null;
              return (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div className="text-[14px] font-medium tracking-tight">{s.label}</div>
                    {lift != null && i > 0 ? (
                      <span className="text-[13px] font-medium tnum" style={{ color: lift > 0 ? "#0e9f6e" : "#cd3500" }}>
                        {lift > 0 ? "+" : ""}{(lift * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-6 text-[10.5px] uppercase tracking-[0.1em]" style={{ color: "#697386" }}>A</div>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f6f9fc" }}>
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${cvrA * 100}%`, background: ACCENT }} />
                      </div>
                      <div className="w-[130px] text-right text-[12.5px] tnum" style={{ color: "#0a2540" }}>
                        {s.a.toLocaleString()} <span style={{ color: "#697386" }}>· {(cvrA * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-6 items-center">
                    <div className="flex-1 flex items-center gap-3">
                      <div className="w-6 text-[10.5px] uppercase tracking-[0.1em]" style={{ color: "#697386" }}>B</div>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f6f9fc" }}>
                        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${cvrB * 100}%`, background: `${ACCENT}66` }} />
                      </div>
                      <div className="w-[130px] text-right text-[12.5px] tnum" style={{ color: "#697386" }}>
                        {s.b.toLocaleString()} <span style={{ color: "#697386" }}>· {(cvrB * 100).toFixed(i === 0 ? 0 : 1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-20 pt-6 border-t flex items-center justify-between text-[12px]" style={{ borderColor: "#f0f0f4", color: "#697386" }}>
          <Link href="/preview/dashboard" className="hover:underline">← all variants</Link>
          <span>V2 · Stripe Minimal</span>
        </div>
      </div>
    </div>
  );
}
