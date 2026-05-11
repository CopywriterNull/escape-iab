import Link from "next/link";

export default function LandingIndex() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="eyebrow">Design preview</div>
        <h1 className="mt-3 h-display text-[36px] tracking-tight">
          Homepage variants
        </h1>
        <p className="mt-3 text-[14px] text-[var(--color-fg-dim)] max-w-xl leading-relaxed">
          Alternate hero treatments to compare against the current /
          homepage. Static, no auth.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href="/preview/landing/mobbin"
            className="group block p-5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] hover:border-[var(--color-accent)]/40 transition-colors press lift"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[15px] font-medium tracking-tight">
                Mobbin-style — overlapping platform stack
              </div>
              <div className="text-[11px] font-mono text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                view →
              </div>
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">
              Hero anchored by a fanned-out stack of platform icons (Instagram, Facebook, Snap, Discord, Pinterest).
              Big bold headline, clean rhythm, dedicated &quot;in-app browsers we escape from&quot; grid below.
              Pricing in 3 tiered cards.
            </div>
          </Link>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border-soft)] text-[11px] text-[var(--color-fg-muted)] font-mono flex items-center justify-between">
          <Link href="/preview/dashboard">← dashboard variants</Link>
          <Link href="/">live site →</Link>
        </div>
      </div>
    </div>
  );
}
