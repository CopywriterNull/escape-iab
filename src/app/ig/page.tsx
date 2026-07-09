import type { Metadata } from "next";

// EscapeHatch Instagram launch kit — a screenshot-ready IG profile for the product whose
// whole job is escaping the Instagram in-app browser. Dark, on-brand, token-driven.
// View at /ig. Screenshot the whole profile, or crop individual tiles to post in order.

export const metadata: Metadata = { title: "EscapeHatch — IG kit", robots: { index: false } };

const C = {
  bg: "var(--color-bg)",
  card: "var(--color-card)",
  cardHi: "var(--color-card-hi)",
  border: "var(--color-border)",
  fg: "var(--color-fg)",
  dim: "var(--color-fg-dim)",
  muted: "var(--color-fg-muted)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
};

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#fafafa" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
    </svg>
  );
}

function Avatar({ size = 84, ring = true }: { size?: number; ring?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: "#4f7cff",
        display: "grid",
        placeItems: "center",
        boxShadow: ring ? "0 0 0 1.5px var(--color-border), 0 8px 30px rgba(79,124,255,0.25)" : undefined,
      }}
    >
      <Mark size={size * 0.46} />
    </div>
  );
}

function Watermark() {
  return <span style={{ position: "absolute", right: 10, bottom: 8, fontSize: 9, letterSpacing: "0.04em", color: C.muted, opacity: 0.8 }}>@getescapehatch</span>;
}

function Tile({ children, hero = false }: { children: React.ReactNode; hero?: boolean }) {
  return (
    <div
      className="grain"
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        overflow: "hidden",
        background: hero ? "linear-gradient(160deg, rgba(91,140,255,0.14), var(--color-card) 62%)" : C.card,
        borderRight: "1px solid var(--color-bg)",
        borderBottom: "1px solid var(--color-bg)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
      <Watermark />
    </div>
  );
}

const kicker = (text: string) => (
  <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent }}>{text}</span>
);
const headline = (text: string, size = 19) => (
  <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.02em", color: C.fg }}>{text}</div>
);
const sub = (text: string) => <p style={{ fontSize: 11, lineHeight: 1.35, color: C.dim, margin: 0 }}>{text}</p>;

// simple line icons (consistent stroke)
const Icon = ({ d, s = 22 }: { d: string; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((p, i) => <path key={i} d={/^[Mm]/.test(p.trim()) ? p : "M" + p} />)}
  </svg>
);

function Highlight({ label, cover }: { label: string; cover: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 62 }}>
      <div style={{ width: 58, height: 58, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "grid", placeItems: "center" }}>
        <div className="tnum" style={{ width: 50, height: 50, borderRadius: "50%", background: C.bg, display: "grid", placeItems: "center", color: C.dim, fontFamily: "var(--font-mono)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em" }}>{cover}</span>
        </div>
      </div>
      <span style={{ fontSize: 10.5, color: C.dim }}>{label}</span>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="tnum" style={{ fontSize: 15, fontWeight: 700, color: C.fg, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>{l}</div>
    </div>
  );
}

export default function IGKitPage() {
  return (
    <div data-theme="dark" style={{ background: "#050506", minHeight: "100dvh", display: "flex", justifyContent: "center", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`, overflow: "hidden", fontFamily: "var(--font-sans)", color: C.fg }}>
        {/* top chrome */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 6px" }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>getescapehatch</span>
          <span style={{ display: "flex", gap: 16, color: C.fg }}>
            <Icon d="M12 5v14|5 12h14" s={20} />
            <Icon d="M4 6h16|4 12h16|4 18h16" s={20} />
          </span>
        </div>

        {/* header */}
        <div style={{ padding: "10px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Avatar />
            <div style={{ display: "flex", flex: 1, justifyContent: "space-around" }}>
              <Stat n="9" l="posts" />
              <Stat n="1,842" l="followers" />
              <Stat n="27" l="following" />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>EscapeHatch</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: C.accent, background: C.accentSoft, padding: "2px 7px", borderRadius: 999 }}>Conversion infra</span>
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.45, color: C.fg, margin: "6px 0 0" }}>
              Recover the revenue your paid social ads leak.<br />
              One snippet escapes the in-app browser → real browser, real cookies, one-tap checkout.<br />
              <span style={{ color: C.dim }}>Measured RPV lift vs a live A/B control. Live in ~15 min.</span>
            </p>
            <a style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, color: C.accent, marginTop: 6, textDecoration: "none" }}>↗ getescapehatch.com</a>
          </div>

          {/* highlights */}
          <div style={{ display: "flex", gap: 14, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
            {[["Problem", "!"], ["Proof", "+%"], ["Setup", "15m"], ["A/B", "A/B"], ["Brands", "★"]].map(([l, c]) => <Highlight key={l} label={l} cover={c} />)}
          </div>

          {/* tabs */}
          <div style={{ display: "flex", marginTop: 8, borderTop: `1px solid ${C.border}` }}>
            <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "10px 0", borderTop: `1.5px solid ${C.fg}`, marginTop: -1 }}>
              <Icon d="M4 4h6v6H4z|14 4h6v6h-6z|4 14h6v6H4z|14 14h6v6h-6z" s={18} />
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "10px 0", color: C.muted }}>
              <Icon d="M7 3v18|17 3v18|3 7.5h18|3 16.5h18" s={18} />
            </div>
          </div>
        </div>

        {/* the 3×3 feed */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {/* row 1 — problem */}
          <Tile>
            {kicker("The hidden tax")}
            <div className="h-editorial" style={{ fontSize: 22, color: C.fg, marginTop: "auto" }}>The in-app browser is quietly taxing every paid click.</div>
          </Tile>
          <Tile>
            <Icon d="M12 3a9 9 0 109 9 4 4 0 01-5-5 4 4 0 01-4-4Z|9 12h.01|13 15h.01|15 10h.01" />
            <div style={{ marginTop: "auto", display: "grid", gap: 5 }}>{headline("Cookies get wiped.")}{sub("Returning shoppers look brand-new. Every session starts cold.")}</div>
          </Tile>
          <Tile>
            <Icon d="M5 11V8a4 4 0 018 0|3 11h12v9H3z|9 15v2" />
            <div style={{ marginTop: "auto", display: "grid", gap: 5 }}>{headline("One-tap checkout breaks.")}{sub("Apple Pay & Shop Pay fall back to manual forms. Conversion drops.")}</div>
          </Tile>

          {/* row 2 — solution */}
          <Tile>
            <Icon d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z|12 9v6|9 12h6" />
            <div style={{ marginTop: "auto", display: "grid", gap: 5 }}>{headline("Invisible in your analytics.")}{sub("GA & Shopify can't see the in-app tax — so you optimize blind.")}</div>
          </Tile>
          <Tile hero>
            {kicker("The fix")}
            <div style={{ marginTop: "auto" }}>
              <div className="h-editorial" style={{ fontSize: 24, color: C.fg }}>One snippet. Real browser.</div>
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, color: C.accent, background: C.accentSoft, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px" }}>&lt;script src=&quot;getescapehatch.com/e.js&quot;&gt;</div>
            </div>
          </Tile>
          <Tile>
            {kicker("Live in ~15 min")}
            <div style={{ marginTop: "auto", display: "grid", gap: 7 }}>
              {[["1", "Paste the snippet"], ["2", "Add the pixel"], ["3", "Add the webhook"]].map(([n, t]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="tnum" style={{ width: 18, height: 18, borderRadius: "50%", background: C.accentSoft, color: C.accent, fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
                  <span style={{ fontSize: 12, color: C.fg }}>{t}</span>
                </div>
              ))}
            </div>
          </Tile>

          {/* row 3 — proof */}
          <Tile>
            {kicker("Measured lift")}
            <div style={{ marginTop: "auto" }}>
              <div className="tnum" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.035em", color: C.accent, lineHeight: 1 }}>+45<span style={{ fontSize: "0.6em" }}>%</span></div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.fg, marginTop: 2 }}>RPV</div>
              {sub("Avg RPV lift across 30 brands, vs a live holdout.")}
            </div>
          </Tile>
          <Tile>
            {kicker("Defensible")}
            <div style={{ marginTop: "auto", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 46 }}>
                <div style={{ flex: 1, display: "grid", gap: 3, justifyItems: "center" }}>
                  <div style={{ width: "70%", height: 26, background: C.border, borderRadius: 3 }} />
                  <span style={{ fontSize: 8.5, color: C.muted }}>Control</span>
                </div>
                <div style={{ flex: 1, display: "grid", gap: 3, justifyItems: "center" }}>
                  <div style={{ width: "70%", height: 42, background: C.accent, borderRadius: 3 }} />
                  <span style={{ fontSize: 8.5, color: C.accent }}>EscapeHatch</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>A live A/B dashboard your CFO can trust.</div>
            </div>
          </Tile>
          <Tile hero>
            <div style={{ marginTop: "auto" }}>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", color: C.fg }}>Recover the revenue your ads leak.</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, fontWeight: 600, color: C.accent }}>getescapehatch.com <span aria-hidden>→</span></div>
            </div>
          </Tile>
        </div>
      </div>
    </div>
  );
}
