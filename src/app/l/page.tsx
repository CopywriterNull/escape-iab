import type { Metadata } from "next";
import Link from "next/link";

// Link-in-bio destination for @getescapehatch. Mobile-first stack of CTAs — the page the
// Instagram bio link points to. Real internal routes where they exist; swap the two
// external placeholders (demo video, book-a-call) for your real URLs.

export const metadata: Metadata = {
  title: "EscapeHatch — start here",
  description: "Escape your paid clicks out of the in-app browser into the real browser. +45% RPV across 30 brands.",
};

const C = {
  bg: "var(--color-bg)", card: "var(--color-card)", border: "var(--color-border)",
  fg: "var(--color-fg)", dim: "var(--color-fg-dim)", muted: "var(--color-fg-muted)",
  accent: "var(--color-accent)", accentSoft: "var(--color-accent-soft)",
};

// TODO: swap these two for your real URLs.
const DEMO_URL = "https://getescapehatch.com/for-brands";
const CALL_URL = "https://cal.com/getescapehatch";

function Mark({ s = 30 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="#fafafa" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6" /><path d="M20 4l-8 8" /><path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
    </svg>
  );
}

const LINKS: { href: string; label: string; note: string; primary?: boolean; external?: boolean }[] = [
  { href: "/get-started", label: "Get the snippet", note: "Live in ~15 minutes", primary: true },
  { href: DEMO_URL, label: "See how it works", note: "60-second walkthrough", external: true },
  { href: "/for-brands", label: "The results", note: "+45% RPV across 30 brands" },
  { href: CALL_URL, label: "Book a call", note: "Talk to us", external: true },
];

export default function LinkInBio() {
  return (
    <div data-theme="dark" style={{ minHeight: "100dvh", background: "var(--color-bg)", color: C.fg, display: "flex", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
      <main className="grain" style={{ position: "relative", width: "100%", maxWidth: 460, padding: "72px 24px 48px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <span style={{ width: 76, height: 76, borderRadius: 22, background: "#4f7cff", display: "grid", placeItems: "center", boxShadow: "0 10px 40px rgba(79,124,255,.28)" }}>
          <Mark s={38} />
        </span>
        <h1 style={{ fontSize: 24, letterSpacing: "-0.02em", margin: "20px 0 2px" }}>EscapeHatch</h1>
        <p style={{ fontSize: 13, color: C.accent, fontWeight: 600, margin: 0 }}>@getescapehatch</p>
        <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.5, margin: "14px 0 0", maxWidth: "32ch" }}>
          We escape your paid clicks out of Instagram&apos;s in-app browser into Safari — where people actually buy and their session sticks.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 32 }}>
          {LINKS.map((l) => {
            const inner = (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: l.primary ? "#09090b" : C.fg }}>{l.label}</span>
                  <span style={{ fontSize: 12.5, color: l.primary ? "rgba(9,9,11,.65)" : C.muted }}>{l.note}</span>
                </span>
                <span aria-hidden style={{ fontSize: 18, color: l.primary ? "#09090b" : C.accent }}>→</span>
              </span>
            );
            const style: React.CSSProperties = {
              display: "block", width: "100%", textAlign: "left", textDecoration: "none",
              padding: "16px 20px", borderRadius: 16,
              background: l.primary ? C.accent : C.card,
              border: `1px solid ${l.primary ? "transparent" : C.border}`,
              boxShadow: l.primary ? "0 8px 30px rgba(91,140,255,.22)" : undefined,
            };
            return l.external ? (
              <a key={l.label} href={l.href} target="_blank" rel="noopener" style={style}>{inner}</a>
            ) : (
              <Link key={l.label} href={l.href} style={style}>{inner}</Link>
            );
          })}
        </div>

        <a href="https://getescapehatch.com" style={{ marginTop: 36, fontSize: 13, color: C.muted, textDecoration: "none" }}>getescapehatch.com</a>
      </main>
    </div>
  );
}
