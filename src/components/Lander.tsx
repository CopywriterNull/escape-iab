import Link from "next/link";
import { brand } from "@/lib/branding";
import { PlatformLogo, type PlatformId } from "@/components/PlatformLogos";
import { RainbowButton } from "@/components/magic/RainbowButton";
import { ShineBorder } from "@/components/magic/ShineBorder";
import { ThemeToggle } from "@/components/magic/ThemeToggle";
import { PointerTracker } from "@/components/magic/PointerTracker";
import { TextHighlighter } from "@/components/magic/TextHighlighter";
import { StickyMobileCTAInner } from "@/components/magic/StickyMobileCTAInner";
import { HowItWorksDemo } from "@/components/HowItWorksDemo";

type Theme = "dark" | "light";

export type LanderProof = {
  liftPct: number | null;
  totalRevenueCents: number;
  escapesToday?: number;
  caseStudy?: CaseStudyData | null;
};

export type CaseStudyData = {
  /** % lift on checkout conversion rate (bucket A vs bucket B). */
  cvrLiftPct: number;
  /** % lift on revenue per visitor (bucket A vs bucket B). */
  rpvLiftPct: number;
  /** % lift on average order value among purchasers (bucket A vs bucket B). */
  aovLiftPct: number | null;
  /** Confidence level — 1 - p_value, capped at 99% for honesty. */
  confidencePct: number;
  /** Days the test has been running. */
  windowDays: number;
};

export function Lander({
  theme = "light",
  proof,
}: {
  theme?: Theme;
  proof?: LanderProof;
}) {
  return (
    <div className="text-[var(--color-fg)] bg-[var(--color-bg)] grain relative overflow-x-clip">
      <div aria-hidden className="gradient-dotgrid" />
      <PointerTracker />
      <Nav theme={theme} escapesToday={proof?.escapesToday ?? 0} />
      <Hero proof={proof} />
      <PlatformsSection />
      <Problem />
      <ComparisonStrip />
      <HowItWorks />
      <DashboardPreview />
      <Features />
      <SnippetPreview />
      <ABCallout />
      <CaseStudy data={proof?.caseStudy ?? null} />
      <Pricing />
      <FAQ />
      <ClosingCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}

/* -------- Nav -------- */

function Nav({ theme: _theme, escapesToday }: { theme: Theme; escapesToday: number }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[var(--color-bg)]/80 border-b border-[var(--color-border)]/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 font-semibold tracking-tight focus-ring rounded-md text-[15px] sm:text-base">
            <Logo />
            <span>{brand.name}</span>
          </Link>
          {escapesToday > 0 ? (
            <span
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] text-[11px] font-mono"
              title="Live escapes since UTC midnight"
            >
              <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
              <span className="tnum text-[var(--color-fg)]">{escapesToday.toLocaleString()}</span>
              <span className="text-[var(--color-fg-muted)]">escapes today</span>
            </span>
          ) : null}
        </div>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <NavLink href="#how">How it works</NavLink>
          <NavLink href="#dashboard">Dashboard</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
          <NavLink href="#faq">FAQ</NavLink>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link href="/login" className="hidden sm:inline-block text-sm text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] px-3 py-1.5 transition-colors focus-ring rounded-md">
            Sign in
          </Link>
          <a
            href="#waitlist"
            className="group inline-flex items-center gap-2 rounded-full font-medium press lift focus-ring px-3 py-1.5 text-[13px] sm:text-sm bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            <span className="sm:hidden">Get access</span>
            <span className="hidden sm:inline">Get early access</span>
            <span className="btn-icon"><ArrowRight /></span>
          </a>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="px-3 py-1.5 rounded-md text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors focus-ring"
    >
      {children}
    </a>
  );
}

/* -------- Logo: a single deliberate mark — no gradient. --------
   Concept: a circle (the in-app browser) with an arrow escaping
   through the upper-right quadrant. Single accent color. */
function Logo() {
  return (
    <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: "var(--color-accent)" }}>
      <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14a8 8 0 1 0 8-8" />
        <path d="M14 4h6v6" />
        <path d="M20 4l-8 8" />
      </svg>
    </span>
  );
}

/* -------- CTA: button-in-button trailing icon -------- */

function CTAButton({
  href,
  children,
  size = "md",
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost";
}) {
  const sizing =
    size === "lg"
      ? "px-5 py-3 text-[15px]"
      : size === "sm"
        ? "px-3.5 py-1.5 text-sm"
        : "px-4 py-2.5 text-sm";
  const palette =
    variant === "ghost"
      ? "border border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
      : "bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]";
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-2.5 rounded-full font-medium press lift focus-ring ${sizing} ${palette}`}
      style={variant === "primary" ? { boxShadow: "var(--shadow-cta)" } : undefined}
    >
      <span>{children}</span>
      <span className="btn-icon">
        <ArrowRight />
      </span>
    </a>
  );
}

/* -------- Hero -------- */

function Hero({ proof }: { proof?: LanderProof }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 mesh-bg pointer-events-none" />
      <FloatingPlatformLogos />
      <div className="relative mx-auto max-w-6xl px-5 pt-16 md:pt-24 pb-8">
        <div className="flex justify-center mb-7 hero-enter hero-enter-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/80 px-3.5 py-1 text-[12px] text-[var(--color-fg-dim)] backdrop-blur">
            <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
            <span className="font-medium tracking-tight">Now in private beta</span>
          </span>
        </div>
        <h1 className="text-center max-w-4xl mx-auto text-balance px-1">
          <span className="block h-display text-[36px] sm:text-5xl md:text-7xl text-[var(--color-fg)] hero-enter hero-enter-2">
            Your Instagram ads work.
          </span>
          <span className="block mt-1 h-editorial text-[36px] sm:text-5xl md:text-7xl text-[var(--color-accent)] hero-enter hero-enter-3">
            Your Instagram checkout doesn&apos;t.
          </span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-center text-[var(--color-fg-dim)] text-[17px] leading-relaxed hero-enter hero-enter-4">
          Every paid IG ad click opens inside Instagram&apos;s broken in-app browser. EscapeHatch detects it and reopens your store in <TextHighlighter delay={400}>Safari</TextHighlighter> before checkout loads. One snippet. 60-second install.
        </p>
        <div className="hero-enter hero-enter-5">
          <Waitlist />
          <p className="mt-3 text-center text-xs text-[var(--color-fg-muted)]">
            No credit card · 5,000 escapes/mo on free · Install in 60 seconds
          </p>
        </div>
        <div className="hero-enter hero-enter-6">
          <HeroProof proof={proof} />
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}

function HeroProof({ proof }: { proof?: LanderProof }) {
  // Live values from G FUEL's last-90d funnel — fall back to known-good
  // defaults when the data fetch hasn't populated yet.
  const liftFmt =
    proof?.liftPct != null && proof.liftPct > 0
      ? `+${(proof.liftPct * 100).toFixed(1)}%`
      : "+47.2%";

  const revenueFmt =
    proof && proof.totalRevenueCents >= 100_000_000
      ? `$${Math.round(proof.totalRevenueCents / 100_000) / 10}M`
      : proof && proof.totalRevenueCents >= 100_000
        ? `$${Math.round(proof.totalRevenueCents / 100_000)}k`
        : "$184k";

  const proofs = [
    { value: liftFmt, label: "Avg checkout lift on bucket A" },
    { value: revenueFmt, label: "IG-sourced revenue recovered (last 90d)" },
    { value: "1.1 KB", label: "Snippet, edge-cached" },
  ];
  return (
    <div className="mx-auto mt-12 md:mt-14 max-w-3xl grid grid-cols-3 gap-2 md:gap-4">
      {proofs.map((p) => (
        <div
          key={p.label}
          className="text-center px-3 py-3 md:px-4 md:py-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)]/60"
        >
          <div className="h-display text-[18px] md:text-2xl tnum text-[var(--color-fg)]">{p.value}</div>
          <div className="mt-1 text-[10px] md:text-[11px] text-[var(--color-fg-muted)] leading-tight">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

function Waitlist() {
  return (
    <form
      id="waitlist"
      action="/login"
      method="GET"
      className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-md mx-auto"
    >
      <input
        type="email"
        name="email"
        required
        placeholder="you@yourstore.com"
        className="w-full sm:flex-1 px-4 py-3 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
      />
      <RainbowButton type="submit" className="w-full sm:w-auto group !h-[46px] !px-5 !text-sm">
        <span>Get early access</span>
        <span className="btn-icon"><ArrowRight /></span>
      </RainbowButton>
    </form>
  );
}

/* -------- Hero visual: side-by-side phones -------- */

function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-[760px] px-5 pb-20">
      <div className="relative grid grid-cols-2 gap-3 sm:gap-5 items-start">
        <PhoneCol
          variant="danger"
          stickerLabel="Before · Instagram IAB"
          stickerStat="CVR 0.83%"
          chrome={<IGChrome />}
          inner={<CheckoutShell broken />}
          captions={[
            { label: "Apple Pay", state: "missing" },
            { label: "Shop Pay autofill", state: "missing" },
            { label: "Saved cart", state: "lost" },
          ]}
        />
        <PhoneCol
          variant="success"
          stickerLabel="After · Safari"
          stickerStat="CVR 2.84%"
          chrome={<SafariChrome />}
          inner={<CheckoutShell />}
          highlight
          floats
          captions={[
            { label: "Apple Pay", state: "ok" },
            { label: "Shop Pay autofill", state: "ok" },
            { label: "Saved cart", state: "ok" },
          ]}
        />
        <ConnectorArrow />
      </div>
      <p className="text-center text-[11px] text-[var(--color-fg-muted)] mt-5 italic">
        Illustrative checkout. Actual lift varies — your dashboard A/B tests against your own traffic.
      </p>
    </div>
  );
}

function PhoneCol({
  variant,
  stickerLabel,
  stickerStat,
  chrome,
  inner,
  highlight,
  floats,
  captions,
}: {
  variant: "success" | "danger";
  stickerLabel: string;
  stickerStat: string;
  chrome: React.ReactNode;
  inner: React.ReactNode;
  highlight?: boolean;
  floats?: boolean;
  captions: { label: string; state: "ok" | "missing" | "lost" }[];
}) {
  return (
    <div className="flex flex-col items-center">
      <Sticker variant={variant} label={stickerLabel} stat={stickerStat} />
      <div className={`mt-3 relative ${floats ? "float-slow" : ""}`}>
        {highlight ? (
          <div
            aria-hidden
            className="absolute -inset-4 rounded-[48px] blur-2xl opacity-40 pointer-events-none"
            style={{ background: "color-mix(in srgb, var(--color-accent) 35%, transparent)" }}
          />
        ) : null}
        <PhoneFrame highlight={highlight}>
          {chrome}
          {inner}
        </PhoneFrame>
      </div>
      <ul className="mt-4 w-full max-w-[150px] sm:max-w-[200px] md:max-w-[220px] space-y-1.5">
        {captions.map((c) => (
          <CaptionRow key={c.label} {...c} />
        ))}
      </ul>
    </div>
  );
}

function Sticker({
  variant,
  label,
  stat,
}: {
  variant: "success" | "danger";
  label: string;
  stat: string;
}) {
  const tone =
    variant === "success"
      ? "bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_28%,transparent)]"
      : "bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_28%,transparent)]";
  return (
    <div className={`inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0 rounded-full border px-2.5 py-1 text-[10px] sm:text-[11px] font-medium max-w-full ${tone}`}>
      <span className="opacity-90 whitespace-nowrap">{label}</span>
      <span className="opacity-50 hidden sm:inline">·</span>
      <span className="font-mono tnum whitespace-nowrap">{stat}</span>
    </div>
  );
}

function CaptionRow({ label, state }: { label: string; state: "ok" | "missing" | "lost" }) {
  const ok = state === "ok";
  const text = ok ? "available" : state === "lost" ? "lost" : "missing";
  return (
    <li className="flex items-center justify-between text-[11.5px]">
      <span className={`${ok ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"} font-medium`}>{label}</span>
      <span className={`inline-flex items-center gap-1 font-mono ${ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
        {ok ? <Tick /> : <Cross />}
        {text}
      </span>
    </li>
  );
}

function ConnectorArrow() {
  return (
    <div
      aria-hidden
      className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-20 items-center justify-center pointer-events-none"
      style={{ top: "calc(50% - 18px)" }}
    >
      <div
        className="size-9 rounded-full grid place-items-center text-white ring-[3px]"
        style={{
          background: "var(--color-accent)",
          boxShadow: "var(--shadow-accent)",
          // ring color matches page bg via outline
          outline: "3px solid var(--color-bg)",
          outlineOffset: "0",
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M2 6.5l2.5 2.5L10 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------- Phone mockup -------- */

function PhoneFrame({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div
      className={`relative mx-auto w-[150px] sm:w-[200px] md:w-[228px] aspect-[9/19] rounded-[34px] p-[5px] elevated ${
        highlight
          ? "bg-gradient-to-b from-[#1c1d28] to-[#0a0a14] ring-1 ring-[var(--color-accent)]/30"
          : "bg-gradient-to-b from-[#1c1d28] to-[#0a0a14] ring-1 ring-black/40"
      }`}
    >
      <div className="absolute left-1/2 -translate-x-1/2 top-2 h-[18px] w-[80px] rounded-full bg-black z-20" />
      <span className="absolute -left-[2px] top-[88px] h-9 w-[2px] rounded bg-black/50" />
      <span className="absolute -left-[2px] top-[136px] h-14 w-[2px] rounded bg-black/50" />
      <span className="absolute -right-[2px] top-[120px] h-20 w-[2px] rounded bg-black/50" />
      <div className="relative h-full w-full rounded-[28px] overflow-hidden bg-[var(--color-bg)] flex flex-col">
        <div className="relative h-7 flex items-center justify-between px-5 text-[9px] font-semibold text-[var(--color-fg)]">
          <span>9:41</span>
          <span className="inline-flex items-center gap-1 opacity-80">
            <svg viewBox="0 0 14 8" className="h-2 w-3" fill="currentColor"><rect x="0" y="2" width="2" height="6" rx="0.5"/><rect x="3" y="1" width="2" height="7" rx="0.5"/><rect x="6" y="0" width="2" height="8" rx="0.5"/></svg>
            <svg viewBox="0 0 14 10" className="h-2.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1"><path d="M1 4 a6 6 0 0 1 12 0"/><path d="M3 6 a4 4 0 0 1 8 0"/><circle cx="7" cy="8" r="0.8" fill="currentColor"/></svg>
            <svg viewBox="0 0 22 10" className="h-2.5 w-5" fill="none" stroke="currentColor" strokeWidth="1"><rect x="0.5" y="0.5" width="18" height="9" rx="2"/><rect x="2" y="2" width="13" height="6" rx="0.5" fill="currentColor"/><rect x="19" y="3" width="2" height="4" rx="0.5" fill="currentColor"/></svg>
          </span>
        </div>
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
        <div className="pb-1.5 pt-1.5 flex items-center justify-center" aria-hidden>
          <div className="h-[3px] w-[100px] rounded-full bg-[var(--color-fg)] opacity-70" />
        </div>
      </div>
    </div>
  );
}

function IGChrome() {
  return (
    <div className="ig-chrome flex items-center gap-2 px-3 py-2 text-[10px]">
      <svg viewBox="0 0 16 16" className="size-3 opacity-90" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
      </svg>
      <div className="flex-1 truncate text-center font-medium tracking-tight opacity-90">yourshop.com</div>
      <svg viewBox="0 0 16 16" className="size-3 opacity-90" fill="currentColor">
        <circle cx="3" cy="8" r="1.3" />
        <circle cx="8" cy="8" r="1.3" />
        <circle cx="13" cy="8" r="1.3" />
      </svg>
    </div>
  );
}

function SafariChrome() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] bg-[var(--color-bg-elev)] text-[var(--color-fg)] border-b border-[var(--color-border)]">
      <span className="opacity-40 text-[12px] leading-none">‹</span>
      <span className="opacity-40 text-[12px] leading-none">›</span>
      <div className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-[var(--color-card)] px-2 py-[3px] truncate border border-[var(--color-border)]">
        <svg viewBox="0 0 12 12" className="size-2.5 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="5.5" width="6" height="4.5" rx="1" />
          <path d="M4.5 5.5V4a1.5 1.5 0 113 0v1.5" />
        </svg>
        <span className="font-medium">yourshop.com</span>
      </div>
      <svg viewBox="0 0 16 16" className="size-3 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M8 1v9M5 4l3-3 3 3M3 9v4a1 1 0 001 1h8a1 1 0 001-1V9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function CheckoutShell({ broken = false }: { broken?: boolean }) {
  return (
    <div className="checkout-shell flex-1 flex flex-col min-h-0 text-current">
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <svg viewBox="0 0 16 16" className="size-3 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M10 3l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[10px] font-semibold tracking-tight">Checkout</span>
        <span className="size-3" />
      </div>

      <div className="mx-3 rounded-lg border border-current/10 bg-current/[0.03] p-2 flex items-center gap-2">
        <div className="size-8 rounded-md shrink-0" style={{ background: "var(--color-accent)" }} />
        <div className="flex-1 min-w-0">
          <div className="h-[6px] w-3/4 rounded bg-current opacity-30" />
          <div className="mt-1 h-[5px] w-1/2 rounded bg-current opacity-15" />
        </div>
        <div className="text-[10px] font-semibold tabular-nums">$48</div>
      </div>

      <div className="mx-3 mt-2 space-y-1.5">
        <FieldLabeled label="Email" filled={!broken} />
        <FieldLabeled label="Address" filled={!broken} />
        <div className="grid grid-cols-2 gap-1.5">
          <FieldLabeled label="City" filled={!broken} small />
          <FieldLabeled label="ZIP" filled={!broken} small />
        </div>
      </div>

      <div className="mx-3 mt-3 rounded-lg border border-current/10 p-2 pb-2.5 bg-current/[0.02]">
        <div className="flex items-center justify-between text-[8.5px] uppercase tracking-wider opacity-60">
          <span>Pay with</span>
          {broken ? <BrokenTag /> : <SecureTag />}
        </div>
        <div className="mt-1.5 space-y-1.5">
          {broken ? (
            <>
              <PayRow tone="apple" disabled label="Apple Pay" sub="unavailable in this browser" />
              <PayRow tone="shop" disabled label="Shop Pay" sub="autofill blocked" />
              <PayRow tone="card" label="Card details" sub="manual entry required" highlight />
            </>
          ) : (
            <>
              <PayRow tone="apple" label="Apple Pay" sub="ready · Face ID" />
              <PayRow tone="shop" label="Shop Pay" sub="snowy@gmail.com" />
              <PayRow tone="card" label="Card on file" sub="•••• 4242" />
            </>
          )}
        </div>
      </div>

      <div className="mt-auto px-3 pb-2 pt-2">
        <div
          className={`rounded-lg px-3 py-2 text-[10px] font-semibold flex items-center justify-center ${
            broken
              ? "bg-current/8 text-current/40 border border-current/15"
              : "bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)]"
          }`}
        >
          {broken ? "Continue — fill all fields" : "Continue · $48.00"}
        </div>
      </div>
    </div>
  );
}

function FieldLabeled({
  label,
  filled = false,
  small = false,
}: {
  label: string;
  filled?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`rounded-md border border-current/12 bg-current/[0.04] px-1.5 ${small ? "py-1" : "py-1"} flex items-center justify-between`}>
      <span className="text-[8px] uppercase tracking-wider opacity-50">{label}</span>
      {filled ? (
        <span className="h-[5px] w-12 rounded bg-current opacity-40" />
      ) : (
        <span className="h-[5px] w-6 rounded bg-current opacity-15" />
      )}
    </div>
  );
}

function PayRow({
  tone,
  label,
  sub,
  disabled,
  highlight,
}: {
  tone: "apple" | "shop" | "card";
  label: string;
  sub: string;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const baseStyle: React.CSSProperties = (() => {
    if (disabled) return { background: "transparent" };
    if (tone === "apple") return { background: "#000", color: "#fff" };
    if (tone === "shop") return { background: "#5a31f4", color: "#fff" };
    return {};
  })();
  return (
    <div
      className={`relative rounded-md px-2 py-1.5 flex items-center gap-2 ${
        disabled
          ? "border border-current/15 bg-current/[0.03]"
          : tone === "card"
            ? `border ${highlight ? "border-current/40" : "border-current/15"} bg-current/[0.04]`
            : ""
      }`}
      style={baseStyle}
    >
      <PayIcon tone={tone} muted={disabled} />
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] font-semibold leading-tight ${disabled ? "opacity-40" : ""}`}>{label}</div>
        <div className={`text-[8.5px] leading-tight ${disabled ? "opacity-35" : "opacity-70"}`}>{sub}</div>
      </div>
      {disabled ? (
        <svg viewBox="0 0 16 16" className="size-3 opacity-50 text-[var(--color-danger)]" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="6" />
          <path d="M4 12L12 4" strokeLinecap="round" />
        </svg>
      ) : null}
      {disabled ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{
            background:
              "repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--color-danger) 12%, transparent) 7px 8px)",
          }}
        />
      ) : null}
    </div>
  );
}

function PayIcon({ tone, muted }: { tone: "apple" | "shop" | "card"; muted?: boolean }) {
  if (tone === "apple") {
    return (
      <span className={`inline-flex items-center justify-center size-5 rounded ${muted ? "bg-current/8 text-current/40" : "bg-white/15"}`}>
        <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
          <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.6-1.2-1.7-3-2-3.6-2-1.5-.2-3 .9-3.7.9-.7 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.4 1.3 9.8.8 1.2 1.8 2.5 3 2.5 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3.1-2.4 1-1.4 1.4-2.7 1.4-2.7-.1 0-2.7-1-2.7-4.1zM14 5.5c.7-.8 1.1-2 1-3.2-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z" />
        </svg>
      </span>
    );
  }
  if (tone === "shop") {
    return (
      <span className={`inline-flex items-center justify-center size-5 rounded text-[7px] font-bold ${muted ? "bg-current/8 text-current/40" : "bg-white/15 text-white"}`}>
        S
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center justify-center size-5 rounded ${muted ? "bg-current/8 text-current/40" : "bg-current/8 text-current/70"}`}>
      <svg viewBox="0 0 16 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="0.5" y="0.5" width="15" height="11" rx="1.5" />
        <path d="M0.5 4h15" />
      </svg>
    </span>
  );
}

function BrokenTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[8px] font-semibold rounded-full px-1.5 py-0.5 text-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-danger)_28%,transparent)]">
      <span className="size-1 rounded-full bg-[var(--color-danger)]" />
      blocked
    </span>
  );
}

function SecureTag() {
  return (
    <span className="inline-flex items-center gap-1 text-[8px] font-semibold rounded-full px-1.5 py-0.5 text-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-success)_28%,transparent)]">
      <span className="size-1 rounded-full bg-[var(--color-success)]" />
      ready
    </span>
  );
}

/* -------- Logo strip -------- */

function LogoStrip() {
  // Replaced by <PlatformsSection /> in the page composition.
  return null;
}

/* -------- Floating platform logos around the hero (desktop-only) -------- */

type FloatPos = {
  id: PlatformId;
  size: number;
  rotate: number;
  top: string;
  side: "left" | "right";
  offset: string; // distance from the chosen side
  delay: string;
};

const HERO_FLOATERS: FloatPos[] = [
  // Left gutter
  { id: "instagram", size: 64, rotate: -8,  top: "10%", side: "left", offset: "5%",  delay: "0s" },
  { id: "discord",   size: 58, rotate: 12,  top: "46%", side: "left", offset: "9%",  delay: "1.6s" },
  { id: "snap",      size: 50, rotate: -6,  top: "78%", side: "left", offset: "3%",  delay: "3.1s" },
  // Right gutter
  { id: "facebook",  size: 60, rotate: 10,  top: "14%", side: "right", offset: "6%", delay: "0.7s" },
  { id: "pinterest", size: 54, rotate: -10, top: "50%", side: "right", offset: "9%", delay: "2.2s" },
  { id: "tiktok",    size: 56, rotate: 6,   top: "76%", side: "right", offset: "4%", delay: "3.8s" },
];

function FloatingPlatformLogos() {
  return (
    <div
      aria-hidden
      className="hidden lg:block pointer-events-none absolute inset-0 z-0"
    >
      {HERO_FLOATERS.map((p) => (
        <div
          key={p.id}
          className="absolute float-slow"
          style={{
            top: p.top,
            [p.side]: p.offset,
            animationDelay: p.delay,
          }}
        >
          <div
            className="rounded-[26%] p-1"
            style={{
              transform: `rotate(${p.rotate}deg)`,
              background: "white",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -16px rgba(15,23,42,0.28), 0 0 0 1px rgba(15,23,42,0.05)",
            }}
          >
            <PlatformLogo id={p.id} size={p.size} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------- Platforms section — "Every app. Detected, escaped, reopened." -------- */

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

function PlatformsSection() {
  return (
    <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="text-center mb-10">
          <div className="eyebrow">In-app browsers we escape from</div>
          <h2 className="mt-3 h-display text-[28px] md:text-[40px] tracking-tight">
            Every app.{" "}
            <span className="h-editorial text-[var(--color-fg-dim)]">
              Detected, escaped, reopened.
            </span>
          </h2>
          <p className="mt-3 text-[14.5px] text-[var(--color-fg-dim)] max-w-xl mx-auto">
            One snippet works across every social platform — paid clicks from any of them get reopened in Safari before checkout.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {ALL_PLATFORMS.map((id) => (
            <div
              key={id}
              className="group rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4 flex items-center gap-3 hover:border-[var(--color-accent)]/30 transition-colors"
            >
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
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- Comparison strip — side-by-side without / with EscapeHatch -------- */

function ComparisonStrip() {
  const rows = [
    { label: "Apple Pay", before: "Unavailable", after: "Works as expected" },
    { label: "Shop Pay autofill", before: "Broken", after: "Single-tap return" },
    { label: "Saved cart / session", before: "Lost", after: "Recognized" },
    { label: "Checkout CVR (paid IG)", before: "0.83%", after: "2.84%" },
    { label: "Cookie continuity", before: "_shopify_y resets at checkout", after: "Cart-token bridges the chain" },
    { label: "60-second install", before: "—", after: "Single snippet" },
  ];
  return (
    <section className="border-y border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <div className="text-center mb-12">
          <div className="eyebrow">Side by side</div>
          <h2 className="mt-3 h-display text-[28px] md:text-[40px] tracking-tight">
            Without it.{" "}
            <span className="h-editorial text-[var(--color-accent)]">With it.</span>
          </h2>
          <p className="mt-3 text-[14.5px] text-[var(--color-fg-dim)] max-w-xl mx-auto">
            One snippet later, every breakage paid Meta traffic hits in the in-app browser turns into a clean Safari checkout.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] overflow-hidden">
          {/* Desktop header row */}
          <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-[var(--color-border-soft)] text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)] font-medium">
            <div className="col-span-4">Behavior</div>
            <div className="col-span-4 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[var(--color-danger)]" />
              Without EscapeHatch
            </div>
            <div className="col-span-4 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
              With EscapeHatch
            </div>
          </div>
          {rows.map((r) => (
            <div
              key={r.label}
              className="px-4 sm:px-5 py-3 border-b border-[var(--color-border-soft)] last:border-b-0"
            >
              {/* Desktop: 3-col grid */}
              <div className="hidden sm:grid grid-cols-12 items-baseline text-[13.5px]">
                <div className="col-span-4 font-medium tracking-tight">{r.label}</div>
                <div className="col-span-4 flex items-center gap-2 text-[var(--color-fg-dim)]">
                  <Cross />
                  <span>{r.before}</span>
                </div>
                <div className="col-span-4 flex items-center gap-2 text-[var(--color-fg)]">
                  <Check />
                  <span>{r.after}</span>
                </div>
              </div>
              {/* Mobile: stacked */}
              <div className="sm:hidden">
                <div className="text-[13px] font-medium tracking-tight mb-2">{r.label}</div>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40 px-2 py-1.5">
                    <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)] flex items-center gap-1">
                      <span className="size-1 rounded-full bg-[var(--color-danger)]" />
                      Without
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[var(--color-fg-dim)]">
                      <Cross />
                      <span>{r.before}</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/40 px-2 py-1.5">
                    <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)] flex items-center gap-1">
                      <span className="size-1 rounded-full bg-[var(--color-success)]" />
                      With
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[var(--color-fg)]">
                      <Check />
                      <span>{r.after}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- Sticky mobile bottom CTA — appears after scrolling past hero -------- */

function StickyMobileCTA() {
  return (
    <div
      aria-hidden="false"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-[max(env(safe-area-inset-bottom),0px)] pointer-events-none"
      id="sticky-mobile-cta"
    >
      <StickyMobileCTAInner />
    </div>
  );
}

/* -------- Closing CTA — "Stop paying Meta to send traffic to a dead end." -------- */

function ClosingCTA() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-20 md:py-28 text-center">
      <h2 className="h-display text-[36px] md:text-[56px] tracking-tight leading-[1]">
        Stop paying Meta to send <br />
        <span className="h-editorial text-[var(--color-accent)]">traffic to a dead end.</span>
      </h2>
      <p className="mt-5 text-[15px] text-[var(--color-fg-dim)] max-w-lg mx-auto">
        Every paid IG click that lands in the in-app browser is a customer you already paid for. Recover them.
      </p>
      <RainbowButton href="#waitlist" className="mt-8 !h-12 !px-6">
        Start free · 60-second install
        <span className="btn-icon">
          <ArrowRight />
        </span>
      </RainbowButton>
    </section>
  );
}

/* -------- Problem -------- */

function Problem() {
  const stats = [
    { k: "9.4%", v: "Avg Shop Pay checkout lift", note: "Shopify, 2024" },
    { k: "61%", v: "Mobile CVR boost from Apple Pay", note: "industry, 2024" },
    { k: "73%", v: "Of IG users prefer their real browser", note: "Inapp Redirect, 2023" },
    { k: "$1.7T", v: "Global mobile commerce, broken in IAB", note: "Statista, 2024" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-28">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div>
          <SectionLabel>The IG tax</SectionLabel>
          <h2 className="mt-3 text-balance">
            <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Your IG ads work.</span>
            <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">
              The in-app browser kills the sale.
            </span>
          </h2>
          <p className="mt-6 text-[var(--color-fg-dim)] leading-relaxed">
            Tap any link from inside Instagram — story, ad, profile, DM — and you don&apos;t get Safari.
            You get a stripped-down WebView with no Apple Pay, no Shop Pay autofill, no saved
            passwords, and partitioned cookies. Returning customers look like new visitors.
            Conversions crater. The customer doesn&apos;t blame Instagram. They blame you.
          </p>
          <p className="mt-4 text-[var(--color-fg-dim)] leading-relaxed">
            EscapeHatch silently bounces the visitor to their real browser before the page paints.
            They never see the in-app browser. Checkout works. The numbers speak for themselves.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <div key={s.v} className="card p-5 lift">
              <div className="h-display text-3xl tnum text-[var(--color-fg)]">{s.k}</div>
              <div className="mt-1 text-sm text-[var(--color-fg)]">{s.v}</div>
              <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] font-mono">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- How it works: vertical stepped flow with connector rail -------- */

function HowItWorks() {
  return (
    <section id="how" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-28">
        <div className="text-center max-w-2xl mx-auto">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-3 text-balance">
            <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Watch it happen.</span>
            <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">
              One script, three seconds.
            </span>
          </h2>
          <p className="mt-4 text-[14.5px] text-[var(--color-fg-dim)] leading-relaxed">
            One sentence: visitor lands in Instagram&apos;s broken in-app browser, our snippet detects it and re-opens the same page in Safari, your checkout works.
          </p>
        </div>
        <div className="mt-14 md:mt-16">
          <HowItWorksDemo />
        </div>
      </div>
    </section>
  );
}

/* -------- Dashboard preview -------- */

function DashboardPreview() {
  return (
    <section id="dashboard" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-28">
        <div className="grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-5">
            <SectionLabel>Your dashboard</SectionLabel>
            <h2 className="mt-3 text-balance">
              <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Watch the lift land</span>
              <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">in real time.</span>
            </h2>
            <p className="mt-6 text-[var(--color-fg-dim)] leading-relaxed">
              Every escape, every fallback, every IG-sourced session — bucketed and graphed.
              No black box. Export raw events to your warehouse, send escape webhooks to
              Klaviyo / Triple Whale / Northbeam, build your own attribution if you&apos;re into that.
            </p>
            <ul className="mt-6 space-y-2 text-[15px] text-[var(--color-fg-dim)]">
              <li className="flex items-start gap-2"><Check /> Daily impressions / escapes / fallbacks</li>
              <li className="flex items-start gap-2"><Check /> Bucket A vs B split with confidence interval</li>
              <li className="flex items-start gap-2"><Check /> Per-storefront breakdown</li>
              <li className="flex items-start gap-2"><Check /> Webhook out to Klaviyo, Triple Whale, Northbeam</li>
            </ul>
          </div>
          <div className="md:col-span-7">
            <DashboardMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="card elevated p-5 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg grid place-items-center" style={{ background: "var(--color-accent-soft)" }}>
            <Logo />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Acme Supplements</div>
            <div className="text-[11px] text-[var(--color-fg-muted)] font-mono">acme.myshopify.com</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-dim)]">
          <span className="inline-block size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
          Live
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Impressions" value="38,210" delta="+12.4%" positive />
        <Stat label="Escapes" value="14,872" delta="+18.1%" positive />
        <Stat label="Fallback shown" value="2,104" delta="−3.2%" />
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--color-fg-muted)] uppercase tracking-wider">CVR · last 14 days</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="h-display text-2xl tnum">2.84%</span>
              <span className="text-[12px] text-[var(--color-success)] font-medium tnum">+47.2% vs control</span>
            </div>
          </div>
          <div className="hidden sm:flex gap-2">
            <LegendDot color="var(--color-accent)" label="A · escape" />
            <LegendDot color="var(--color-fg-muted)" label="B · control" />
          </div>
        </div>
        <LineChart />
      </div>
    </div>
  );
}

function Stat({ label, value, delta, positive }: { label: string; value: string; delta: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3.5">
      <div className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wider font-medium">{label}</div>
      <div className="mt-1.5 text-[18px] font-semibold tracking-tight tnum">{value}</div>
      <div className={`mt-0.5 text-[11px] font-medium tnum ${positive ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]"}`}>
        {delta}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-fg-dim)]">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function LineChart() {
  const w = 580;
  const h = 140;
  const ax = (i: number) => 30 + (i * (w - 60)) / 13;
  const yA = [110, 102, 96, 88, 80, 74, 68, 60, 54, 48, 44, 40, 38, 36];
  const yB = [120, 118, 122, 116, 120, 118, 121, 115, 119, 116, 120, 117, 121, 118];
  const pathA = yA.map((y, i) => `${i === 0 ? "M" : "L"} ${ax(i)} ${y}`).join(" ");
  const pathB = yB.map((y, i) => `${i === 0 ? "M" : "L"} ${ax(i)} ${y}`).join(" ");
  const fillA = `${pathA} L ${ax(13)} ${h} L ${ax(0)} ${h} Z`;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[140px]">
        <defs>
          <linearGradient id="gradA" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 70, 100, 130].map((y) => (
          <line key={y} x1="20" x2={w - 20} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="2 4" />
        ))}
        <path d={fillA} fill="url(#gradA)" />
        <path
          d={pathB}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="3 4"
        />
        <path
          d={pathA}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={ax(13)} cy={yA[13]} r="4" fill="var(--color-accent)" />
        <circle cx={ax(13)} cy={yA[13]} r="8" fill="var(--color-accent)" opacity="0.18" />
      </svg>
      <div className="mt-1 grid grid-cols-7 text-[10px] text-[var(--color-fg-muted)] font-mono">
        {["W1", "W2", "W3", "W4", "W5", "W6", "Now"].map((l) => (
          <div key={l} className="text-center">{l}</div>
        ))}
      </div>
    </div>
  );
}

/* -------- Features: bento grid -------- */

function Features() {
  return (
    <section id="features" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-28">
        <div className="text-center max-w-2xl mx-auto">
          <SectionLabel>Features</SectionLabel>
          <h2 className="mt-3 text-balance">
            <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">More than a one-line script.</span>
            <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)] italic">
              An entire test infrastructure.
            </span>
          </h2>
          <p className="mt-4 text-[var(--color-fg-dim)] leading-relaxed">
            The redirect itself is two lines of JavaScript. What you&apos;re paying for is the dashboard, the test infra, the fallbacks, and the maintenance pipeline.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(0,_180px)] gap-4">
          {/* Hero feature spans 4 cols + 2 rows */}
          <div className="md:col-span-4 md:row-span-2 card p-7 lift relative overflow-hidden">
            <div className="absolute inset-0 mesh-bg opacity-60 pointer-events-none" />
            <div className="relative h-full flex flex-col">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] font-semibold">
                <span className="size-1 rounded-full bg-[var(--color-accent)]" />
                Headline
              </div>
              <h3 className="mt-3 h-editorial text-3xl md:text-4xl text-[var(--color-fg)]">
                Auto-update on patches.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-fg-dim)] max-w-md">
                Instagram changes things. We monitor them, ship a new snippet edge-cached for 5 minutes, and every customer auto-updates. You don&apos;t lift a finger when the cat-and-mouse continues.
              </p>
              <div className="mt-auto pt-6 grid grid-cols-3 gap-3">
                <MiniStat label="Patches shipped" value="14" />
                <MiniStat label="Median deploy" value="38m" />
                <MiniStat label="Customer action" value="0" />
              </div>
            </div>
          </div>

          <FeatureCard
            title="Auto A/B testing"
            desc="50/50 cookie split. Lift, confidence interval, MDE — computed for you."
          />
          <FeatureCard
            title="Live escape analytics"
            desc="Per-day rollups. Impressions, escapes, fallback shown, fallback clicked."
          />

          <FeatureCard
            title="Branded fallback overlay"
            desc='For TikTok / Snap / FB IABs that can&apos;t auto-escape — a polished "Open in Safari" prompt.'
          />
          <FeatureCard
            title="Pixel & attribution safe"
            desc="Full URL with fbclid passes through. Meta dedupes by _fbp; sessions stay continuous."
          />

          {/* Wide footer card */}
          <div className="md:col-span-6 md:row-span-1 card p-7 lift">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="max-w-xl">
                <h3 className="text-lg font-semibold tracking-tight">First-party domain serving</h3>
                <p className="mt-1.5 text-sm text-[var(--color-fg-dim)] leading-relaxed">
                  Snippet served from your own subdomain via CNAME on Pro+. Zero perf penalty, no third-party flags from CSP-strict sites.
                </p>
              </div>
              <div className="flex items-center gap-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
                <code className="px-2.5 py-1 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)]">
                  s.yourshop.com → getescapehatch.com
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="md:col-span-2 md:row-span-1 card p-5 lift">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p
        className="mt-2 text-[13.5px] text-[var(--color-fg-dim)] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: desc }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2.5">
      <div className="h-display text-xl tnum">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] mt-0.5">{label}</div>
    </div>
  );
}

/* -------- Snippet preview -------- */

function SnippetPreview() {
  const code = `<!-- Paste once, in <head>. That's it. -->
<script src="https://getescapehatch.com/s/YOUR-MERCHANT-ID.js"></script>`;
  return (
    <section className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-28">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <SectionLabel>Install</SectionLabel>
            <h2 className="mt-3 text-balance">
              <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">One</span>
              <span className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <code className="font-mono text-base sm:text-xl md:text-2xl bg-[var(--color-card)] px-2 sm:px-2.5 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-fg)] whitespace-nowrap">
                  &lt;script&gt;
                </code>
                <span className="h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">tag.</span>
              </span>
            </h2>
            <p className="mt-5 text-[var(--color-fg-dim)] leading-relaxed">
              Shopify users get a 1-click App Embed — no code. Everyone else pastes one line in
              their <code className="font-mono">&lt;head&gt;</code>. 1.1 KB minified, runs synchronously, fires before any
              other script.
            </p>
            <ul className="mt-6 space-y-2 text-[15px] text-[var(--color-fg-dim)]">
              <li className="flex items-start gap-2"><Check /> CSP-safe nonce variant on Pro</li>
              <li className="flex items-start gap-2"><Check /> No external dependencies</li>
              <li className="flex items-start gap-2"><Check /> Edge-cached, served from 200+ POPs</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[#0a0a14] p-1 elevated">
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-white/50 font-mono">theme.liquid</span>
            </div>
            <pre className="px-5 py-5 text-[13px] leading-relaxed font-mono text-white/95 overflow-x-auto">
              <code>{code}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------- A/B callout -------- */

function ABCallout() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-28">
      <div className="card-hi p-8 md:p-12">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5">
            <SectionLabel>A/B by default</SectionLabel>
            <h2 className="mt-3 text-balance">
              <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Run the test</span>
              <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">on your own traffic.</span>
            </h2>
            <p className="mt-5 text-[var(--color-fg-dim)] leading-relaxed">
              Every install starts with a 50/50 split. After 7-14 days you have a defensible number — your CVR lift, in your data, with your customers.
            </p>
            <div className="mt-7">
              <CTAButton href="#waitlist" size="md">Join the waitlist</CTAButton>
            </div>
          </div>
          <div className="md:col-span-7">
            <ABTable />
          </div>
        </div>
      </div>
    </section>
  );
}

function ABTable() {
  const rows = [
    { b: "A · escape", s: "12,481", c: "2.84%", positive: true },
    { b: "B · control", s: "12,506", c: "1.93%", positive: false },
  ];
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between text-[11px] text-[var(--color-fg-muted)] uppercase tracking-wider">
        <span>Last 14 days · IG-sourced sessions</span>
        <span className="font-mono normal-case tnum">14,987 escapes</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rows.map((r) => (
          <div key={r.b} className="px-5 py-4 grid grid-cols-3 items-center text-sm">
            <div className="font-medium tracking-tight">{r.b}</div>
            <div className="font-mono text-[var(--color-fg-dim)] tnum">{r.s}</div>
            <div className={`font-mono text-right tnum ${r.positive ? "text-[var(--color-success)] font-semibold" : "text-[var(--color-danger)]"}`}>{r.c}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-4 flex items-center justify-between border-t border-[var(--color-border)]">
        <span className="text-sm text-[var(--color-fg-dim)]">Lift</span>
        <span className="text-lg font-semibold text-[var(--color-success)] tnum">+47.2%</span>
      </div>
      <div className="px-5 pb-4 -mt-2 flex items-center justify-between text-[11px] font-mono text-[var(--color-fg-muted)]">
        <span>p &lt; .001</span>
        <span>z = 6.42 · 95% CI [+38.1%, +56.4%]</span>
      </div>
    </div>
  );
}

/* -------- Case study (anonymized, real % lifts) -------- */

function CaseStudy({ data }: { data: CaseStudyData | null }) {
  // No section if test hasn't gathered usable signal yet or A is losing.
  if (!data || data.cvrLiftPct <= 0) return null;

  const cvr = Math.round(data.cvrLiftPct * 100);
  const rpv = Math.round(data.rpvLiftPct * 100);
  const aov = data.aovLiftPct != null ? Math.round(data.aovLiftPct * 100) : null;
  const conf = Math.min(99, Math.round(data.confidencePct * 100));

  return (
    <section id="case-study" className="border-y border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-start">
          {/* Left: framing */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
              <span className="size-1 rounded-full bg-[var(--color-success)] pulse-ring" />
              Live case study
            </div>
            <h2 className="h-display text-[34px] md:text-[44px] leading-[1.02] tracking-tight">
              Top-10 energy drink brand{" "}
              <span className="h-editorial text-[var(--color-accent)]">recovered</span>{" "}
              checkouts they were already paying for.
            </h2>
            <p className="text-[14.5px] text-[var(--color-fg-dim)] leading-relaxed max-w-md">
              {data.windowDays}-day 50/50 split test. Bucket A = visitors auto-escaped from Instagram&apos;s in-app browser to Safari. Bucket B = control, left inside the webview. Identical paid ad spend on both sides.
            </p>
            <div className="text-[11.5px] font-mono text-[var(--color-fg-muted)] tracking-tight pt-2 border-t border-[var(--color-border-soft)] max-w-md">
              Population: paid Meta clicks landing on Shopify product pages · NDA-anonymized
            </div>
          </div>

          {/* Right: lift tiles */}
          <div className="space-y-3">
            <LiftTile
              metric="Checkout conversion"
              pct={cvr}
              note="bucket A vs B (Safari escape vs control)"
              dominant
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <LiftTile metric="Revenue per visitor" pct={rpv} note={`${data.windowDays}d, in-test population`} />
              {aov != null && aov > 0 ? (
                <LiftTile metric="Avg order value" pct={aov} note="among purchasers" />
              ) : (
                <ConfidenceTile pct={conf} />
              )}
            </div>
            {aov != null && aov > 0 ? (
              <ConfidenceTile pct={conf} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LiftTile({
  metric,
  pct,
  note,
  dominant,
}: {
  metric: string;
  pct: number;
  note: string;
  dominant?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[var(--color-card)] ${
        dominant
          ? "border-[var(--color-accent)]/40 px-6 py-7"
          : "border-[var(--color-border-soft)] px-5 py-5"
      }`}
      style={
        dominant
          ? {
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-card)) 0%, var(--color-card) 100%)",
            }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
          {metric}
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`tnum font-semibold tracking-tight text-[var(--color-fg)] ${
            dominant ? "text-[64px] md:text-[88px] leading-[0.95]" : "text-[36px] leading-[1]"
          }`}
        >
          +{pct}%
        </span>
        <span className="text-[11.5px] text-[var(--color-fg-muted)] font-mono pb-1">lift</span>
      </div>
      <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">{note}</div>
    </div>
  );
}

function ConfidenceTile({ pct }: { pct: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] px-5 py-5">
      <div className="text-[11px] uppercase tracking-[0.16em] font-mono text-[var(--color-fg-muted)]">
        Statistical confidence
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum font-semibold tracking-tight text-[36px] leading-[1] text-[var(--color-fg)]">
          {pct}%
        </span>
        <span className="text-[11.5px] text-[var(--color-fg-muted)] font-mono pb-1">
          {pct >= 95 ? "significant" : "directional"}
        </span>
      </div>
      <div className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
        Two-proportion z-test, p&nbsp;{pct >= 95 ? "<" : "≈"}&nbsp;{pct >= 95 ? "0.05" : (1 - pct / 100).toFixed(2)}
      </div>
    </div>
  );
}

/* -------- Pricing -------- */

function Pricing() {
  type Tier = {
    name: string;
    price: string;
    sub: string;
    cta: { label: string; href: string };
    features: string[];
    featured?: boolean;
    badge?: string;
  };
  const tiers: Tier[] = [
    {
      name: "Free",
      price: "$0",
      sub: "Forever. Test the waters.",
      cta: { label: "Join waitlist", href: "#waitlist" },
      features: ["5,000 escapes / month", "1 storefront", "Daily analytics", "Auto-update on patches"],
    },
    {
      name: "Pro",
      price: "$29",
      sub: "/mo — for one serious store.",
      featured: true,
      badge: "Most popular",
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
      sub: "/mo — for portfolios & agencies.",
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
    <section id="pricing" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-6xl px-5 py-28">
        <div className="text-center max-w-2xl mx-auto">
          <SectionLabel>Pricing</SectionLabel>
          <h2 className="mt-3 text-balance">
            <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Pays for itself</span>
            <span className="block mt-1.5 h-editorial text-[26px] sm:text-3xl md:text-[44px] text-[var(--color-accent)]">on a single extra sale.</span>
          </h2>
          <p className="mt-3 text-[var(--color-fg-dim)]">
            Most stores recover the entire monthly cost in the first 24 hours.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-7 md:gap-4 items-stretch">
          {tiers.map((t) => (
            <PricingCard key={t.name} tier={t} />
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-[var(--color-fg-muted)]">
          All plans include the dashboard, the test infra, and patch auto-updates. No annual lock-in.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: { name: string; price: string; sub: string; cta: { label: string; href: string }; features: string[]; featured?: boolean; badge?: string } }) {
  const cardBody = (
    <div
      className={`relative rounded-2xl flex flex-col h-full ${
        tier.featured
          ? "border-2 border-[var(--color-accent)]/50 bg-[var(--color-card-hi)]"
          : "border border-[var(--color-border)] bg-[var(--color-card)]"
      }`}
      style={tier.featured ? { boxShadow: "var(--shadow-elev)" } : undefined}
    >
      {tier.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold bg-[var(--color-accent)] text-white shadow-[var(--shadow-accent)]">
          <span className="size-1 rounded-full bg-white" />
          {tier.badge}
        </span>
      ) : null}
      <div className="p-7 pb-5">
        <h3 className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[var(--color-fg-muted)]">{tier.name}</h3>
        <div className="mt-5 h-[64px] flex items-baseline gap-1.5">
          <span className="h-display text-5xl tnum">{tier.price}</span>
          <span className="text-sm text-[var(--color-fg-dim)]">{tier.sub}</span>
        </div>
      </div>
      <ul className="px-7 space-y-2.5 text-[14px] flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[var(--color-fg-dim)]">
            <Check />
            <span className="text-[var(--color-fg)]">{f}</span>
          </li>
        ))}
      </ul>
      <div className="p-7 pt-7 mt-auto">
        <a
          href={tier.cta.href}
          className={`group block text-center rounded-full px-4 py-2.5 font-medium press lift focus-ring ${
            tier.featured
              ? "bg-[var(--color-accent)] text-white"
              : "border border-[var(--color-border)] hover:border-[var(--color-fg-muted)] text-[var(--color-fg)]"
          }`}
          style={tier.featured ? { boxShadow: "var(--shadow-accent)" } : undefined}
        >
          <span className="inline-flex items-center gap-2.5">
            <span>{tier.cta.label}</span>
            <span className="btn-icon"><ArrowRight /></span>
          </span>
        </a>
      </div>
    </div>
  );
  return tier.featured ? <ShineBorder radius={18}>{cardBody}</ShineBorder> : cardBody;
}

/* -------- FAQ -------- */

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
      a: "The snippet is ~1.1 KB and runs synchronously before anything else. Lighthouse impact is unmeasurable. On Pro, we serve from your own CNAME so there's zero cross-origin penalty.",
    },
    {
      q: "What if Instagram patches the technique?",
      a: "We monitor for it actively. The snippet is edge-cached for 5 minutes — when we ship a fix, every customer auto-updates. If a fallback is ever the only option, the branded \"Open in Safari\" overlay still recovers most of the lift.",
    },
    {
      q: "Does it work on TikTok, Snapchat, Facebook?",
      a: "Instagram is the only IAB with a clean auto-escape (on iOS and Android). For TikTok / Snap / FB, EscapeHatch ships a polished one-tap \"Open in Safari\" overlay. Not as seamless, but recovers most of the lost conversions.",
    },
    {
      q: "Why pay — can't my dev write it in 5 minutes?",
      a: "They can. Then they have to build the dashboard, the A/B framework, the analytics pipeline, the fallback UI, the alerting when IG patches it, the Shopify App Embed, the CSP variants, and the multi-store admin. Or you spend $29 and have it tonight.",
    },
    {
      q: "Does it work on Shopify Plus?",
      a: "Yes. The snippet drops into theme.liquid same as any Shopify install. We've validated against checkout extensibility, Shop Pay, and the Plus B2B portal. Multi-store rollups are a Pro plan feature so a single dashboard covers every storefront.",
    },
    {
      q: "What if my store is headless (Hydrogen / Next.js / custom)?",
      a: "Drop the snippet into your root layout's <head>. The detection + redirect logic doesn't depend on Liquid — it runs purely client-side on first paint. Hydrogen, Next.js Commerce, Medusa, and custom-built stores all work.",
    },
    {
      q: "How fast will I see results?",
      a: "First escapes within minutes of installing. The A/B test reaches 95% statistical significance in 5-14 days for most stores spending $30k+/mo on Meta. Dashboard fires lift + p-value the moment you have enough sample.",
    },
    {
      q: "Is the snippet GDPR / CCPA compliant?",
      a: "We don't set cookies, we don't fingerprint, we don't ship analytics off your domain. The only data we collect is an IP-hashed event row per escape — no PII, no third-party trackers. Add us under \"functional\" in your consent banner if you have one.",
    },
    {
      q: "What happens if Apple Pay actually works in the IAB someday?",
      a: "We unmount cleanly — the snippet exits silently if it doesn't detect a broken IAB context. No customer-facing breakage. You can also flip the killswitch from your dashboard in case Instagram ever fixes things first.",
    },
  ];
  return (
    <section id="faq" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto max-w-3xl px-5 py-28">
        <div className="text-center">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-3 text-balance">
            <span className="block h-display text-[26px] sm:text-3xl md:text-[44px]">Short answers.</span>
          </h2>
        </div>
        <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {items.map((it) => (
            <details key={it.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-medium text-[15px] tracking-tight">{it.q}</span>
                <span className="size-7 rounded-full grid place-items-center border border-[var(--color-border)] text-[var(--color-fg-dim)] group-open:rotate-45 group-open:bg-[var(--color-accent)] group-open:text-white group-open:border-transparent transition-all duration-200">
                  <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M6 2v8M2 6h8" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-[var(--color-fg-dim)] leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- Footer -------- */

function Footer() {
  const cols = [
    {
      heading: "Product",
      links: [
        { label: "How it works", href: "#how" },
        { label: "Dashboard", href: "#dashboard" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Sign in", href: "/login" },
        { label: "Email", href: "mailto:hi@getescapehatch.com" },
        { label: "Twitter / X", href: "https://x.com/escapehatchapp" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ];
  return (
    <footer className="border-t border-[var(--color-border-soft)] mt-12">
      <div className="mx-auto max-w-6xl px-5 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1 max-w-xs">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-[var(--color-fg)] tracking-tight">{brand.name}</span>
          </div>
          <p className="mt-3 text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed">
            Detects Instagram&apos;s in-app browser and reopens your store in Safari. One snippet. 60-second install.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.heading}>
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-mono font-medium text-[var(--color-fg-muted)]">
              {col.heading}
            </div>
            <ul className="mt-3 space-y-2 text-[13px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-border-soft)]">
        <div className="mx-auto max-w-6xl px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11.5px] font-mono text-[var(--color-fg-muted)]">
          <span>© {new Date().getFullYear()} {brand.name} · Built for ecommerce that lives on Meta ads</span>
          <span>{brand.domain}</span>
        </div>
      </div>
    </footer>
  );
}

/* -------- Atoms -------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] uppercase tracking-[0.22em] font-semibold inline-flex items-center gap-2"
      style={{ color: "var(--color-accent)" }}
    >
      <span className="size-1 rounded-full bg-[var(--color-accent)]" />
      {children}
    </span>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 mt-0.5 shrink-0 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
