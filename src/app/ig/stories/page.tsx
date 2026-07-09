import type { Metadata } from "next";

// 9:16 story frames (1080×1920). Screenshot each [data-story]. View at /ig/stories.
export const metadata: Metadata = { title: "EscapeHatch — stories", robots: { index: false } };

const C = { card: "var(--color-card)", border: "var(--color-border)", fg: "var(--color-fg)", dim: "var(--color-fg-dim)", muted: "var(--color-fg-muted)", accent: "var(--color-accent)", accentSoft: "var(--color-accent-soft)" };
const HANDLE = "@getescapehatch";

const Mark = ({ s = 64 }: { s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="#fafafa" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);

function Story({ id, hero = false, children }: { id: string; hero?: boolean; children: React.ReactNode }) {
  return (
    <div data-story={id} className="grain" style={{ position: "relative", width: 1080, height: 1920, overflow: "hidden", background: hero ? "linear-gradient(165deg, rgba(91,140,255,0.18), var(--color-card) 55%)" : C.card, padding: "120px 90px", display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--font-sans)", color: C.fg }}>
      {/* brand chip top */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ width: 68, height: 68, borderRadius: 20, background: "#4f7cff", display: "grid", placeItems: "center" }}><Mark s={36} /></span>
        <span style={{ fontSize: 34, fontWeight: 600 }}>getescapehatch</span>
      </div>
      {children}
      <span style={{ fontSize: 30, color: C.muted, opacity: 0.6, textAlign: "center" }}>{HANDLE}</span>
    </div>
  );
}

const serif = (t: string, s: number) => <div className="h-editorial" style={{ fontSize: s, color: C.fg }}>{t}</div>;
const big = (t: string, s: number) => <div style={{ fontSize: s, fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.fg }}>{t}</div>;

export default function IGStories() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexWrap: "wrap", gap: 24, padding: 24, justifyContent: "center" }}>
      {/* 1 — link-in-bio CTA */}
      <Story id="cta" hero>
        <div>
          {big("Recover the revenue your ads leak.", 92)}
          <p style={{ fontSize: 42, color: C.dim, marginTop: 32, maxWidth: "20ch" }}>One snippet escapes the in-app browser. +45% RPV across 30 brands.</p>
        </div>
        <div style={{ marginBottom: 40 }}>
          <div style={{ background: "#fff", color: "#09090b", borderRadius: 999, padding: "30px 0", textAlign: "center", fontSize: 44, fontWeight: 600 }}>getescapehatch.com ↗</div>
          <p style={{ fontSize: 32, color: C.muted, textAlign: "center", marginTop: 22 }}>Tap the link in bio</p>
        </div>
      </Story>

      {/* 2 — poll / question */}
      <Story id="poll">
        <div>
          <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent }}>Did you know?</span>
          {big("Your Instagram ads don't open in Safari.", 96)}
          <p style={{ fontSize: 40, color: C.dim, marginTop: 32, maxWidth: "22ch" }}>They open in an in-app browser — a worse place to shop, and the session vanishes the moment they leave.</p>
        </div>
        <div style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", borderRadius: 24, overflow: "hidden", border: `1px solid ${C.border}`, fontSize: 44, fontWeight: 600 }}>
            <div style={{ flex: 1, padding: "36px 0", textAlign: "center", background: C.accentSoft, color: C.accent }}>Wait, really?</div>
            <div style={{ flex: 1, padding: "36px 0", textAlign: "center", color: C.dim }}>I knew it</div>
          </div>
          <p style={{ fontSize: 32, color: C.muted, textAlign: "center", marginTop: 26 }}>Fix it → link in bio</p>
        </div>
      </Story>

      {/* 3 — vertical stat hero */}
      <Story id="stat">
        <div />
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent }}>Measured lift</span>
          <div className="tnum" style={{ fontSize: 400, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 0.82, marginTop: 20 }}>+45<span style={{ fontSize: "0.4em" }}>%</span></div>
          {big("RPV, across 30 brands.", 66)}
          <p style={{ fontSize: 38, color: C.dim, marginTop: 28 }}>vs a live holdout</p>
        </div>
        <div style={{ textAlign: "center", fontSize: 40, fontWeight: 600, color: C.accent }}>getescapehatch.com</div>
      </Story>
    </div>
  );
}
