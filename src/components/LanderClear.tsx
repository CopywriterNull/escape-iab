import Link from "next/link";
import { CASE_STUDIES, cvr, liftPct, rpvCents } from "@/lib/case-studies";

// Homepage rewrite, built from the actual sales calls (Mud Water, Riley/Pier,
// Litigo, GFuel) rather than from the product's internals.
//
// What changed and why:
//  · Pricing now matches what's actually sold — two weeks free, then $300/mo +
//    10% of *incremental* revenue, caps at scale. The old volume tiers
//    ($300 ≤50k escapes / $1,500 ≤250k) quoted a high-volume brand a bigger
//    minimum before proving anything, which is the opposite of the real offer.
//  · The persistent-tab benefit is on the page. Every call mentions it; the
//    old page never did.
//  · Objections that actually gate deals get their own sections: does it break
//    anything, does it break attribution, is the lift real.
//  · Speaks to new-customer CAC, which is what growth leads budget against.
//  · Proof is the ten published case studies, not a hardcoded table.

const READY = CASE_STUDIES.filter((c) => ["home-fragrance", "energy-drinks", "herbal-supplements"].includes(c.slug));

export function LanderClear() {
  return (
    <div className="text-[var(--color-fg)] bg-[var(--color-bg)] grain relative overflow-x-clip">
      <Nav />
      <Hero />
      <Mechanism />
      <Proof />
      <NothingChanges />
      <HowWeMeasure />
      <Install />
      <PricingReal />
      <Faq />
      <Close />
      <Foot />
    </div>
  );
}

/* ---------------------------------- nav --------------------------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--color-bg)]/85 border-b border-[var(--color-border)]/60">
      <div className="mx-auto max-w-5xl px-5 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-[15px]">
          <span className="inline-block size-2 rounded-full bg-[var(--color-accent)]" />
          Escape Hatch
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3 text-[13.5px]">
          <a href="#how" className="hidden sm:inline text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-2 py-1 transition-colors">How it works</a>
          <Link href="/case-studies" className="hidden sm:inline text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-2 py-1 transition-colors">Results</Link>
          <a href="#pricing" className="hidden sm:inline text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-2 py-1 transition-colors">Pricing</a>
          <Link href="/login" className="hidden sm:inline text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-2 py-1 transition-colors">Sign in</Link>
          <a
            href="#start"
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[13.5px] font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Start the free test
          </a>
        </nav>
      </div>
    </header>
  );
}

/* --------------------------------- hero --------------------------------- */

function Hero() {
  return (
    <section className="relative border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-5xl px-5 pt-20 pb-16 md:pt-28 md:pb-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-3 py-1 text-[12px] text-[var(--color-fg-dim)]">
          <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
          Two weeks free. No contract. You see the numbers before you pay anything.
        </span>

        <h1 className="mt-7 max-w-3xl text-balance">
          <span className="block h-display text-[38px] sm:text-[52px] md:text-[64px] leading-[1.02] tracking-tight">
            Half your Instagram budget
          </span>
          <span className="block mt-1 h-editorial text-[38px] sm:text-[52px] md:text-[64px] leading-[1.02] text-[var(--color-accent)]">
            lands in a browser that can&apos;t check out.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-[var(--color-fg-dim)]">
          Instagram opens your store inside its own in-app browser — no saved passwords, no Shop Pay
          or Apple Pay autofill, and a session that dies the second someone swipes away. Escape Hatch
          moves that visitor into their real browser before the page paints. Same ad, same spend,
          same landing page — a checkout that actually works.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a
            href="#start"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[15px] font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Start the two-week test
          </a>
          <Link
            href="/case-studies"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-[var(--color-border)] text-[15px] font-medium hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            See ten randomized results
          </Link>
        </div>

        <p className="mt-4 text-[12.5px] text-[var(--color-fg-muted)]">
          Works on iOS and Android · Shopify install takes minutes · Nothing changes in Meta
        </p>

        <dl className="mt-14 grid sm:grid-cols-3 gap-px bg-[var(--color-border-soft)] rounded-xl overflow-hidden border border-[var(--color-border-soft)]">
          <HeroStat
            k="Typical revenue-per-visitor lift"
            v="20–40%"
            note="on Instagram traffic, measured against a held-back control"
          />
          <HeroStat k="Best measured result" v="3.2% vs 1.2%" note="purchase rate, escaped vs control, 50k visitors" />
          <HeroStat k="Changes to your ads" v="None" note="same links, same creative, same UTMs" />
        </dl>
      </div>
    </section>
  );
}

function HeroStat({ k, v, note }: { k: string; v: string; note: string }) {
  return (
    <div className="bg-[var(--color-card)] px-5 py-6">
      <dt className="text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">{k}</dt>
      <dd className="mt-2 h-display text-[30px] tracking-tight tnum">{v}</dd>
      <p className="mt-1.5 text-[12.5px] text-[var(--color-fg-dim)] leading-snug">{note}</p>
    </div>
  );
}

/* ------------------------------- mechanism ------------------------------ */

function Mechanism() {
  const steps = [
    {
      n: "01",
      t: "Someone taps your ad",
      d: "Instagram opens your store in its in-app webview. They have no saved cards, no logins, and a checkout most of them abandon.",
    },
    {
      n: "02",
      t: "We move them to their real browser",
      d: "Our script detects the webview and reopens the exact same URL in Safari or Chrome — before first paint, so it feels like a normal page load. Every UTM and click ID rides along.",
    },
    {
      n: "03",
      t: "And the tab stays there",
      d: "This is the part brands don't expect. Your store is now an open tab in their real browser. When they reopen it that evening — or next week — you're still on screen. Retargeting you didn't pay for.",
    },
  ];
  return (
    <section id="how" className="border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <SectionHead
          eyebrow="How it works"
          title="One script. Three seconds of difference."
          sub="There is no new checkout, no new landing page, and nothing for your media buyer to change."
        />
        <ol className="mt-12 grid md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <li key={s.n} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
              <div className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-accent)]">{s.n}</div>
              <h3 className="mt-3 text-[16.5px] font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] text-[var(--color-fg-muted)] max-w-2xl">
          The handoff costs about a second of load time. Across every brand we&apos;ve measured, that
          second has never once outweighed what a working checkout is worth.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------- proof -------------------------------- */

function Proof() {
  return (
    <section className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <SectionHead
          eyebrow="Results"
          title="We don't publish testimonials. We publish splits."
          sub="Every install starts as a randomized 50/50 test on your own traffic. These are completed windows, reported with sample sizes and z-scores — the same numbers the brands see on their dashboards."
        />
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {READY.map((cs) => {
            const c = Math.round(liftPct(cvr(cs.a), cvr(cs.b)) * 100);
            const r = Math.round(liftPct(rpvCents(cs.a), rpvCents(cs.b)) * 100);
            return (
              <Link
                key={cs.slug}
                href={`/case-studies/${cs.slug}`}
                className="group rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6 hover:border-[var(--color-accent)]/40 transition-colors"
              >
                <div className="text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
                  {cs.category}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="h-display text-[40px] leading-none text-[var(--color-success)] tnum">+{c}%</span>
                  <span className="text-[12px] text-[var(--color-fg-muted)] font-mono">checkout</span>
                </div>
                <div className="mt-2 text-[13px] text-[var(--color-fg-dim)] tnum">
                  +{r}% revenue per visitor · {(cs.a.visitors + cs.b.visitors).toLocaleString("en-US")} visitors
                </div>
                <div className="mt-4 text-[12.5px] font-medium text-[var(--color-accent)] group-hover:underline underline-offset-2">
                  Read the test →
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-8 text-[13.5px] text-[var(--color-fg-dim)] max-w-2xl leading-relaxed">
          Being straight with you: results vary. Most brands land in the 20–40% range, a few go much
          higher, and a couple come out flat. That&apos;s exactly why the first two weeks are free —
          you find out which one you are before you owe anything.
        </p>
        <Link href="/case-studies" className="mt-4 inline-block text-[13.5px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2">
          All ten case studies →
        </Link>
      </div>
    </section>
  );
}

/* ---------------------------- nothing changes --------------------------- */

function NothingChanges() {
  const items = [
    { t: "Your ads", d: "No new links, no new creative, no campaign changes. Your media buyer does nothing." },
    { t: "Your attribution", d: "fbclid and every UTM pass straight through, untouched. Triple Whale, Northbeam, and Shopify reporting keep working." },
    { t: "Your site", d: "One script in the theme header. No theme rebuild, no checkout changes, no app conflicts." },
    { t: "Your control", d: "A kill switch that takes effect immediately. Cancel any month; there's no contract to get out of." },
  ];
  return (
    <section className="border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <SectionHead
          eyebrow="What we touch"
          title="Almost nothing."
          sub="The most common question on a technical review call is what this breaks. The answer is that it sits beside your stack rather than inside it."
        />
        <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[var(--color-border-soft)] rounded-xl overflow-hidden border border-[var(--color-border-soft)]">
          {items.map((i) => (
            <div key={i.t} className="bg-[var(--color-card)] p-6">
              <div className="flex items-center gap-2">
                <Check />
                <h3 className="text-[15px] font-semibold tracking-tight">{i.t}</h3>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- how we measure --------------------------- */

function HowWeMeasure() {
  return (
    <section className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 items-start">
          <div>
            <SectionHead
              eyebrow="How we measure"
              title="You should assume every vendor is over-attributing."
              sub="So here's exactly how the number you'll be billed on is produced."
            />
          </div>
          <ol className="space-y-5">
            <Measure
              n="1"
              t="A real control group, always"
              d="We hold back 10% of your Instagram traffic (or 50% during the first test) and never escape it. Your lift is the gap between two groups running at the same moment — so seasonality, a viral week, or a sale hits both arms equally."
            />
            <Measure
              n="2"
              t="Your Shopify events, not Meta's"
              d="Purchases come from Shopify Customer Events and order webhooks — the actual orders in your admin. No attribution windows, no view-through, no double counting against your other channels."
            />
            <Measure
              n="3"
              t="Outliers trimmed both ways"
              d="One wholesale-sized order can invent a 200% lift or erase a real one. We remove extremes from both arms before computing anything, and show you the raw view too."
            />
            <Measure
              n="4"
              t="Significance before invoices"
              d="We report daily or weekly until the result is statistically real. You see the number, and only then does billing start."
            />
          </ol>
        </div>
      </div>
    </section>
  );
}

function Measure({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <li className="flex gap-4">
      <span className="shrink-0 size-6 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-accent)] font-mono text-[11px] flex items-center justify-center mt-0.5">
        {n}
      </span>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{t}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{d}</p>
      </div>
    </li>
  );
}

/* -------------------------------- install ------------------------------- */

function Install() {
  return (
    <section className="border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <SectionHead
          eyebrow="Install"
          title="Send a collaborator code. You're live the same day."
          sub="We do the install; your developer reviews it. Three things go in, all reversible."
        />
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            { t: "The script", d: "One synchronous tag at the top of your theme header. It has to run before paint — that's the whole trick." },
            { t: "Customer Events pixel", d: "Shopify's native pixel, so purchases attribute to the right visitor with no guesswork." },
            { t: "Order webhook", d: "Confirms revenue against real orders, so the dashboard can never drift from your admin." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6">
              <h3 className="text-[15px] font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- pricing ------------------------------- */

function PricingReal() {
  return (
    <section id="pricing" className="border-b border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
      <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <SectionHead
          eyebrow="Pricing"
          title="You keep the upside. We take a slice of what we add."
          sub="No setup fee, no annual contract, no minimum volume."
        />

        <div className="mt-12 grid md:grid-cols-[1.2fr_1fr] gap-5 items-stretch">
          <div className="rounded-2xl border-2 border-[var(--color-accent)]/45 bg-[var(--color-card-hi)] p-8" style={{ boxShadow: "var(--shadow-elev)" }}>
            <div className="text-[10.5px] uppercase tracking-[0.2em] font-semibold text-[var(--color-accent)]">
              The whole offer
            </div>
            <div className="mt-6 flex items-end gap-3 flex-wrap">
              <span className="h-display text-[52px] leading-none tnum">Free</span>
              <span className="text-[15px] text-[var(--color-fg-dim)] pb-2">for the first two weeks</span>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--color-fg-dim)]">
              We install it, run the split test, and report until the result is statistically real. If
              the lift isn&apos;t there, you turn it off and owe nothing — and you keep the read on how
              much the in-app browser is costing you.
            </p>
            <div className="mt-8 pt-8 border-t border-[var(--color-border-soft)]">
              <div className="text-[10.5px] uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)]">
                After it&apos;s proven
              </div>
              <div className="mt-4 flex items-end gap-2 flex-wrap">
                <span className="h-display text-[40px] leading-none tnum">$300</span>
                <span className="text-[14px] text-[var(--color-fg-dim)] pb-1.5">/mo platform fee</span>
                <span className="h-display text-[26px] leading-none text-[var(--color-fg-muted)] px-2 pb-1">+</span>
                <span className="h-display text-[40px] leading-none tnum">10%</span>
                <span className="text-[14px] text-[var(--color-fg-dim)] pb-1.5">of the incremental revenue</span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-fg-dim)]">
                Incremental means the gap between the escaped group and the control group, on
                Instagram traffic only. Not your total revenue, not your other channels — the
                measured difference, nothing else. If there&apos;s no lift in a month, there&apos;s no
                performance fee that month.
              </p>
            </div>
            <a
              href="#start"
              className="mt-8 inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[15px] font-medium press lift focus-ring"
              style={{ boxShadow: "var(--shadow-cta)" }}
            >
              Start the two-week test
            </a>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 flex flex-col">
            <div className="text-[10.5px] uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)]">
              Spending heavily on Instagram?
            </div>
            <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--color-fg-dim)]">
              At high volume the percentage stops making sense for both of us. Brands past roughly
              six figures a month in Instagram revenue move to a capped or fixed monthly fee — we&apos;ve
              done it several times and we&apos;ll bring it up before you have to.
            </p>
            <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--color-fg-dim)]">
              Not ecommerce? Lead-gen and service businesses run on a flat monthly fee instead, since
              there&apos;s no order value to share.
            </p>
            <div className="mt-auto pt-8">
              <a
                href="mailto:hi@getescapehatch.com?subject=Escape%20Hatch%20—%20volume%20pricing"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-accent)] hover:underline underline-offset-2"
              >
                Talk about a cap →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- faq --------------------------------- */

function Faq() {
  const qs = [
    {
      q: "Does the extra browser hop hurt conversion?",
      a: "It adds roughly a second. We've watched for a drop-off cost on every account and haven't found one that comes close to what the working checkout returns — a real browser has their saved cards, their logins, and Apple Pay.",
    },
    {
      q: "Will this break our attribution?",
      a: "No. The click ID and every UTM are carried through the handoff and restored on the other side, so Meta, Triple Whale, Northbeam and your Shopify reports all still see what they expect. Nothing is overwritten or replaced.",
    },
    {
      q: "Meta shows escaped campaigns performing worse. Why?",
      a: "Because iOS strips Meta's click ID during any app-to-browser handoff, so the pixel undercounts exactly the visitors who are converting best — they land in your reports as direct traffic. We restore the click ID to close most of that gap, and your first-party numbers show the truth. It's the most common surprise on this product, and it's measurement, not performance.",
    },
    {
      q: "What about Android?",
      a: "Works the same way. Android users get handed to whatever they've set as their default browser — Chrome, Brave, whatever it is.",
    },
    {
      q: "Who needs to be involved to get started?",
      a: "One person with a Shopify collaborator code, and usually a developer who wants to see what the script does before it goes in the theme. That review is welcome; it's a single tag and we'll walk them through it.",
    },
    {
      q: "What if the test shows no lift?",
      a: "You turn it off and pay nothing. You'll still walk away knowing what the in-app browser costs you, measured on your own traffic — which is worth having either way.",
    },
  ];
  return (
    <section className="border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-3xl px-5 py-20 md:py-24">
        <SectionHead eyebrow="Questions" title="The ones that actually come up." />
        <div className="mt-10 divide-y divide-[var(--color-border-soft)] border-y border-[var(--color-border-soft)]">
          {qs.map((x) => (
            <details key={x.q} className="group py-5">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                <span className="text-[15.5px] font-medium tracking-tight">{x.q}</span>
                <span className="mt-1 shrink-0 text-[var(--color-fg-muted)] group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-dim)] max-w-2xl">{x.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- close -------------------------------- */

function Close() {
  return (
    <section id="start" className="border-b border-[var(--color-border-soft)]">
      <div className="mx-auto max-w-5xl px-5 py-24 text-center">
        <h2 className="h-display text-[32px] sm:text-[42px] tracking-tight text-balance max-w-2xl mx-auto leading-[1.06]">
          Find out what the in-app browser is costing you.
        </h2>
        <p className="mt-5 text-[15.5px] text-[var(--color-fg-dim)] max-w-xl mx-auto leading-relaxed">
          Two weeks, your own traffic, a real control group. Worst case you get a number nobody else
          will give you. Best case you stop losing the checkouts you already paid for.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:hi@getescapehatch.com?subject=Start%20the%20two-week%20test"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[15px] font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Start the two-week test
          </a>
          <Link
            href="/case-studies"
            className="inline-flex items-center px-6 py-3 rounded-lg border border-[var(--color-border)] text-[15px] font-medium hover:bg-[var(--color-bg-elev)] press transition-colors"
          >
            Read the results first
          </Link>
        </div>
        <p className="mt-5 text-[12.5px] text-[var(--color-fg-muted)]">
          No contract · No setup fee · Kill switch on day one
        </p>
      </div>
    </section>
  );
}

function Foot() {
  return (
    <footer>
      <div className="mx-auto max-w-5xl px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[12.5px] text-[var(--color-fg-muted)]">
        <span>© {new Date().getFullYear()} Escape Hatch · Built for ecommerce that lives on Meta ads</span>
        <span className="flex items-center gap-4">
          <Link href="/case-studies" className="hover:text-[var(--color-fg)] transition-colors">Results</Link>
          <Link href="/privacy" className="hover:text-[var(--color-fg)] transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-[var(--color-fg)] transition-colors">Terms</Link>
          <a href="mailto:hi@getescapehatch.com" className="hover:text-[var(--color-fg)] transition-colors">Email</a>
        </span>
      </div>
    </footer>
  );
}

/* --------------------------------- atoms -------------------------------- */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="text-[10px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-2" style={{ color: "var(--color-accent)" }}>
        <span className="size-1 rounded-full bg-[var(--color-accent)]" />
        {eyebrow}
      </span>
      <h2 className="mt-4 h-display text-[28px] sm:text-[36px] leading-[1.08] tracking-tight text-balance">{title}</h2>
      {sub ? <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-fg-dim)]">{sub}</p> : null}
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
