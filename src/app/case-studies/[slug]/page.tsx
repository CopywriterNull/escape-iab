import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CASE_STUDIES,
  cvr,
  getCaseStudy,
  liftPct,
  rpvCents,
  type PublishedCaseStudy,
} from "@/lib/case-studies";
import { CaseStudyFooter, CaseStudyHeader } from "../_components/chrome";

export const dynamicParams = false;

export function generateStaticParams() {
  return CASE_STUDIES.map((cs) => ({ slug: cs.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) return {};
  const cvrLift = Math.round(liftPct(cvr(cs.a), cvr(cs.b)) * 100);
  return {
    title: `${cs.brand}: +${cvrLift}% checkout conversion — case study`,
    description: cs.dek,
  };
}

function pctLabel(v: number, digits = 2): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function moneyLabel(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CaseStudyDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) notFound();

  const cvrA = cvr(cs.a);
  const cvrB = cvr(cs.b);
  const rpvA = rpvCents(cs.a);
  const rpvB = rpvCents(cs.b);
  const cvrLift = Math.round(liftPct(cvrA, cvrB) * 100);
  const rpvLift = Math.round(liftPct(rpvA, rpvB) * 100);
  const visitors = (cs.a.visitors + cs.b.visitors).toLocaleString("en-US");

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <CaseStudyHeader />

      <article className="mx-auto max-w-6xl px-5 pt-14 md:pt-20">
        <Link
          href="/case-studies"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <svg viewBox="0 0 20 20" className="size-3 rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All case studies
        </Link>

        <div className="mt-6 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-start">
          {/* Left: story */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                {cs.category}
              </span>
              <span className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">
                {cs.brand} · {cs.windowLabel} · {cs.windowDays} days
              </span>
            </div>
            <h1 className="mt-4 h-display text-[30px] sm:text-[38px] md:text-[46px] leading-[1.04] tracking-tight text-balance">
              {cs.headline}
            </h1>
            <p className="mt-5 text-[15px] text-[var(--color-fg-dim)] leading-relaxed">{cs.dek}</p>

            <div className="mt-8 space-y-5">
              {cs.narrative.map((p, i) => (
                <p key={i} className="text-[14.5px] leading-relaxed text-[var(--color-fg-dim)]">
                  {p}
                </p>
              ))}
              <p className="text-[14.5px] leading-relaxed text-[var(--color-fg)]">
                <strong className="font-semibold">After the test:</strong>{" "}
                <span className="text-[var(--color-fg-dim)]">{cs.after}</span>
              </p>
            </div>
          </div>

          {/* Right: the numbers */}
          <div className="space-y-3 lg:sticky lg:top-20">
            <div
              className="rounded-2xl border border-[var(--color-accent)]/40 px-6 py-7 bg-[var(--color-card)]"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-card)) 0%, var(--color-card) 100%)",
              }}
            >
              <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                Checkout conversion
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tnum font-semibold tracking-tight text-[64px] leading-[0.95]">
                  +{cvrLift}%
                </span>
                <span className="text-[11.5px] text-[var(--color-fg-muted)] font-mono pb-1">lift</span>
              </div>
              <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
                escaped vs in-app-browser control
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                  Revenue / visitor
                </div>
                <div className="mt-2 tnum font-semibold text-[32px] leading-[1] text-[var(--color-success)]">
                  +{rpvLift}%
                </div>
                <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">outlier-trimmed</div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                  Significance
                </div>
                <div className="mt-2 tnum font-semibold text-[32px] leading-[1]">z = {cs.z}</div>
                <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">{cs.pLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] uppercase tracking-wider">
                <span>{cs.windowLabel} · IG-sourced sessions</span>
                <span className="font-mono normal-case tnum">{visitors} visitors</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-medium">Arm</th>
                      <th className="text-right px-3 py-2.5 font-medium">Visitors</th>
                      <th className="text-right px-3 py-2.5 font-medium">Orders</th>
                      <th className="text-right px-3 py-2.5 font-medium">CVR</th>
                      <th className="text-right px-5 py-2.5 font-medium">Rev / visitor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    <tr>
                      <td className="px-5 py-3.5 font-medium tracking-tight whitespace-nowrap">
                        A · escaped
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {cs.a.visitors.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {cs.a.purchases.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum font-semibold text-[var(--color-success)]">
                        {pctLabel(cvrA)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tnum font-semibold text-[var(--color-success)]">
                        {moneyLabel(rpvA)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3.5 font-medium tracking-tight whitespace-nowrap">
                        B · control
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {cs.b.visitors.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {cs.b.purchases.toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {pctLabel(cvrB)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tnum text-[var(--color-fg-dim)]">
                        {moneyLabel(rpvB)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 flex items-center justify-between border-t border-[var(--color-border)] text-[11px] font-mono text-[var(--color-fg-muted)]">
                <span>{cs.pLabel}</span>
                <span>two-proportion z-test · z = {cs.z}</span>
              </div>
            </div>

            <div className="text-[11px] leading-relaxed text-[var(--color-fg-muted)] space-y-1.5 px-1">
              {cs.footnotes.map((f, i) => (
                <p key={i}>{f}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 card-hi p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="h-display text-[24px] sm:text-[30px] tracking-tight text-balance">
              Run this exact test on your traffic.
            </h2>
            <p className="mt-2 text-[13.5px] text-[var(--color-fg-dim)] max-w-lg">
              One script tag, 60-second install. Randomized 50/50 from the first visitor — in 7–14
              days this page is your data.
            </p>
          </div>
          <Link
            href="/#waitlist"
            className="shrink-0 inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Get early access
          </Link>
        </div>
      </article>

      <CaseStudyFooter />
    </div>
  );
}
