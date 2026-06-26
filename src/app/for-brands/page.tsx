import Link from "next/link";
import type { Metadata } from "next";

// Unlisted sales one-pager — sent directly to prospects, kept out of search.
export const metadata: Metadata = {
  title: "EscapeHatch — Recover the revenue your paid social ads leak",
  description:
    "Instagram & TikTok in-app browsers wipe cookies and break Shop Pay, Apple Pay, and saved logins — so your best paid traffic converts worst. EscapeHatch escapes those shoppers to their real browser and proves the lift with a live A/B holdout.",
  robots: { index: false, follow: false },
};

const CTA_HREF = "/get-started";

/* ────────────────────────────────────────────────────────────── */

export default function ForBrands() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="gradient-dotgrid" aria-hidden />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 focus-ring rounded-md">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">EscapeHatch</span>
        </Link>
        <Link
          href={CTA_HREF}
          className="press lift focus-ring inline-flex h-9 items-center rounded-full bg-[var(--color-cta-bg)] px-4 text-[13px] font-medium text-[var(--color-cta-fg)]"
        >
          Get started
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <div className="hero-enter hero-enter-1 mb-5 flex justify-center">
          <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
            For DTC brands on Meta &amp; TikTok
          </span>
        </div>

        <h1 className="hero-enter hero-enter-2 h-display gradient-text mx-auto max-w-3xl text-[clamp(2.4rem,6vw,4.25rem)]">
          Your paid social traffic is leaking revenue{" "}
          <span className="highlight-sweep text-[var(--color-fg)]">in the in-app browser.</span>
        </h1>

        <p className="hero-enter hero-enter-3 mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--color-fg-dim)]">
          Instagram and TikTok open your store inside their own in-app browser — which wipes cookies
          and breaks Shop&nbsp;Pay, Apple&nbsp;Pay, and saved logins. So your highest-intent, most
          expensive clicks convert the worst, and you never see it. EscapeHatch fixes that, and proves
          the lift with a live control group.
        </p>

        <div className="hero-enter hero-enter-4 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={CTA_HREF}
            className="group press lift focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-cta-bg)] pl-5 pr-2.5 text-[14px] font-medium text-[var(--color-cta-fg)] shadow-[var(--shadow-cta)]"
          >
            See it on your store
            <span className="btn-icon">
              <Arrow />
            </span>
          </Link>
          <a
            href="#how"
            className="press focus-ring inline-flex h-11 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-5 text-[14px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
          >
            How it works
          </a>
        </div>

        {/* Headline stat strip */}
        <div className="hero-enter hero-enter-5 mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat value="+78%" label="revenue-per-visitor lift" sub="measured, portfolio-wide" />
          <Stat value="240k+" label="shoppers measured" sub="against a live holdout" />
          <Stat value="~15 min" label="to install" sub="no heavy dev work" />
        </div>
      </section>

      {/* The problem */}
      <Section id="problem" eyebrow="The problem" title="The in-app browser quietly taxes every paid click">
        <p className="mx-auto mb-10 max-w-2xl text-center text-[15.5px] leading-relaxed text-[var(--color-fg-dim)]">
          When someone taps your ad in Instagram or TikTok, the store opens in a stripped-down
          embedded browser — not their real Safari or Chrome. That sandbox is where conversions go to
          die:
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <ProblemCard
            icon={<CookieIcon />}
            title="Cookies get wiped"
            body="The in-app browser doesn't share cookies with the customer's real browser. Carts, sessions, and returning-customer recognition reset to zero on every visit."
          />
          <ProblemCard
            icon={<WalletIcon />}
            title="One-tap checkout breaks"
            body="Shop Pay, Apple Pay, and Google Pay often won't fire inside the embedded browser. Shoppers face a full manual checkout instead of one tap — and many bounce."
          />
          <ProblemCard
            icon={<GhostIcon />}
            title="It's invisible in analytics"
            body="These sessions look like normal traffic that just didn't convert. The leak hides in plain sight, so brands blame creative or price instead of the browser."
          />
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
          The cruel part: this hits your <span className="text-[var(--color-fg)]">best</span> traffic
          — the high-intent shoppers you paid the most to acquire.
        </p>
      </Section>

      {/* How it works */}
      <Section id="how" eyebrow="How it works" title="One lightweight snippet. Three steps. Real browser.">
        <div className="mx-auto max-w-3xl">
          <div className="grid gap-4 md:grid-cols-3">
            <StepCard
              n="01"
              title="Detect"
              body="A tiny script on your storefront recognizes when a visitor is inside Instagram's or TikTok's in-app browser — before the page even finishes painting."
            />
            <StepCard
              n="02"
              title="Escape"
              body="It hands the shopper off to their real Safari or Chrome, carrying the session with them — so logins, autofill, and one-tap wallets all work again."
            />
            <StepCard
              n="03"
              title="Convert"
              body="The shopper lands in a real browser with a real session. Shop Pay and Apple Pay fire, checkout is one tap, and the order actually completes."
            />
          </div>
          <div className="card mt-4 flex items-start gap-3 px-5 py-4 text-[13.5px] text-[var(--color-fg-dim)]">
            <span className="pill pill-info mt-0.5 shrink-0">Fail-open</span>
            <p>
              If anything ever goes wrong, the snippet does nothing and the shopper sees your normal
              store. It can never block a sale — only recover ones you were already losing.
            </p>
          </div>
        </div>
      </Section>

      {/* Proof */}
      <Section id="proof" eyebrow="The proof" title="You don't take our word for it. You watch the holdout.">
        <p className="mx-auto mb-10 max-w-2xl text-center text-[15.5px] leading-relaxed text-[var(--color-fg-dim)]">
          Every install runs as a 50/50 A/B test. Half of your in-app-browser shoppers are escaped;
          half stay as a control. You see the <span className="text-[var(--color-fg)]">actual</span>{" "}
          revenue difference between the two — not a projection, not a promise.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <ProofCard
            metric="+50.8%"
            unit="revenue per visitor"
            detail="A leading supplement brand, escaped shoppers vs. their live control group."
            tag="p < .001"
          />
          <ProofCard
            metric="+78%"
            unit="RPV lift, portfolio-wide"
            detail="Blended across 240k+ measured shoppers and multiple brands and verticals."
            tag="240k+ shoppers"
          />
          <ProofCard
            metric="$188k"
            unit="downstream revenue"
            detail="An apparel brand's recovered shoppers came back and bought again — revenue the control group never generated."
            tag="repeat orders"
          />
        </div>

        <div className="card-hi mx-auto mt-6 max-w-3xl px-6 py-5">
          <div className="eyebrow mb-2">Why this is different</div>
          <p className="text-[15px] leading-relaxed text-[var(--color-fg-dim)]">
            Most "recovery" tools show you an estimate. EscapeHatch keeps a real control group running,
            so the lift on your dashboard is the measured gap between escaped and not-escaped shoppers{" "}
            <span className="text-[var(--color-fg)]">on your own store</span>, with statistical
            significance attached. If it's not working for you, you'll know — and so will we.
          </p>
        </div>
      </Section>

      {/* What you get */}
      <Section eyebrow="What you get" title="Proof you can defend to your CFO">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <FeatureCard
            title="Authoritative purchase data"
            body="Orders are attributed server-side via a Shopify webhook — surviving Shop Pay, Apple Pay, returning customers, and every checkout flow Shopify supports. No cookie guesswork."
          />
          <FeatureCard
            title="A live A/B dashboard"
            body="Revenue-per-visitor lift, conversion-rate lift, and significance — escaped vs. control, updated continuously. The number is always honest because the control is always running."
          />
          <FeatureCard
            title="Incremental-revenue math"
            body="See the actual dollars recovered: current escaped RPV minus your control RPV, across your eligible traffic. The line item that justifies the spend."
          />
          <FeatureCard
            title="Zero performance cost"
            body="The snippet is tiny, runs before paint, and fails open. It speeds up the path to checkout — it never slows your store down."
          />
        </div>
      </Section>

      {/* Install */}
      <Section eyebrow="Onboarding" title="Live in about 15 minutes">
        <div className="card mx-auto max-w-2xl overflow-hidden p-2">
          <InstallStep
            n="1"
            title="Paste the snippet"
            body="One script tag in your theme. We give you the exact code, scoped to your store."
          />
          <InstallStep
            n="2"
            title="Add the Customer Events pixel"
            body="A custom pixel in Shopify → Settings → Customer events, so we can read your funnel."
          />
          <InstallStep
            n="3"
            title="Add the Order-paid webhook"
            body="A one-line webhook so purchase data flows in authoritatively. Then watch the holdout."
            last
          />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-[13.5px] text-[var(--color-fg-muted)]">
          We hand you a personalized install page with every block pre-filled — and we'll watch the
          first days of data with you to confirm it's firing.
        </p>
      </Section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-8">
        <div className="card-hi mesh-bg relative overflow-hidden px-8 py-14 text-center">
          <h2 className="h-section mx-auto max-w-2xl text-[clamp(1.6rem,3.5vw,2.5rem)]">
            See how much your store is leaking — measured, not guessed.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-[var(--color-fg-dim)]">
            Install runs as an A/B test, so the first thing you get is the truth about your own
            in-app-browser traffic. If the lift isn't there, you'll see it.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={CTA_HREF}
              className="group press lift focus-ring inline-flex h-12 items-center gap-2 rounded-full bg-[var(--color-cta-bg)] pl-6 pr-3 text-[15px] font-medium text-[var(--color-cta-fg)] shadow-[var(--shadow-cta)]"
            >
              Get started
              <span className="btn-icon">
                <Arrow />
              </span>
            </Link>
            <a
              href="mailto:hello@getescapehatch.com"
              className="press focus-ring inline-flex h-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-6 text-[15px] font-medium text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]"
            >
              Talk to us
            </a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl px-6 pb-10">
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border-soft)] pt-6 text-[12px] text-[var(--color-fg-muted)] sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-medium text-[var(--color-fg-dim)]">EscapeHatch</span>
          </div>
          <span>Recover the revenue the in-app browser takes.</span>
        </div>
      </footer>
    </main>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative z-10 mx-auto max-w-5xl scroll-mt-20 px-6 py-16 sm:py-20">
      <div className="mb-10 text-center">
        <div className="eyebrow mb-3">{eyebrow}</div>
        <h2 className="h-section mx-auto max-w-2xl text-[clamp(1.5rem,3.4vw,2.3rem)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="card px-4 py-4 text-center">
      <div className="h-display tnum text-[28px] text-[var(--color-fg)]">{value}</div>
      <div className="mt-1 text-[12.5px] font-medium text-[var(--color-fg-dim)]">{label}</div>
      <div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</div>
    </div>
  );
}

function ProblemCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card lift p-6">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] text-[var(--color-accent)]">
        {icon}
      </div>
      <h3 className="text-[16px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{body}</p>
    </div>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card-hi p-6">
      <div className="eyebrow mb-3 text-[var(--color-accent)]">{n}</div>
      <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{body}</p>
    </div>
  );
}

function ProofCard({
  metric,
  unit,
  detail,
  tag,
}: {
  metric: string;
  unit: string;
  detail: string;
  tag: string;
}) {
  return (
    <div className="card lift flex flex-col p-6">
      <div className="flex items-baseline justify-between gap-2">
        <span className="h-display tnum text-[34px] text-[var(--color-success)]">{metric}</span>
        <span className="pill pill-success">{tag}</span>
      </div>
      <div className="mt-1 text-[13px] font-medium text-[var(--color-fg)]">{unit}</div>
      <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">{detail}</p>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="mb-3 inline-flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
          <Check />
        </span>
        <h3 className="text-[15.5px] font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{body}</p>
    </div>
  );
}

function InstallStep({
  n,
  title,
  body,
  last,
}: {
  n: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 ${
        last ? "" : "border-b border-[var(--color-border-soft)]"
      }`}
    >
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-cta-bg)] text-[12px] font-semibold text-[var(--color-cta-fg)]">
        {n}
      </span>
      <div>
        <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-fg-dim)]">{body}</p>
      </div>
    </div>
  );
}

/* ───────────────────────── icons ───────────────────────── */

function Logo() {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]">
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 8h9M8 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CookieIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-5 4 4 0 0 1-4-4Z" strokeLinejoin="round" />
      <circle cx="9" cy="11" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="13" cy="14" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M16 14h2" strokeLinecap="round" />
    </svg>
  );
}

function GhostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.4 20 12 18.4 9.6 20 7.3 18.4 5 20Z"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="10.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
