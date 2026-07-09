import type { Metadata } from "next";

// Native 1080×1080 render of each feed tile. Full-bleed editorial composition:
// label + index at top, a big statement filling the middle, a supporting detail at the
// bottom — so tiles read full, not empty. Screenshot each [data-post]. View at /ig/export.

export const metadata: Metadata = { title: "EscapeHatch — IG export", robots: { index: false } };

const C = {
  card: "var(--color-card)",
  border: "var(--color-border)",
  fg: "var(--color-fg)",
  dim: "var(--color-fg-dim)",
  muted: "var(--color-fg-muted)",
  accent: "var(--color-accent)",
  accentSoft: "var(--color-accent-soft)",
};

const PAD = 84;
const HANDLE = "@getescapehatch";

const Icon = ({ d, s = 46 }: { d: string; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke={C.accent} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
    {d.split("|").map((p, i) => <path key={i} d={/^[Mm]/.test(p.trim()) ? p : "M" + p} />)}
  </svg>
);

function Post({
  i,
  hero = false,
  label,
  icon,
  body,
  footer,
}: {
  i: number;
  hero?: boolean;
  label: string;
  icon?: string;
  body: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
        justifyContent: "space-between",
        fontFamily: "var(--font-sans)",
        color: C.fg,
      }}
    >
      {/* header: icon + label · index */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {icon ? <Icon d={icon} /> : null}
        <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.accent }}>{label}</span>
        <span className="tnum" style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 24, color: C.muted }}>{String(i).padStart(2, "0")} / 09</span>
      </div>

      {/* statement — fills the middle */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 0" }}>{body}</div>

      {/* footer: supporting detail + handle */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div style={{ flex: 1 }}>{footer}</div>
        <span style={{ fontSize: 26, color: C.muted, opacity: 0.55, whiteSpace: "nowrap" }}>{HANDLE}</span>
      </div>
    </div>
  );
}

const serif = (t: string, size: number) => <div className="h-editorial" style={{ fontSize: size, color: C.fg }}>{t}</div>;
const headline = (t: string, size: number) => <div style={{ fontSize: size, fontWeight: 600, lineHeight: 1.04, letterSpacing: "-0.03em", color: C.fg }}>{t}</div>;
const detail = (t: string) => <p style={{ fontSize: 36, lineHeight: 1.4, color: C.dim, margin: 0, maxWidth: "22ch" }}>{t}</p>;

export default function IGExport() {
  return (
    <div data-theme="dark" style={{ background: "#050506", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: 24 }}>
      {/* 1 — hook */}
      <Post i={1} label="The setup" icon="M14 4h6v6|20 4l-8 8|M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5"
        body={serif("The in-app browser is the worst place to close a sale.", 120)}
        footer={detail("Here's why escaping into the real browser wins.")} />

      {/* 2 — conversion */}
      <Post i={2} label="Conversion" icon="M3 4h2l1.6 10.4a1 1 0 001 .85h9.2a1 1 0 001-.8L19 7H6|9 21h.01|17 21h.01"
        body={headline("People don't shop in-app.", 100)}
        footer={detail("They bounce out of Instagram's browser. The real browser is where they actually buy.")} />

      {/* 3 — persistent sessions (the big one) */}
      <Post i={3} label="Persistence" icon="M6 3h12v18l-6-4-6 4z"
        body={headline("The session sticks.", 108)}
        footer={detail("Escape to Safari and their cookies persist — they come back days later and your site's still there.")} />

      {/* 4 — experience */}
      <Post i={4} label="Experience" icon="M3 5h18v14H3z|3 9h18|6.5 7h.01|9 7h.01"
        body={headline("A real browser, not a shell.", 100)}
        footer={detail("Autofill, saved logins, one-tap payment — the full, familiar path to purchase.")} />

      {/* 5 — the fix (hero) */}
      <Post i={5} hero label="The fix" icon="M14 4h6v6|20 4l-8 8|M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5"
        body={serif("One snippet. Real browser.", 124)}
        footer={
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, lineHeight: 1.55, color: C.accent, background: C.accentSoft, border: `1px solid ${C.border}`, borderRadius: 18, padding: "24px 30px", whiteSpace: "pre-wrap", display: "inline-block" }}>
            {'<script\n  src="getescapehatch.com/e.js">'}
          </div>
        } />

      {/* 6 — setup */}
      <Post i={6} label="Live in ~15 min" icon="M12 7v5l3 2|M12 3a9 9 0 100 18 9 9 0 000-18Z"
        body={
          <div style={{ display: "grid", gap: 34 }}>
            {[["1", "Paste the snippet"], ["2", "Add the pixel"], ["3", "Add the webhook"]].map(([n, t]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 28 }}>
                <span className="tnum" style={{ width: 72, height: 72, borderRadius: "50%", background: C.accentSoft, color: C.accent, fontSize: 34, fontWeight: 700, display: "grid", placeItems: "center" }}>{n}</span>
                <span style={{ fontSize: 56, fontWeight: 500, color: C.fg }}>{t}</span>
              </div>
            ))}
          </div>
        }
        footer={detail("Zero performance cost. Live the same afternoon.")} />

      {/* 7 — stat */}
      <Post i={7} label="Measured lift"
        body={
          <div>
            <div className="tnum" style={{ fontSize: 300, fontWeight: 700, letterSpacing: "-0.05em", color: C.accent, lineHeight: 0.82 }}>+45<span style={{ fontSize: "0.42em" }}>%</span></div>
            <div style={{ fontSize: 64, fontWeight: 600, color: C.fg, marginTop: 20 }}>RPV lift</div>
          </div>
        }
        footer={detail("Average across 30 brands in the portfolio, vs a live holdout.")} />

      {/* 8 — A/B proof */}
      <Post i={8} label="Defensible"
        body={
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 110, height: 470 }}>
            <div style={{ display: "grid", gap: 18, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 34, color: C.muted }}>$1.00</span>
              <div style={{ width: 128, height: 200, background: C.border, borderRadius: 12 }} />
              <span style={{ fontSize: 34, color: C.muted }}>Control</span>
            </div>
            <div style={{ display: "grid", gap: 18, justifyItems: "center" }}>
              <span className="tnum" style={{ fontSize: 36, fontWeight: 700, color: C.accent }}>$1.45</span>
              <div style={{ width: 128, height: 400, background: C.accent, borderRadius: 12 }} />
              <span style={{ fontSize: 34, color: C.accent }}>EscapeHatch</span>
            </div>
          </div>
        }
        footer={detail("Revenue per visitor, measured against a live A/B control.")} />

      {/* 9 — CTA (hero) */}
      <Post i={9} hero label="Get started" icon="M14 4h6v6|20 4l-8 8|M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5"
        body={headline("Recover the revenue your ads leak.", 96)}
        footer={<div style={{ display: "inline-flex", alignItems: "center", gap: 16, fontSize: 46, fontWeight: 600, color: C.accent }}>getescapehatch.com <span aria-hidden>→</span></div>} />
    </div>
  );
}
