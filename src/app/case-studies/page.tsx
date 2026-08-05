import type { Metadata } from "next";
import Link from "next/link";
import { CASE_STUDIES, cvr, liftPct, rpvCents } from "@/lib/case-studies";
import { CaseStudyFooter, CaseStudyHeader } from "./_components/chrome";

export const metadata: Metadata = {
  title: "Case studies — randomized A/B results on live Instagram traffic",
  description:
    "Every EscapeHatch install starts as a 50/50 split test. These are the published results: checkout-conversion and revenue-per-visitor lift from escaping Instagram's in-app browser, brand by brand.",
};

export default function CaseStudiesIndex() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <CaseStudyHeader />

      <section className="mx-auto max-w-6xl px-5 pt-16 md:pt-24 pb-10">
        <span
          className="text-[10px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-2"
          style={{ color: "var(--color-accent)" }}
        >
          <span className="size-1 rounded-full bg-[var(--color-accent)]" />
          Case studies
        </span>
        <h1 className="mt-4 text-balance max-w-3xl">
          <span className="block h-display text-[34px] sm:text-[44px] md:text-[56px] leading-[1.02] tracking-tight">
            We don&apos;t publish testimonials.
          </span>
          <span className="block mt-1 h-editorial text-[34px] sm:text-[44px] md:text-[56px] leading-[1.02] text-[var(--color-accent)]">
            We publish splits.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-[15px] text-[var(--color-fg-dim)] leading-relaxed">
          Every install starts as a randomized 50/50 A/B test on the brand&apos;s own Instagram
          traffic: bucket A is escaped to the real browser, bucket B stays in the in-app webview as
          the control. Same ads, same spend, same store. Below are completed test windows, reported
          with sample sizes, z-scores, and outlier-trimmed revenue — the same numbers the brands see
          on their dashboards.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="grid md:grid-cols-2 gap-4">
          {CASE_STUDIES.map((cs, i) => {
            const cvrLift = Math.round(liftPct(cvr(cs.a), cvr(cs.b)) * 100);
            const rpvLift = Math.round(liftPct(rpvCents(cs.a), rpvCents(cs.b)) * 100);
            const visitors = (cs.a.visitors + cs.b.visitors).toLocaleString("en-US");
            return (
              <Link
                key={cs.slug}
                href={`/case-studies/${cs.slug}`}
                className={`group card-hi p-6 md:p-8 flex flex-col justify-between gap-8 focus-ring rounded-2xl transition-transform hover:-translate-y-0.5 ${
                  i === 0 ? "md:col-span-2" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                      {cs.category}
                    </span>
                    <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
                      {cs.windowLabel}
                    </span>
                  </div>
                  <h2
                    className={`mt-4 h-display tracking-tight leading-[1.05] text-balance ${
                      i === 0 ? "text-[26px] sm:text-[34px] md:text-[40px]" : "text-[22px] sm:text-[26px]"
                    }`}
                  >
                    {cs.headline}
                  </h2>
                  <p className="mt-3 text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed max-w-2xl">
                    {cs.dek}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div className="flex items-baseline gap-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                        Checkout CVR
                      </div>
                      <div className="mt-1 tnum font-semibold text-[28px] leading-none text-[var(--color-success)]">
                        +{cvrLift}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                        Rev / visitor
                      </div>
                      <div className="mt-1 tnum font-semibold text-[28px] leading-none">
                        +{rpvLift}%
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                        Visitors
                      </div>
                      <div className="mt-1 tnum font-semibold text-[28px] leading-none text-[var(--color-fg-dim)]">
                        {visitors}
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] group-hover:gap-2.5 transition-all">
                    Read the test
                    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40 p-6 md:p-8">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            How to read these numbers
          </div>
          <div className="mt-4 grid md:grid-cols-3 gap-6 text-[13px] text-[var(--color-fg-dim)] leading-relaxed">
            <p>
              <strong className="text-[var(--color-fg)] font-semibold">Randomized at first touch.</strong>{" "}
              Visitors are assigned to escape or control before the page paints, so both arms see
              identical ads, prices, and merchandising.
            </p>
            <p>
              <strong className="text-[var(--color-fg)] font-semibold">Outlier-trimmed revenue.</strong>{" "}
              Single whale orders (&gt; Q3 + 3·IQR and &gt; 8× the median) are excluded from
              per-visitor revenue on both arms — in either direction. Conversion counts are never
              trimmed.
            </p>
            <p>
              <strong className="text-[var(--color-fg)] font-semibold">Significance, stated plainly.</strong>{" "}
              Conversion lift is tested with a two-proportion z-test and reported with its z-score
              and p-value. Brands are anonymized by category; several are under NDA.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-8 pb-4 text-center">
        <h2 className="h-display text-[26px] sm:text-[34px] tracking-tight text-balance">
          The next case study can be your traffic.
        </h2>
        <p className="mt-3 text-[14px] text-[var(--color-fg-dim)] max-w-xl mx-auto">
          Install is one script tag. The 50/50 test starts immediately, and in 7–14 days you have
          your own defensible number.
        </p>
        <div className="mt-6">
          <Link
            href="/#waitlist"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Get early access
          </Link>
        </div>
      </section>

      <CaseStudyFooter />
    </div>
  );
}
