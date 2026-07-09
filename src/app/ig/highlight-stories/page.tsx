import type { Metadata } from "next";

/* eslint-disable @next/next/no-img-element */
// One 9:16 (1080×1920) story per highlight, so each Instagram highlight has content to save.
// Screenshot each [data-hstory]. View at /ig/highlight-stories.
export const metadata: Metadata = { title: "EscapeHatch — highlight stories", robots: { index: false } };

const C = { card: "var(--color-card)", border: "var(--color-border)", fg: "var(--color-fg)", dim: "var(--color-fg-dim)", muted: "var(--color-fg-muted)", accent: "var(--color-accent)", accentSoft: "var(--color-accent-soft)" };

const Mark = ({ s = 36 }: { s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="#fafafa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);

function Frame({ id, label, hero = false, children }: { id: string; label: string; hero?: boolean; children: React.ReactNode }) {
  return (
    <div data-hstory={id} className="grain" style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden", background: hero ? "linear-gradient(165deg, rgba(91,140,255,0.18), var(--color-card) 55%)" : C.card, padding: "120px 90px", display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--font-sans)", color: C.fg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ width: 68, height: 68, borderRadius: 20, background: "#4f7cff", display: "grid", placeItems: "center" }}><Mark /></span>
        <span style={{ fontSize: 34, fontWeight: 600 }}>getescapehatch</span>
        <span style={{ marginLeft: "auto", fontSize: 26, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent }}>{label}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 0" }}>{children}</div>
      <span style={{ fontSize: 30, color: C.muted, opacity: 0.55, textAlign: "center" }}>@getescapehatch</span>
    </div>
  );
}

const serif = (t: string, s: number) => <div className="h-editorial" style={{ fontSize: s, color: C.fg }}>{t}</div>;
const big = (t: string, s: number) => <div style={{ fontSize: s, fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.fg }}>{t}</div>;

export default function HighlightStories() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexWrap: "wrap", gap: 24, padding: 24, justifyContent: "center" }}>
      {/* PROBLEM / WHY */}
      <Frame id="problem" label="Why">
        {serif("The in-app browser is the worst place to close a sale.", 104)}
        <div style={{ marginTop: 60, display: "grid", gap: 30 }}>
          {[["Conversion", "people bounce in-app; they buy in the real browser"], ["Persistence", "escape to Safari and their session sticks"], ["Experience", "a full browser, not a stripped shell"]].map(([h, s]) => (
            <div key={h}>
              <div style={{ fontSize: 42, fontWeight: 600, color: C.accent }}>{h}</div>
              <div style={{ fontSize: 36, color: C.dim, lineHeight: 1.3 }}>{s}</div>
            </div>
          ))}
        </div>
      </Frame>

      {/* PROOF */}
      <Frame id="proof" label="Proof" hero>
        <div style={{ textAlign: "center" }}>
          <div className="tnum" style={{ fontSize: 420, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 0.82 }}>+45<span style={{ fontSize: "0.38em" }}>%</span></div>
          {big("RPV lift", 90)}
          <p style={{ fontSize: 42, color: C.dim, marginTop: 34, maxWidth: "20ch", marginInline: "auto" }}>Averaged across 30 brands in the portfolio, vs live holdouts.</p>
        </div>
      </Frame>

      {/* SETUP */}
      <Frame id="setup" label="Setup">
        {big("Live in ~15 minutes.", 96)}
        <div style={{ marginTop: 64, display: "grid", gap: 44 }}>
          {[["1", "Paste the snippet"], ["2", "Add the pixel"], ["3", "Add the webhook"]].map(([n, t]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 32 }}>
              <span className="tnum" style={{ width: 84, height: 84, borderRadius: "50%", background: C.accentSoft, color: C.accent, fontSize: 40, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
              <span style={{ fontSize: 58, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </Frame>

      {/* A/B */}
      <Frame id="ab" label="A/B">
        <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40 }}>
          {big("Measured, not modeled.", 78)}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 120, height: 540 }}>
            <div style={{ display: "grid", gap: 22, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 40, color: C.muted }}>$1.00</span>
              <div style={{ width: 150, height: 280, background: C.border, borderRadius: 16 }} />
              <span style={{ fontSize: 38, color: C.muted }}>Control</span>
            </div>
            <div style={{ display: "grid", gap: 22, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 44, fontWeight: 700, color: C.accent }}>$1.45</span>
              <div style={{ width: 150, height: 500, background: C.accent, borderRadius: 16 }} />
              <span style={{ fontSize: 38, color: C.accent }}>EscapeHatch</span>
            </div>
          </div>
          <p style={{ fontSize: 40, color: C.dim, textAlign: "center", margin: 0 }}>Revenue per visitor, vs a live control.</p>
        </div>
      </Frame>

      {/* BRANDS */}
      <Frame id="brands" label="Brands" hero>
        <div>
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.03em", color: C.fg }}>30 brands.</div>
          <div className="tnum" style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.03em", color: C.accent }}>+45% avg RPV.</div>
        </div>
        <div style={{ marginTop: 70, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          {["andar.png", "cove.png", "gfuel.png", "haus.png", "elavi.png", "cased.png"].map((f) => (
            <div key={f} style={{ background: "#fff", borderRadius: 20, padding: "34px 28px", display: "grid", placeItems: "center", height: 190 }}>
              <img src={`/logos/${f}`} alt="" style={{ maxHeight: 90, maxWidth: "100%", objectFit: "contain" }} />
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}
