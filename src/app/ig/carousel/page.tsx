import type { Metadata } from "next";

// 5-slide educational carousel (1080). Screenshot each [data-slide]. View at /ig/carousel.
export const metadata: Metadata = { title: "EscapeHatch — carousel", robots: { index: false } };

const C = { card: "var(--color-card)", border: "var(--color-border)", fg: "var(--color-fg)", dim: "var(--color-fg-dim)", muted: "var(--color-fg-muted)", accent: "var(--color-accent)", accentSoft: "var(--color-accent-soft)" };
const HANDLE = "@getescapehatch";
const TOTAL = 5;

function Slide({ n, hero = false, children }: { n: number; hero?: boolean; children: React.ReactNode }) {
  return (
    <div data-slide={n} className="grain" style={{ position: "relative", width: 1080, height: 1080, overflow: "hidden", background: hero ? "linear-gradient(158deg, rgba(91,140,255,0.16), var(--color-card) 60%)" : C.card, padding: 84, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--font-sans)", color: C.fg }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent }}>The in-app tax</span>
        <span className="tnum" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 24, color: C.muted }}>{n} / {TOTAL}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "44px 0" }}>{children}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ fontSize: 30, fontWeight: 600, color: n < TOTAL ? C.accent : C.muted }}>{n < TOTAL ? "swipe →" : "getescapehatch.com"}</span>
        <span style={{ fontSize: 26, color: C.muted, opacity: 0.5 }}>{HANDLE}</span>
      </div>
    </div>
  );
}

const serif = (t: string, s: number) => <div className="h-editorial" style={{ fontSize: s, color: C.fg }}>{t}</div>;
const big = (t: string, s: number) => <div style={{ fontSize: s, fontWeight: 600, lineHeight: 1.06, letterSpacing: "-0.03em", color: C.fg }}>{t}</div>;

export default function IGCarousel() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24 }}>
      {/* 1 cover */}
      <Slide n={1} hero>{serif("The in-app browser tax, explained.", 118)}</Slide>

      {/* 2 what happens */}
      <Slide n={2}>
        {big("You run a great ad. Someone taps. But it never opens in their real browser —", 72)}
        <p style={{ fontSize: 38, color: C.dim, marginTop: 28, maxWidth: "24ch" }}>it opens in Instagram&apos;s in-app browser, a stripped-down shell.</p>
      </Slide>

      {/* 3 the three leaks */}
      <Slide n={3}>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, marginBottom: 28 }}>Three silent leaks</div>
        <div style={{ display: "grid", gap: 30 }}>
          {["Cookies get wiped — every shopper looks brand-new.", "One-tap checkout breaks — Apple Pay falls back to forms.", "It's invisible — GA & Shopify can't see it."].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <span className="tnum" style={{ fontSize: 44, fontWeight: 700, color: C.accent }}>{i + 1}</span>
              <span style={{ fontSize: 46, fontWeight: 500, lineHeight: 1.2, color: C.fg }}>{t}</span>
            </div>
          ))}
        </div>
      </Slide>

      {/* 4 the fix */}
      <Slide n={4} hero>
        {serif("One snippet escapes to the real browser.", 104)}
        <div style={{ marginTop: 40, fontFamily: "var(--font-mono)", fontSize: 30, lineHeight: 1.55, color: C.accent, background: C.accentSoft, border: `1px solid ${C.border}`, borderRadius: 18, padding: "24px 30px", whiteSpace: "pre-wrap", display: "inline-block", alignSelf: "flex-start" }}>
          {'<script\n  src="getescapehatch.com/e.js">'}
        </div>
      </Slide>

      {/* 5 result + CTA */}
      <Slide n={5} hero>
        <div className="tnum" style={{ fontSize: 220, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 0.85 }}>+45<span style={{ fontSize: "0.42em" }}>%</span></div>
        {big("RPV lift, averaged across 30 brands.", 62)}
        <p style={{ fontSize: 38, color: C.dim, marginTop: 24 }}>Measured against live A/B holdouts. See your own lift ↓</p>
      </Slide>
    </div>
  );
}
