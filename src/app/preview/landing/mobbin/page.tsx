import Link from "next/link";
import { PlatformLogo, type PlatformId } from "@/components/PlatformLogos";

const HERO_PLATFORMS: PlatformId[] = [
  "instagram",
  "facebook",
  "snap",
  "discord",
  "pinterest",
];

const ALL_PLATFORMS: PlatformId[] = [
  "instagram",
  "facebook",
  "messenger",
  "snap",
  "tiktok",
  "discord",
  "pinterest",
  "x",
];

export default function MobbinHomepage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain relative">
      <div aria-hidden className="gradient-dotgrid" />

      {/* ─── Top nav ─── */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <Link href="/preview/landing/mobbin" className="flex items-center gap-2 font-semibold tracking-tight text-[15px]">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            EscapeHatch
          </Link>
          <nav className="flex items-center gap-5 text-[13.5px] text-[var(--color-fg-dim)]">
            <span>Platforms</span>
            <span>Pricing</span>
            <span>Customers</span>
            <span>Docs</span>
            <Link
              href="#waitlist"
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[13px] font-medium press lift focus-ring"
            >
              Start free
              <span className="btn-icon">→</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative pt-20 md:pt-28 pb-16 md:pb-24">
        <div className="mx-auto max-w-6xl px-5">
          {/* Overlapping platform stack */}
          <div className="flex justify-center mb-12">
            <PlatformStack />
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="h-display text-[44px] sm:text-6xl md:text-[80px] tracking-[-0.04em] leading-[0.95]">
              Escape every
              <br />
              <span className="h-editorial text-[var(--color-accent)]">in-app browser.</span>
            </h1>
            <p className="mt-7 max-w-2xl mx-auto text-[16px] md:text-[17px] leading-relaxed text-[var(--color-fg-dim)]">
              Instagram, Facebook, Snap, Discord, Pinterest — every social app opens
              your store inside a stripped-down browser that breaks Apple Pay,
              Shop Pay autofill, and saved carts. EscapeHatch detects the in-app
              browser and reopens your store in Safari before checkout loads.
            </p>

            {/* Email form */}
            <form
              id="waitlist"
              action="/login"
              method="GET"
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@yourstore.com"
                className="h-11 w-full sm:flex-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-4 text-[14px] focus-ring placeholder:text-[var(--color-fg-muted)]"
              />
              <button
                type="submit"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-11 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
                style={{ boxShadow: "var(--shadow-cta)" }}
              >
                Start free
                <span className="btn-icon">→</span>
              </button>
            </form>
            <p className="mt-3 text-[12px] text-[var(--color-fg-muted)]">
              5,000 escapes/mo on free · No credit card · 60-second install
            </p>
          </div>

          {/* Proof tiles */}
          <div className="mt-20 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { v: "+47.2%", l: "Avg checkout lift on bucket A" },
              { v: "$184k", l: "IG-sourced revenue recovered" },
              { v: "1.1 KB", l: "Snippet · edge-cached" },
            ].map((p) => (
              <div
                key={p.l}
                className="text-center px-4 py-5 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]/60"
              >
                <div className="h-display text-2xl md:text-3xl tnum">{p.v}</div>
                <div className="mt-1.5 text-[11px] text-[var(--color-fg-muted)] leading-tight">
                  {p.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── "Works on every IAB" platform grid ─── */}
      <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="text-center mb-12">
            <div className="eyebrow">In-app browsers we escape from</div>
            <h2 className="mt-3 h-display text-[28px] md:text-[40px] tracking-tight">
              Every app. <span className="h-editorial text-[var(--color-fg-dim)]">Detected, escaped, reopened.</span>
            </h2>
            <p className="mt-3 text-[14.5px] text-[var(--color-fg-dim)] max-w-xl mx-auto">
              One snippet works across every social platform — paid clicks from
              any of them get reopened in Safari before checkout.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
            {ALL_PLATFORMS.map((p) => (
              <PlatformCard key={p} id={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="text-center mb-14">
          <div className="eyebrow">How it works</div>
          <h2 className="mt-3 h-display text-[28px] md:text-[40px] tracking-tight">
            One snippet. <span className="h-editorial text-[var(--color-accent)]">Sixty seconds.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              n: "01",
              t: "Detect the in-app browser",
              d: "User taps an Instagram ad. Our snippet runs on first paint and sniffs the user-agent. If it's the IAB, we proceed — otherwise we exit silently.",
            },
            {
              n: "02",
              t: "Fire the deep link",
              d: "We emit an instagram://extbrowser/?url=... deep link. Instagram itself recognizes it and reopens the page in Safari — your customer doesn't see it.",
            },
            {
              n: "03",
              t: "Checkout works",
              d: "Apple Pay, Shop Pay autofill, saved carts — all the things that were broken in the IAB now work. CVR rises. You keep the sale.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-6"
            >
              <div className="text-[11px] font-mono tracking-[0.18em] text-[var(--color-fg-muted)]">{s.n}</div>
              <h3 className="mt-3 h-section text-[18px]">{s.t}</h3>
              <p className="mt-2 text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section className="border-t border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
          <div className="text-center mb-12">
            <div className="eyebrow">Pricing</div>
            <h2 className="mt-3 h-display text-[28px] md:text-[40px] tracking-tight">
              Pay for what works.
            </h2>
            <p className="mt-3 text-[14.5px] text-[var(--color-fg-dim)] max-w-lg mx-auto">
              All plans include the snippet, the A/B test dashboard, and webhook integrations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: "Free", price: "$0", per: "/mo", escapes: "5,000 escapes/mo", desc: "For new merchants validating the lift.", cta: "Start free", hi: false },
              { name: "Pro", price: "$49", per: "/mo", escapes: "50,000 escapes/mo", desc: "For growing brands with serious Meta spend.", cta: "Start free trial", hi: true },
              { name: "Scale", price: "$199", per: "/mo", escapes: "Unlimited escapes", desc: "Multi-store, dedicated support, custom integrations.", cta: "Talk to us", hi: false },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border p-6 flex flex-col ${
                  tier.hi
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-card)]"
                    : "border-[var(--color-border-soft)] bg-[var(--color-card)]/60"
                }`}
                style={tier.hi ? { boxShadow: "var(--shadow-accent)" } : undefined}
              >
                <div className="flex items-baseline justify-between">
                  <div className="h-section text-[16px]">{tier.name}</div>
                  {tier.hi ? (
                    <span className="pill pill-info">RECOMMENDED</span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="h-display text-[40px] tnum">{tier.price}</span>
                  <span className="text-[12px] text-[var(--color-fg-muted)] font-mono">{tier.per}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-[var(--color-fg-dim)] font-mono">{tier.escapes}</div>
                <p className="mt-3 text-[13px] text-[var(--color-fg-dim)] leading-relaxed flex-1">{tier.desc}</p>
                <button
                  className={`mt-5 h-10 rounded-full press lift focus-ring text-[13px] font-medium ${
                    tier.hi
                      ? "bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]"
                      : "border border-[var(--color-border) text-[var(--color-fg)]"
                  }`}
                  style={tier.hi ? { boxShadow: "var(--shadow-cta)" } : undefined}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Closing CTA ─── */}
      <section className="mx-auto max-w-4xl px-5 py-20 md:py-28 text-center">
        <h2 className="h-display text-[36px] md:text-[56px] tracking-tight leading-[1]">
          Stop paying Meta to send <br />
          <span className="h-editorial text-[var(--color-accent)]">traffic to a dead end.</span>
        </h2>
        <p className="mt-5 text-[15px] text-[var(--color-fg-dim)] max-w-lg mx-auto">
          Every paid IG click that lands in the in-app browser is a customer you already paid for. Recover them.
        </p>
        <Link
          href="#waitlist"
          className="mt-8 inline-flex items-center gap-2 px-6 h-12 rounded-full bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[14px] font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Start free · 60-second install
          <span className="btn-icon">→</span>
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[var(--color-border-soft)]">
        <div className="mx-auto max-w-6xl px-5 py-10 flex items-center justify-between text-[12px] text-[var(--color-fg-muted)] font-mono">
          <span>© 2026 EscapeHatch · Built for ecommerce that lives on Meta ads</span>
          <Link href="/preview/dashboard" className="hover:text-[var(--color-fg-dim)]">
            ← dashboard previews
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ─── Overlapping fan of platform icons (the Mobbin move) ─── */

function PlatformStack() {
  // 5 platforms, fanned. Center on top (z), outer ones slightly rotated.
  return (
    <div className="relative h-[160px] sm:h-[180px] flex items-center">
      {HERO_PLATFORMS.map((p, i) => {
        // i = 0..4 → spread from -2 .. +2
        const offset = i - 2;
        const rotation = offset * 6; // -12, -6, 0, 6, 12 deg
        const translateX = offset * 64; // px
        // Center icon on top of the stack
        const zIndex = 10 - Math.abs(offset);
        const ringStyle: React.CSSProperties = {
          transform: `translateX(${translateX}px) rotate(${rotation}deg) translateY(${Math.abs(offset) * 4}px)`,
          zIndex,
        };
        return (
          <div
            key={p}
            className="absolute left-1/2 -ml-[56px] transition-transform"
            style={ringStyle}
          >
            <div
              className="rounded-[26%] p-1"
              style={{
                background: "white",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.7) inset, 0 22px 50px -18px rgba(15,23,42,0.32), 0 0 0 1px rgba(15,23,42,0.05)",
              }}
            >
              <PlatformLogo id={p} size={104} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Single platform card for the grid ─── */

function PlatformCard({ id }: { id: PlatformId }) {
  return (
    <div className="group rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4 flex items-center gap-3 hover:border-[var(--color-accent)]/30 transition-colors">
      <PlatformLogo id={id} size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium tracking-tight capitalize">
          {id === "x" ? "X (Twitter)" : id}
        </div>
        <div className="text-[11px] text-[var(--color-fg-muted)] font-mono mt-0.5">
          IAB · escaped
        </div>
      </div>
      <span className="pill pill-success">ON</span>
    </div>
  );
}
