import type { Metadata } from "next";

// Native 1080×1080 render of each feed tile — typography and spacing tuned for the real
// export size (not DPI-upscaled from the tiny profile grid). Screenshot each [data-post]
// element to get clean Instagram posts. View at /ig/export.

export const metadata: Metadata = { title: "EscapeHatch — IG export", robots: { index: false } };

const C = {
  bg: "var(--color-bg)",
  card: "var(--color-card)",
  border: "var(--color-border)",
  fg: "var(--color-fg)",
  dim: "var(--color-fg-dim)",
  muted: "var(--color-fg-muted)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
};

const PAD = 88;

const Icon = ({ d, s = 96 }: { d: string; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((p, i) => <path key={i} d={/^[Mm]/.test(p.trim()) ? p : "M" + p} />)}
  </svg>
);

const kicker = (t: string) => (
  <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent }}>{t}</span>
);
const head = (t: string, size: number) => (
  <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.025em", color: C.fg }}>{t}</div>
);
const serif = (t: string, size: number) => (
  <div className="h-editorial" style={{ fontSize: size, color: C.fg }}>{t}</div>
);
const sub = (t: string) => <p style={{ fontSize: 33, lineHeight: 1.4, color: C.dim, margin: 0, maxWidth: "16ch" }}>{t}</p>;

function Post({ i, hero = false, children }: { i: number; hero?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-post={i}
      className="grain"
      style={{
        position: "relative",
        width: 1080,
        height: 1080,
        overflow: "hidden",
        background: hero ? "linear-gradient(158deg, rgba(91,140,255,0.16), var(--color-card) 60%)" : C.card,
        padding: PAD,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-sans)",
        color: C.fg,
      }}
    >
      {children}
      <span style={{ position: "absolute", right: 40, bottom: 34, fontSize: 26, letterSpacing: "0.02em", color: C.muted, opacity: 0.5 }}>@escapehatch</span>
    </div>
  );
}

export default function IGExport() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24 }}>
      {/* 1 — hook */}
      <Post i={1}>
        {kicker("The hidden tax")}
        <div style={{ marginTop: "auto" }}>{serif("The in-app browser is quietly taxing every paid click.", 108)}</div>
      </Post>

      {/* 2 — cookies */}
      <Post i={2}>
        <Icon d="M12 3a9 9 0 109 9 4 4 0 01-5-5 4 4 0 01-4-4Z|9 12h.01|13 15h.01|15 10h.01" />
        <div style={{ marginTop: "auto", display: "grid", gap: 18 }}>{head("Cookies get wiped.", 68)}{sub("Returning shoppers look brand-new. Every session starts cold.")}</div>
      </Post>

      {/* 3 — checkout */}
      <Post i={3}>
        <Icon d="M5 11V8a4 4 0 018 0|3 11h12v9H3z|9 15v2" />
        <div style={{ marginTop: "auto", display: "grid", gap: 18 }}>{head("One-tap checkout breaks.", 68)}{sub("Apple Pay & Shop Pay fall back to manual forms. Conversion drops.")}</div>
      </Post>

      {/* 4 — invisible */}
      <Post i={4}>
        <Icon d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z|12 9v6|9 12h6" />
        <div style={{ marginTop: "auto", display: "grid", gap: 18 }}>{head("Invisible in your analytics.", 68)}{sub("GA & Shopify can't see the in-app tax — so you optimize blind.")}</div>
      </Post>

      {/* 5 — the fix (hero) */}
      <Post i={5} hero>
        {kicker("The fix")}
        <div style={{ marginTop: "auto", display: "grid", gap: 40 }}>
          {serif("One snippet. Real browser.", 104)}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 29, lineHeight: 1.55, color: C.accent, background: C.accentSoft, border: `1px solid ${C.border}`, borderRadius: 18, padding: "26px 30px", whiteSpace: "pre-wrap" }}>
            {'<script\n  src="escapehatch.app/e.js">'}
          </div>
        </div>
      </Post>

      {/* 6 — setup */}
      <Post i={6}>
        {kicker("Live in ~15 min")}
        <div style={{ marginTop: "auto", display: "grid", gap: 26 }}>
          {[["1", "Paste the snippet"], ["2", "Add the pixel"], ["3", "Add the webhook"]].map(([n, t]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <span className="tnum" style={{ width: 62, height: 62, borderRadius: "50%", background: C.accentSoft, color: C.accent, fontSize: 30, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
              <span style={{ fontSize: 44, color: C.fg }}>{t}</span>
            </div>
          ))}
        </div>
      </Post>

      {/* 7 — stat */}
      <Post i={7}>
        {kicker("Measured lift")}
        <div style={{ marginTop: "auto" }}>
          <div className="tnum" style={{ fontSize: 190, fontWeight: 700, letterSpacing: "-0.04em", color: C.accent, lineHeight: 0.9 }}>+14.2<span style={{ fontSize: "0.55em" }}>%</span></div>
          <div style={{ fontSize: 52, fontWeight: 600, color: C.fg, marginTop: 12 }}>RPV</div>
          {sub("Revenue per visitor, vs a live holdout.")}
        </div>
      </Post>

      {/* 8 — A/B proof */}
      <Post i={8}>
        {kicker("Defensible")}
        <div style={{ marginTop: "auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 90, height: 340 }}>
            <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 28, color: C.muted }}>$1.00</span>
              <div style={{ width: 104, height: 172, background: C.border, borderRadius: 10 }} />
              <span style={{ fontSize: 30, color: C.muted }}>Control</span>
            </div>
            <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 28, fontWeight: 600, color: C.accent }}>$1.14</span>
              <div style={{ width: 104, height: 300, background: C.accent, borderRadius: 10 }} />
              <span style={{ fontSize: 30, color: C.accent }}>EscapeHatch</span>
            </div>
          </div>
          <div style={{ fontSize: 34, color: C.dim, marginTop: 40, maxWidth: "20ch" }}>A live A/B dashboard your CFO can trust.</div>
        </div>
      </Post>

      {/* 9 — CTA (hero) */}
      <Post i={9} hero>
        <div style={{ marginTop: "auto" }}>
          {head("Recover the revenue your ads leak.", 76)}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginTop: 40, fontSize: 40, fontWeight: 600, color: C.accent }}>escapehatch.app <span aria-hidden>→</span></div>
        </div>
      </Post>
    </div>
  );
}
