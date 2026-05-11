import Link from "next/link";

const VARIANTS = [
  {
    slug: "v1-linear-dark",
    name: "V1 — Linear Dark",
    desc: "Deep dark mode, dense rows, mono numerics, indigo accent. Sidebar nav.",
    accent: "#7c70ff",
    bg: "#0a0a0b",
    text: "#e6e8eb",
  },
  {
    slug: "v2-stripe-minimal",
    name: "V2 — Stripe Minimal",
    desc: "Hero number 96px. No card borders. Generous whitespace. Single indigo accent.",
    accent: "#635bff",
    bg: "#ffffff",
    text: "#0a2540",
  },
  {
    slug: "v3-terminal",
    name: "V3 — Terminal Brutalist",
    desc: "All monospace, ALL-CAPS labels, hairline borders, phosphor-green accent.",
    accent: "#00d97e",
    bg: "#0e0e0e",
    text: "#dcdcdc",
  },
  {
    slug: "v4-editorial",
    name: "V4 — Editorial Magazine",
    desc: "Cream bg, large italic serif headlines, asymmetric grid, terracotta accent.",
    accent: "#b8331f",
    bg: "#faf7f2",
    text: "#1a1612",
  },
  {
    slug: "v5-notion-soft",
    name: "V5 — Notion Soft",
    desc: "Soft warm grays, rounded-2xl cards, color-coded section accents, friendlier copy.",
    accent: "#9b6bff",
    bg: "#fdfcfb",
    text: "#37352f",
  },
  {
    slug: "v6-blend",
    name: "V6 — Current theme + V5 banner + V3 ASCII funnel",
    desc: "Your existing cool-neutral + cobalt theme, with the V5 \"Test is winning\" hero banner and V3-style ASCII-block A/B comparison bars.",
    accent: "#4f7cff",
    bg: "#fafafa",
    text: "#09090b",
  },
];

export default function PreviewIndex() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="eyebrow">Design preview</div>
        <h1 className="mt-3 h-display text-[36px] tracking-tight">
          Dashboard variants
        </h1>
        <p className="mt-3 text-[14px] text-[var(--color-fg-dim)] max-w-xl leading-relaxed">
          Same mock data, five distinct visual treatments. Click each to compare
          density, typography, color, and information hierarchy. Pick the one
          that resonates — we can blend or polish from there.
        </p>

        <div className="mt-10 space-y-3">
          {VARIANTS.map((v) => (
            <Link
              key={v.slug}
              href={`/preview/dashboard/${v.slug}`}
              className="group flex items-stretch gap-4 p-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] hover:border-[var(--color-accent)]/40 transition-colors press lift"
            >
              <div
                aria-hidden
                className="size-16 shrink-0 rounded-lg border border-[var(--color-border-soft)] grid place-items-center"
                style={{ background: v.bg, color: v.text }}
              >
                <span className="font-mono text-[18px] tnum" style={{ color: v.accent }}>
                  ↗
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[15px] font-medium tracking-tight">{v.name}</div>
                  <div className="text-[11px] font-mono text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                    view →
                  </div>
                </div>
                <div className="mt-1 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">
                  {v.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border-soft)] text-[11px] text-[var(--color-fg-muted)] font-mono">
          Note: previews are static — no live data, no auth, just design.
        </div>
      </div>
    </div>
  );
}
