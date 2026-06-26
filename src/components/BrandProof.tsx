/* Shared brand proof — used by both the /for-brands landing page and the
   /for-brands-executive one-pager so the logos + lifts stay in sync.

   Lifts are all-time, A/B-measured RPV (escape vs. a live control). Only
   credible figures are shown; Andar (+142% real) stays in the showcase strip
   without a number. */

type Brand = { name: string; logo?: string; wordmark?: string; h: string; lift?: string };

// Ordered strongest-first.
export const BRAND_RESULTS: Brand[] = [
  { name: "G FUEL", logo: "/logos/gfuel.png", h: "h-6", lift: "+56%" },
  { name: "COVE", logo: "/logos/cove.png", h: "h-7", lift: "+45%" },
  { name: "Elavi", logo: "/logos/elavi.png", h: "h-7", lift: "+45%" },
  { name: "Not Just Sundays", logo: "/logos/notjustsundays.svg", h: "h-8", lift: "+42%" },
  { name: "HAUS", logo: "/logos/haus.png", h: "h-5", lift: "+41%" },
  { name: "CASED", wordmark: "CASED", h: "h-6", lift: "+8%" },
];

export const BRAND_SHOWCASE: Brand[] = [
  { name: "G FUEL", logo: "/logos/gfuel.png", h: "h-6" },
  { name: "COVE", logo: "/logos/cove.png", h: "h-5" },
  { name: "HAUS", logo: "/logos/haus.png", h: "h-4" },
  { name: "Andar", logo: "/logos/andar.png", h: "h-5" },
  { name: "CASED", wordmark: "CASED", h: "h-5" },
  { name: "Not Just Sundays", logo: "/logos/notjustsundays.svg", h: "h-7" },
  { name: "Elavi", logo: "/logos/elavi.png", h: "h-5" },
];

export function BrandMark({ name, logo, wordmark, h = "h-6" }: Brand) {
  if (wordmark) {
    return (
      <span
        className="text-[15px] font-extrabold tracking-tight text-[var(--color-fg)]"
        aria-label={name}
      >
        {wordmark}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt={name} className={`${h} w-auto object-contain`} />;
}

/** Horizontal "measured on real stores" logo strip. */
export function BrandShowcase({ label = "Measured on real stores" }: { label?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)] px-5 py-4">
      <div className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {BRAND_SHOWCASE.map((b) => (
          <BrandMark key={b.name} {...b} />
        ))}
      </div>
    </div>
  );
}

/** Grid of per-brand RPV-lift tiles (logo + figure). */
export function BrandResults() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
      {BRAND_RESULTS.map((r) => (
        <div
          key={r.name}
          className="flex flex-col items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-4 text-center"
        >
          <div className="flex h-8 items-center justify-center">
            <BrandMark {...r} />
          </div>
          <div>
            <div className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--color-success)] [font-variant-numeric:tabular-nums]">
              {r.lift}
            </div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
              RPV lift
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
