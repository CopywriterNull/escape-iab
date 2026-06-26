import Link from "next/link";
import type { Metadata } from "next";

// Unlisted exec one-pager — sent directly to prospects, kept out of search.
export const metadata: Metadata = {
  title: "EscapeHatch — Executive Brief",
  description:
    "Instagram & TikTok in-app browsers break Shop Pay, Apple Pay, and saved logins — so your best paid traffic converts worst. EscapeHatch escapes those shoppers to their real browser and proves the lift with a live control group.",
  robots: { index: false, follow: false },
};

const CTA_HREF = "/get-started";
const CONTACT = "hello@getescapehatch.com";

/* Forced-light exec one-pager. A single centered "sheet" that reads top to
   bottom in ~60s and prints to one clean page. */
export default function ForBrands() {
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
              @page { margin: 0.45in; }
              .desk { background: #fff !important; padding: 0 !important; }
              .sheet { box-shadow: none !important; border-color: #e4e4e7 !important; max-width: 100% !important; }
            }
          `,
        }}
      />

      <article className="sheet mx-auto max-w-[860px] rounded-2xl border border-[#e4e4e7] bg-white p-8 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-12">
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
          <h1 className="text-[clamp(1.4rem,3vw,1.9rem)] font-semibold leading-[1.18] tracking-[-0.02em]">
            Your Instagram &amp; TikTok ads open inside an in-app browser that breaks Shop&nbsp;Pay,
            Apple&nbsp;Pay, and saved logins — so your best paid traffic converts worst.{" "}
            <span className="text-[#4f7cff]">
              EscapeHatch escapes those shoppers to their real browser, and proves the lift with a
              live control group.
            </span>
          </h1>
        </section>

        {/* Proof stats */}
        <section className="mt-6 grid grid-cols-3 gap-3">
          <Stat value="+78%" label="revenue-per-visitor lift" />
          <Stat value="240k+" label="shoppers measured" />
          <Stat value="p < .001" label="statistical significance" />
        </section>

        {/* Two-column body */}
        <section className="mt-7 grid gap-7 md:grid-cols-2">
          <div>
            <Block title="The problem">
              <Bullet>
                In-app browsers wipe cookies — carts, sessions, and returning customers reset to zero.
              </Bullet>
              <Bullet>
                Shop&nbsp;Pay / Apple&nbsp;Pay frequently won&apos;t fire, forcing a full manual
                checkout.
              </Bullet>
              <Bullet>
                It&apos;s invisible in analytics — the leak hides as &ldquo;traffic that didn&apos;t
                convert.&rdquo;
              </Bullet>
            </Block>

            <Block title="How it works" className="mt-6">
              <Step n="1" label="Detect" text="A tiny snippet spots the in-app browser before paint." />
              <Step n="2" label="Escape" text="It hands the shopper to their real Safari / Chrome, session intact." />
              <Step n="3" label="Convert" text="Wallets fire, checkout is one tap, the order completes." />
            </Block>
          </div>

          <div>
            <Block title="Proven, not projected">
              <Result metric="+50.8%" text="RPV vs. holdout — a leading supplement brand (p<.001)." />
              <Result metric="+78%" text="RPV lift blended across 240k+ measured shoppers." />
              <Result metric="$188k" text="downstream revenue from recovered shoppers an apparel brand would have lost." />
              <p className="mt-3 text-[12px] leading-relaxed text-[#8b8d96]">
                Every install runs as a 50/50 A/B test against a live control — the lift on your
                dashboard is measured on <span className="text-[#09090b]">your</span> store, not
                estimated.
              </p>
            </Block>

            <Block title="What you get" className="mt-6">
              <Bullet>Authoritative, server-side purchase attribution (survives every checkout flow).</Bullet>
              <Bullet>A live A/B dashboard: RPV lift, CVR lift, and significance.</Bullet>
              <Bullet>Incremental dollars recovered — the line item that justifies the spend.</Bullet>
            </Block>
          </div>
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

/* ───────────────────────── building blocks ───────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3 py-3 text-center">
      <div className="text-[clamp(1.3rem,3.5vw,1.7rem)] font-semibold tracking-[-0.03em] text-[#16a34a] [font-variant-numeric:tabular-nums]">
        {value}
      </div>
      <div className="mt-0.5 text-[11.5px] font-medium leading-tight text-[#52525b]">{label}</div>
    </div>
  );
}

function Block({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#8b8d96]">
        {title}
      </h2>
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

function Result({ metric, text }: { metric: string; text: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="w-[68px] shrink-0 text-[15px] font-semibold tracking-[-0.02em] text-[#16a34a] [font-variant-numeric:tabular-nums]">
        {metric}
      </span>
      <p className="text-[13px] leading-relaxed text-[#3f3f46]">{text}</p>
    </div>
  );
}
