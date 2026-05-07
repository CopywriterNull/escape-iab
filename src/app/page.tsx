import Link from "next/link";
import { brand } from "@/lib/branding";

export default function Home() {
  return (
    <div className="text-[var(--color-fg)]">
      <Nav />
      <Hero />
      <LogoStrip />
      <Problem />
      <HowItWorks />
      <Features />
      <SnippetPreview />
      <ABCallout />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--color-bg)]/70 border-b border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span>{brand.name}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--color-fg-dim)]">
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="#waitlist" className="text-sm text-[var(--color-fg-dim)] hover:text-white px-3 py-1.5">
            Sign in
          </a>
          <a
            href="#waitlist"
            className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-white/90"
          >
            Get early access
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="inline-flex size-7 items-center justify-center rounded-md"
      style={{ background: "linear-gradient(135deg, #5b8cff 0%, #b46bff 100%)" }}
    >
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M14 4h6v6" strokeLinecap="round" />
        <path d="M20 4l-8 8" strokeLinecap="round" />
        <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 glow pointer-events-none" />
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none" />
      <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/80 px-3 py-1 text-[12px] text-[var(--color-fg-dim)]">
            <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
            Now in private beta — Shopify, Liquid, custom storefronts
          </span>
        </div>
        <h1 className="text-center text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          <span className="gradient-text">Your Instagram traffic deserves</span>
          <br />
          <span className="gradient-text">a real browser.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-center text-[var(--color-fg-dim)] text-lg leading-relaxed">
          {brand.subhead}
        </p>
        <Waitlist />
        <p className="mt-3 text-center text-xs text-[var(--color-fg-muted)]">
          No credit card. Free tier covers 5,000 escapes / mo. Install via Shopify App Embed or one snippet.
        </p>

        <HeroVisual />
      </div>
    </section>
  );
}

function Waitlist() {
  return (
    <form
      id="waitlist"
      action="https://formspree.io/f/REPLACE_ME"
      method="POST"
      className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
    >
      <input
        type="email"
        name="email"
        required
        placeholder="you@yourstore.com"
        className="w-full sm:flex-1 px-4 py-3 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[var(--color-accent)]/20"
      />
      <button
        type="submit"
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 shadow-[0_8px_30px_rgba(91,140,255,0.25)]"
      >
        Get early access
        <ArrowRight />
      </button>
    </form>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before card */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--color-fg-dim)]">
              <span className="size-2 rounded-full bg-[var(--color-danger)]" />
              Before — Instagram in-app browser
            </span>
            <span className="text-[var(--color-danger)] font-mono">CVR 0.8%</span>
          </div>
          <div className="mt-4 rounded-lg overflow-hidden border border-[var(--color-border)]">
            <FakeIABFrame ig />
          </div>
          <ul className="mt-4 space-y-1.5 text-[13px] text-[var(--color-fg-dim)]">
            <li className="flex items-center gap-2"><X /> Apple Pay button missing</li>
            <li className="flex items-center gap-2"><X /> Shop Pay autofill blocked</li>
            <li className="flex items-center gap-2"><X /> Returning customer = new visitor</li>
          </ul>
        </div>

        {/* After card */}
        <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-card)] p-5 shadow-[0_20px_80px_rgba(91,140,255,0.18)]">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--color-fg-dim)]">
              <span className="size-2 rounded-full bg-[var(--color-success)]" />
              After — Safari (real browser)
            </span>
            <span className="text-[var(--color-success)] font-mono">CVR 2.4%</span>
          </div>
          <div className="mt-4 rounded-lg overflow-hidden border border-[var(--color-border)]">
            <FakeIABFrame />
          </div>
          <ul className="mt-4 space-y-1.5 text-[13px] text-[var(--color-fg-dim)]">
            <li className="flex items-center gap-2"><Check /> Apple Pay native</li>
            <li className="flex items-center gap-2"><Check /> Shop Pay autofill works</li>
            <li className="flex items-center gap-2"><Check /> Returning customer recognized</li>
          </ul>
        </div>
      </div>
      <p className="text-center text-[11px] text-[var(--color-fg-muted)] mt-3 italic">
        Illustrative numbers. Actual lift varies — your dashboard A/B tests against your own traffic.
      </p>
    </div>
  );
}

function FakeIABFrame({ ig = false }: { ig?: boolean }) {
  return (
    <div className="bg-[var(--color-bg-elev)]">
      <div className={`flex items-center gap-2 px-3 py-2 ${ig ? "bg-black text-white" : "bg-neutral-900 text-white"}`}>
        {ig ? (
          <>
            <span className="text-[11px] opacity-80">×</span>
            <span className="text-[11px] truncate flex-1">yourshop.com</span>
            <span className="text-[11px] opacity-80">⋯</span>
          </>
        ) : (
          <>
            <span className="text-[11px] opacity-80">‹ ›</span>
            <span className="ml-1 inline-flex items-center gap-1 text-[11px] bg-white/10 rounded-full px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-white/60" /> yourshop.com
            </span>
            <span className="ml-auto text-[11px] opacity-80">⤴</span>
          </>
        )}
      </div>
      <div className="p-4 text-[12px] space-y-2">
        <div className="h-2 w-1/2 rounded bg-white/10" />
        <div className="h-2 w-3/4 rounded bg-white/10" />
        <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] font-medium ${ig ? "bg-white/10 text-white/40" : "bg-black text-white"}`}>
          {ig ? "Apple Pay unavailable" : "  Pay"}
        </div>
        <div className={`rounded-lg px-3 py-2 text-[12px] font-medium ${ig ? "bg-white/5 text-white/30" : "bg-[#5a31f4] text-white"}`}>
          {ig ? "Shop Pay disabled" : "Shop Pay"}
        </div>
      </div>
    </div>
  );
}

function LogoStrip() {
  const labels = ["Shopify", "Shopify Plus", "WooCommerce", "BigCommerce", "Webflow", "Liquid", "Custom"];
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg-elev)]/50">
      <div className="mx-auto max-w-6xl px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-[var(--color-fg-muted)]">
        <span className="text-[12px] uppercase tracking-wider">Works on</span>
        {labels.map((l) => (
          <span key={l} className="font-medium">{l}</span>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  const stats = [
    { k: "9%", v: "Avg Shop Pay checkout lift", note: "Shopify, 2024" },
    { k: "60%", v: "Mobile CVR boost when Apple Pay enabled", note: "industry, 2024" },
    { k: "70%", v: "Of IG users prefer their real browser when given the option", note: "Inapp Redirect" },
    { k: "28%", v: "Reported lift in completed checkouts after IAB escape", note: "vendor case study" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-24">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div>
          <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">The IG tax</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            Your IG ads work. Then Instagram&apos;s in-app browser kills the sale.
          </h2>
          <p className="mt-5 text-[var(--color-fg-dim)] leading-relaxed">
            Tap any link from inside Instagram — story, ad, profile, DM — and you don&apos;t get Safari.
            You get a stripped-down WebView with no Apple Pay, no Shop Pay autofill, no saved
            passwords, no shared cookies. Returning customers look like new visitors. Conversions
            crater. The customer doesn&apos;t blame Instagram. They blame you.
          </p>
          <p className="mt-4 text-[var(--color-fg-dim)] leading-relaxed">
            EscapeHatch silently bounces the visitor to their real browser before the page paints. They
            never see the in-app browser. Checkout works. The numbers speak for themselves.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.v} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <div className="text-3xl font-semibold tracking-tight">{s.k}</div>
              <div className="mt-1 text-sm text-[var(--color-fg)]">{s.v}</div>
              <div className="mt-2 text-[11px] text-[var(--color-fg-muted)]">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Install in 60 seconds",
      d: "Add via Shopify App Embed (one toggle, no theme code) or paste a single &lt;script&gt; tag. Survives theme upgrades.",
    },
    {
      n: "02",
      t: "We detect & escape",
      d: "Our snippet runs as the first thing on the page. It checks the user agent, and if it&apos;s Instagram&apos;s in-app browser, fires a deep link Instagram itself recognizes. The page reopens in Safari (or Chrome on Android) before checkout even loads.",
    },
    {
      n: "03",
      t: "We measure the lift",
      d: "50/50 A/B by default — half your IG visitors get escaped, half don&apos;t. Your dashboard shows the CVR delta in your own data, not vendor case studies.",
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="text-center max-w-2xl mx-auto">
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">How it works</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          One snippet. Three layers of recovery.
        </h2>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="font-mono text-xs text-[var(--color-accent)]">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
            <p
              className="mt-3 text-sm leading-relaxed text-[var(--color-fg-dim)]"
              dangerouslySetInnerHTML={{ __html: s.d }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { t: "Auto A/B testing", d: "50/50 split bucketed by cookie. Compare control vs escape with confidence interval." },
    { t: "Live escape analytics", d: "Per-day rollups. See impressions, escapes, fallback shown, fallback clicked." },
    { t: "Auto-update on patches", d: "If Instagram changes their behavior, we ship a new snippet edge-cached for 5 minutes. You don&apos;t lift a finger." },
    { t: "Branded fallback overlay", d: "For TikTok/Snapchat/FB IABs that can&apos;t auto-escape, a polished &quot;Open in Safari&quot; prompt." },
    { t: "Pixel & attribution safe", d: "Full URL with fbclid passes through. Meta dedupes by _fbp; sessions stay continuous." },
    { t: "First-party domain", d: "Snippet served from your own subdomain via CNAME (Pro+). Zero perf or third-party flag." },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="text-center max-w-2xl mx-auto">
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">Features</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          More than a one-line script.
        </h2>
        <p className="mt-3 text-[var(--color-fg-dim)]">
          The redirect itself is two lines of JavaScript. Anyone can write that. What you&apos;re paying for is the dashboard, the test infra, the fallbacks, and the maintenance pipeline.
        </p>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.t} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="font-semibold">{it.t}</h3>
            <p
              className="mt-2 text-sm text-[var(--color-fg-dim)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: it.d }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function SnippetPreview() {
  const code = `<!-- Paste once, in <head>. That's it. -->
<script src="https://escapehatch.app/s/YOUR-MERCHANT-ID.js" async></script>`;
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">Install</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            One <code className="font-mono text-[0.85em] bg-[var(--color-card)] px-2 py-0.5 rounded">&lt;script&gt;</code> tag. That&apos;s the entire install.
          </h2>
          <p className="mt-4 text-[var(--color-fg-dim)] leading-relaxed">
            Shopify users get a 1-click App Embed — no code at all. Everyone else pastes one line in
            their <code className="font-mono">&lt;head&gt;</code>. Snippet is 1.1 KB minified, runs synchronously, fires before any
            other script.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-[var(--color-fg-dim)]">
            <li className="flex items-start gap-2"><Check /> CSP-safe (we ship a nonce-aware variant on Pro)</li>
            <li className="flex items-start gap-2"><Check /> No external dependencies</li>
            <li className="flex items-start gap-2"><Check /> Edge-cached, served from 200+ POPs</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-black p-1 shadow-2xl">
          <div className="flex items-center gap-1.5 px-3 py-2.5">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-[11px] text-[var(--color-fg-muted)] font-mono">theme.liquid</span>
          </div>
          <pre className="px-5 py-5 text-[13px] leading-relaxed font-mono text-[var(--color-fg)] overflow-x-auto">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function ABCallout() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-black p-8 md:p-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-[var(--color-accent-2)] font-semibold">A/B by default</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
              Don&apos;t take our word. Run the test on your own traffic.
            </h2>
            <p className="mt-4 text-[var(--color-fg-dim)] leading-relaxed">
              Every install starts with a 50/50 split. Half your IG visitors are escaped, half see the
              normal IAB. After 7-14 days you have a defensible number — your CVR lift, in your data,
              with your customers. Turn off A/B once you&apos;re satisfied.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-black p-5 font-mono text-[12px]">
            <div className="text-[var(--color-fg-muted)]">Last 14 days · IG-sourced sessions</div>
            <div className="mt-3 grid grid-cols-3 text-[12px]">
              <div className="text-[var(--color-fg-dim)]">Bucket</div>
              <div className="text-[var(--color-fg-dim)]">Sessions</div>
              <div className="text-[var(--color-fg-dim)]">CVR</div>
              <div className="mt-2">A · escape</div>
              <div className="mt-2">12,481</div>
              <div className="mt-2 text-[var(--color-success)]">2.41%</div>
              <div>B · control</div>
              <div>12,506</div>
              <div className="text-[var(--color-danger)]">0.83%</div>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-[var(--color-fg-dim)]">Lift</span>
              <span className="text-[var(--color-success)] font-semibold">+190%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      sub: "Forever. For testing the waters.",
      cta: { label: "Join waitlist", href: "#waitlist" },
      features: [
        "5,000 escapes / month",
        "1 storefront",
        "Daily analytics",
        "Auto-update on patches",
      ],
    },
    {
      name: "Pro",
      price: "$29",
      sub: "/month — for one serious store.",
      featured: true,
      cta: { label: "Join waitlist", href: "#waitlist" },
      features: [
        "100,000 escapes / month",
        "Up to 3 storefronts",
        "Built-in A/B with confidence intervals",
        "Branded fallback overlay (TikTok / Snap / FB)",
        "Webhook to Klaviyo / Triple Whale / Northbeam",
        "Email support",
      ],
    },
    {
      name: "Scale",
      price: "$99",
      sub: "/month — for portfolios & agencies.",
      cta: { label: "Join waitlist", href: "#waitlist" },
      features: [
        "Unlimited escapes",
        "Unlimited storefronts",
        "First-party CNAME serving",
        "CSP nonce variants",
        "Priority Slack support",
        "SLA & DPA",
      ],
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="text-center max-w-2xl mx-auto">
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">Pricing</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          Pays for itself if you make a single extra sale.
        </h2>
        <p className="mt-3 text-[var(--color-fg-dim)]">
          Most stores recover the entire monthly cost in the first 24 hours.
        </p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-4">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-2xl border p-6 flex flex-col ${
              t.featured
                ? "border-[var(--color-accent)]/50 bg-gradient-to-b from-[var(--color-card)] to-black shadow-[0_20px_80px_rgba(91,140,255,0.18)]"
                : "border-[var(--color-border)] bg-[var(--color-card)]"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{t.name}</h3>
              {t.featured ? (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                  Most popular
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">{t.price}</span>
              <span className="text-sm text-[var(--color-fg-dim)]">{t.sub}</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[var(--color-fg-dim)]">
                  <Check /> <span>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href={t.cta.href}
              className={`mt-6 block text-center rounded-xl px-4 py-2.5 font-medium ${
                t.featured ? "bg-white text-black hover:bg-white/90" : "border border-[var(--color-border)] hover:border-white/30"
              }`}
            >
              {t.cta.label}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "Does this violate Instagram's terms?",
      a: "No. We use Instagram's own published deep-link scheme. Major link-in-bio platforms (Linktree, Linkfire, Beacons) use the same technique. No clause in Meta's developer terms or commerce policies prohibits it.",
    },
    {
      q: "What about my Meta pixel and ad attribution?",
      a: "Fully preserved. We encode the entire URL — including fbclid — into the redirect. Meta's pixel dedupes by the _fbp cookie which is first-party on your domain, so the session is treated as continuous, not double-counted.",
    },
    {
      q: "Will it slow my site down?",
      a: "The snippet is ~1.1 KB and runs synchronously before anything else. Lighthouse impact is unmeasurable. If you're on Pro, we also serve from your own CNAME so there's zero cross-origin penalty.",
    },
    {
      q: "What if Instagram patches the technique?",
      a: "We monitor for it actively. The snippet is edge-cached for 5 minutes — when we ship a fix, every customer auto-updates without redeploying. If a fallback is ever the only option, the branded “Open in Safari” overlay still recovers most of the lift.",
    },
    {
      q: "Does it work on TikTok, Snapchat, Facebook?",
      a: "Instagram is the only IAB with a clean auto-escape (on both iOS and Android). For TikTok/Snap/FB, EscapeHatch ships a polished one-tap “Open in Safari” overlay. Not as seamless, but recovers most of the lost conversions.",
    },
    {
      q: "Why pay for this — can't my dev write it in 5 minutes?",
      a: "They can. Then they have to build the dashboard, the A/B framework, the analytics pipeline, the fallback UI, the alerting when IG patches it, the Shopify App Embed, the CSP variants, and the multi-store admin. Or you spend $29 and have it tonight.",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24 border-t border-[var(--color-border)]">
      <div className="text-center">
        <span className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-semibold">FAQ</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          The short answers.
        </h2>
      </div>
      <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map((it) => (
          <details key={it.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <span className="font-medium">{it.q}</span>
              <span className="text-[var(--color-fg-dim)] group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 text-[var(--color-fg-dim)] leading-relaxed">{it.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <h3 className="text-2xl font-semibold tracking-tight">Stop losing IG-sourced sales tonight.</h3>
        <p className="mt-2 text-[var(--color-fg-dim)]">Free tier covers most stores. Install in 60 seconds.</p>
        <a href="#waitlist" className="inline-block mt-5 px-5 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90">
          Get early access
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-12">
      <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-[var(--color-fg-muted)]">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold text-white">{brand.name}</span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#waitlist" className="hover:text-white">Privacy</a>
          <a href="#waitlist" className="hover:text-white">Terms</a>
          <a href="mailto:hi@escapehatch.app" className="hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 mt-0.5 shrink-0 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function X() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 mt-0.5 shrink-0 text-[var(--color-danger)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
