import Link from "next/link";
import type { Metadata } from "next";
import { BrandShowcase, BrandResults } from "@/components/BrandProof";

// Unlisted exec one-pager — sent directly to prospects, kept out of search.
export const metadata: Metadata = {
  title: "EscapeHatch — Executive Brief",
  description:
    "Instagram & TikTok in-app browsers break Shop Pay, Apple Pay, and saved logins — so your best paid traffic converts worst. EscapeHatch escapes those shoppers to their real browser and proves the lift with a live control group.",
  robots: { index: false, follow: false },
};

const CTA_HREF = "/get-started";
const CONTACT = "hello@getescapehatch.com";

/* Forced-light exec one-pager — a single centered sheet that scans in ~60s
   and prints to one clean page. */
export default function ForBrandsExecutive() {
  return (
    <div
      data-theme="light"
      style={{ colorScheme: "light" }}
      className="desk min-h-screen bg-[#f1f1f3] px-4 py-8 text-[#09090b] sm:py-12"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: 0.4in; }
              .desk { background: #fff !important; padding: 0 !important; }
              .sheet { box-shadow: none !important; border-color: #e4e4e7 !important; max-width: 100% !important; }
            }
          `,
        }}
      />

      <article className="sheet mx-auto max-w-[880px] rounded-2xl border border-[#e4e4e7] bg-white p-8 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-11">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 border-b border-[#ececf0] pb-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[#09090b] text-white">
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h9M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[16px] font-semibold tracking-tight">EscapeHatch</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8b8d96]">
                Executive brief
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-[11px] text-[#8b8d96]">getescapehatch.com</div>
        </header>

        {/* Thesis */}
        <section className="pt-6">
          <h1 className="text-[clamp(1.35rem,2.9vw,1.8rem)] font-semibold leading-[1.2] tracking-[-0.02em]">
            Your Instagram &amp; TikTok ads open inside an in-app browser that breaks Shop&nbsp;Pay,
            Apple&nbsp;Pay, and saved logins — so your best paid traffic converts worst.{" "}
            <span className="text-[#4f7cff]">
              EscapeHatch escapes those shoppers to their real browser, and proves the lift with a
              live control group.
            </span>
          </h1>
        </section>

        {/* Brand showcase strip */}
        <section className="mt-6">
          <BrandShowcase />
        </section>

        {/* Per-brand results */}
        <section className="mt-7">
          <h2 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8b8d96]">
            All-time revenue-per-visitor lift — escape vs. a live control
          </h2>
          <BrandResults />
          <p className="mt-3 text-[12px] leading-relaxed text-[#8b8d96]">
            Every install runs as a 50/50 A/B test against a live control, so the lift is the measured
            gap on <span className="text-[#09090b]">your own</span> store — not a projection.
            COVE&apos;s result is significant at{" "}
            <span className="text-[#09090b]">p&nbsp;&lt;&nbsp;.001</span>.
          </p>
        </section>

        {/* Two-column body */}
        <section className="mt-7 grid gap-7 md:grid-cols-2">
          <Block title="The problem">
            <Bullet>In-app browsers wipe cookies — carts, sessions, and returning customers reset to zero.</Bullet>
            <Bullet>Shop&nbsp;Pay / Apple&nbsp;Pay often won&apos;t fire, forcing a full manual checkout.</Bullet>
            <Bullet>It&apos;s invisible in analytics — the leak hides as &ldquo;traffic that didn&apos;t convert.&rdquo;</Bullet>
          </Block>
          <Block title="How it works">
            <Step n="1" label="Detect" text="A tiny snippet spots the in-app browser before paint." />
            <Step n="2" label="Escape" text="It hands the shopper to their real Safari / Chrome, session intact." />
            <Step n="3" label="Convert" text="Wallets fire, checkout is one tap, the order completes." />
          </Block>
        </section>

        {/* Footer / CTA */}
        <footer className="mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border border-[#ececf0] bg-[#fafafa] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-[13.5px] font-semibold tracking-tight">Live in ~15 minutes</div>
            <div className="text-[12.5px] text-[#52525b]">
              One snippet, one Customer-Events pixel, one order webhook. We set it up with you.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`mailto:${CONTACT}`}
              className="inline-flex h-9 items-center rounded-full border border-[#e4e4e7] bg-white px-4 text-[13px] font-medium text-[#52525b] hover:text-[#09090b]"
            >
              Talk to us
            </a>
            <Link
              href={CTA_HREF}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#09090b] px-4 text-[13px] font-medium text-white"
            >
              Get started
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8b8d96]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-[7px] inline-block size-1.5 shrink-0 rounded-full bg-[#4f7cff]" />
      <p className="text-[13px] leading-relaxed text-[#3f3f46]">{children}</p>
    </div>
  );
}

function Step({ n, label, text }: { n: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[11px] font-semibold text-[#4f7cff]">
        {n}
      </span>
      <p className="text-[13px] leading-relaxed text-[#3f3f46]">
        <span className="font-semibold text-[#09090b]">{label}.</span> {text}
      </p>
    </div>
  );
}
