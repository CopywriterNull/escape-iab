import type { Metadata } from "next";

/* eslint-disable @next/next/no-img-element */
// Brand-result proof cards (1080) + a logo wall. Numbers are tasteful placeholders —
// swap for real per-brand RPV lift. Screenshot each [data-brand]. View at /ig/brands.
export const metadata: Metadata = { title: "EscapeHatch — brand cards", robots: { index: false } };

const C = { card: "var(--color-card)", border: "var(--color-border)", fg: "var(--color-fg)", dim: "var(--color-fg-dim)", muted: "var(--color-fg-muted)", accent: "var(--color-accent)" };
const HANDLE = "@getescapehatch";

const BRANDS = [
  { file: "andar.png", name: "Andar", pct: 38 },
  { file: "cove.png", name: "Cove", pct: 52 },
  { file: "gfuel.png", name: "G FUEL", pct: 47 },
  { file: "haus.png", name: "Haus", pct: 34 },
  { file: "elavi.png", name: "Elavi", pct: 41 },
  { file: "cased.png", name: "Cased", pct: 29 },
  { file: "notjustsundays.svg", name: "Not Just Sundays", pct: 61 },
];

function Chip({ file, name, h = 92 }: { file: string; name: string; h?: number }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 20, padding: "28px 40px", display: "grid", placeItems: "center" }}>
      <img src={`/logos/${file}`} alt={name} style={{ height: h, maxWidth: 380, objectFit: "contain" }} />
    </div>
  );
}

function Card({ i, children, hero = false }: { i: number | string; children: React.ReactNode; hero?: boolean }) {
  return (
    <div data-brand={i} className="grain" style={{ position: "relative", width: 1080, height: 1080, overflow: "hidden", background: hero ? "linear-gradient(158deg, rgba(91,140,255,0.16), var(--color-card) 60%)" : C.card, padding: 84, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--font-sans)", color: C.fg }}>
      {children}
      <span style={{ position: "absolute", right: 40, bottom: 34, fontSize: 26, color: C.muted, opacity: 0.5 }}>{HANDLE}</span>
    </div>
  );
}

const kicker = (t: string, idx?: string) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent }}>{t}</span>
    {idx && <span className="tnum" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 24, color: C.muted }}>{idx}</span>}
  </div>
);

export default function IGBrands() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24 }}>
      {BRANDS.map((b, n) => (
        <Card key={b.name} i={n + 1}>
          {kicker("Portfolio result", `${String(n + 1).padStart(2, "0")} / ${BRANDS.length}`)}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44, padding: "40px 0" }}>
            <Chip file={b.file} name={b.name} />
            <div>
              <div className="tnum" style={{ fontSize: 210, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 0.82 }}>+{b.pct}<span style={{ fontSize: "0.42em" }}>%</span></div>
              <div style={{ fontSize: 58, fontWeight: 600, color: C.fg, marginTop: 16 }}>RPV lift</div>
            </div>
          </div>
          <p style={{ fontSize: 34, color: C.dim, margin: 0, maxWidth: "24ch" }}>{b.name} · revenue per visitor, measured vs a live holdout.</p>
        </Card>
      ))}

      {/* logo wall */}
      <Card i="wall" hero>
        {kicker("The portfolio")}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 48, padding: "24px 0" }}>
          <div>
            <div style={{ fontSize: 88, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.02, color: C.fg }}>30 brands.</div>
            <div className="tnum" style={{ fontSize: 88, fontWeight: 700, letterSpacing: "-0.03em", color: C.accent, lineHeight: 1.05 }}>+45% avg RPV.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            {BRANDS.slice(0, 6).map((b) => (
              <div key={b.name} style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", display: "grid", placeItems: "center", height: 150 }}>
                <img src={`/logos/${b.file}`} alt={b.name} style={{ maxHeight: 70, maxWidth: "100%", objectFit: "contain" }} />
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 34, color: C.dim, margin: 0 }}>Measured against live A/B controls. getescapehatch.com</p>
      </Card>

      {/* ending CTA */}
      <Card i="cta" hero>
        {kicker("Your turn")}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36, padding: "40px 0" }}>
          <div style={{ fontSize: 104, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.02, color: C.fg }}>Your brand could be next.</div>
          <p style={{ fontSize: 40, color: C.dim, margin: 0, maxWidth: "20ch", lineHeight: 1.35 }}>See your own lift — measured against a live A/B holdout, live in ~15 minutes.</p>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16, fontSize: 48, fontWeight: 600, color: C.accent }}>getescapehatch.com <span aria-hidden>→</span></div>
      </Card>
    </div>
  );
}
