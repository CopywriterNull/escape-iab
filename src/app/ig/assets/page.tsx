import type { Metadata } from "next";

// Profile picture (640) + 5 highlight covers (320, circle-safe). Screenshot each [data-asset].
export const metadata: Metadata = { title: "EscapeHatch — IG assets", robots: { index: false } };

const C = { card: "var(--color-card)", bg: "var(--color-bg)", border: "var(--color-border)", fg: "var(--color-fg)", accent: "var(--color-accent)", accentSoft: "var(--color-accent-soft)" };

const Mark = ({ s = 300, stroke = "#fafafa", sw = 2.6 }: { s?: number; stroke?: string; sw?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);
const Glyph = ({ d, s = 150 }: { d: string; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={C.accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((p, i) => <path key={i} d={/^[Mm]/.test(p.trim()) ? p : "M" + p} />)}
  </svg>
);

function Cover({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div data-asset={`hl-${id}`} style={{ width: 320, height: 320, borderRadius: "50%", background: C.card, border: `1px solid ${C.border}`, display: "grid", placeItems: "center" }}>
      {children}
    </div>
  );
}

export default function IGAssets() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexWrap: "wrap", gap: 40, padding: 40, alignItems: "flex-start" }}>
      {/* profile picture — full-bleed blue, circle-cropped by IG */}
      <div data-asset="pfp" style={{ width: 640, height: 640, background: "#4f7cff", display: "grid", placeItems: "center" }}>
        <Mark s={300} />
      </div>

      <Cover id="problem"><Glyph d="M12 3l9 16H3z|12 10v4|12 17h.01" /></Cover>
      <Cover id="proof"><div className="tnum" style={{ fontSize: 96, fontWeight: 700, color: C.accent, letterSpacing: "-0.03em" }}>+%</div></Cover>
      <Cover id="setup"><Glyph d="M9 8l-4 4 4 4|15 8l4 4-4 4|13 6l-2 12" s={150} /></Cover>
      <Cover id="ab"><div style={{ fontSize: 66, fontWeight: 700, color: C.accent, letterSpacing: "-0.02em" }}>A/B</div></Cover>
      <Cover id="brands"><Glyph d="M12 3l2.9 6.2 6.6.6-5 4.4 1.5 6.5L12 17.8 6 20.7l1.5-6.5-5-4.4 6.6-.6z" s={150} /></Cover>
    </div>
  );
}
