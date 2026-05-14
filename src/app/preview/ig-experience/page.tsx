import Link from "next/link";
import { brand } from "@/lib/branding";

export const metadata = {
  title: "IG in-app browser preview",
};

export default function IGExperiencePreview() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)] grain">
      <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">
        {/* Header */}
        <div className="flex items-baseline justify-between gap-3 pb-6 border-b border-[var(--color-border-soft)]">
          <div>
            <div className="eyebrow">Preview</div>
            <h1 className="mt-2 h-display text-[28px] tracking-tight">
              IG in-app browser ·{" "}
              <span className="h-editorial text-[var(--color-accent)]">
                what your visitor sees
              </span>
            </h1>
            <p className="mt-2 text-[13.5px] text-[var(--color-fg-dim)] max-w-xl">
              Frame is the Instagram in-app browser. The cobalt pill at the bottom is the fallback
              button that appears at 2s if iOS rejects the auto-escape scheme.
            </p>
          </div>
          <Link
            href="/"
            className="text-[12px] font-mono text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hidden sm:inline"
          >
            ← home
          </Link>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-8 md:gap-10 items-start">
          {/* Phone frame */}
          <div className="mx-auto md:mx-0 max-w-[360px] w-full">
            <PhoneFrame />
          </div>

          {/* Side panel — labels + explainer */}
          <div className="space-y-6 max-w-md">
            <Beat
              n="01"
              t="IG webview opens"
              d="Tap from a story, profile link, ad, or DM and Instagram drops you in its stripped-down in-app browser. Top chrome shows close + URL + three-dot menu."
            />
            <Beat
              n="02"
              t="Snippet auto-fires"
              d="Within ~60ms of paint, our snippet detects the IG webview UA and fires instagram://extbrowser/?url=… — iOS hands off to Safari, page reopens with cookies, Apple Pay, autofill all working."
            />
            <Beat
              n="03"
              t="Fallback button (rare)"
              d="If iOS rejects the scheme — older OS, patched build, edge case — the cobalt 'Tap to open in browser' pill renders at the bottom of the screen at the 2-second mark. User taps, same handoff, same result."
            />
            <div className="pt-4 border-t border-[var(--color-border-soft)] text-[11.5px] font-mono text-[var(--color-fg-muted)]">
              Test it for real: DM yourself {brand.domain}, tap from IG, watch the handoff.
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--color-border-soft)] flex items-center justify-between text-[11px] font-mono text-[var(--color-fg-muted)]">
          <Link href="/preview/dashboard" className="hover:text-[var(--color-fg-dim)]">
            ← dashboard variants
          </Link>
          <Link href="/preview/landing" className="hover:text-[var(--color-fg-dim)]">
            landing variants →
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Phone frame with iPhone-style outer chrome + IG inner chrome ─── */

function PhoneFrame() {
  return (
    <div
      className="relative rounded-[44px] p-2.5 mx-auto"
      style={{
        background: "linear-gradient(180deg, #1a1a1d 0%, #0d0d0f 100%)",
        boxShadow:
          "0 32px 64px -16px rgba(15,23,42,0.45), 0 1px 0 rgba(255,255,255,0.05) inset",
      }}
    >
      {/* Screen */}
      <div
        className="rounded-[36px] overflow-hidden relative bg-[var(--color-bg)]"
        style={{ aspectRatio: "9 / 19.5" }}
      >
        {/* iOS status bar */}
        <div className="relative h-[44px] flex items-center justify-between px-7 text-[12px] font-semibold text-[var(--color-fg)]">
          <span className="tnum">9:41</span>
          {/* Dynamic Island */}
          <span
            aria-hidden
            className="absolute left-1/2 top-2 -translate-x-1/2 w-[100px] h-[28px] rounded-full bg-black"
          />
          <span className="flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="text-[10.5px]">●●●●</span>
            <span className="text-[10px] font-mono">5G</span>
            <span aria-hidden className="ml-1.5 inline-block w-[18px] h-[9px] rounded-[2px] border border-[var(--color-fg)]/80 relative">
              <span className="absolute inset-[1px] right-[2px] bg-[var(--color-fg)] rounded-[1px]" />
            </span>
          </span>
        </div>

        {/* Instagram webview chrome */}
        <div
          className="border-b border-black/10"
          style={{ background: "#1c1d24", color: "#fff" }}
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <button aria-hidden className="size-7 grid place-items-center text-white/90">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-[12.5px] font-medium truncate">{brand.domain}</div>
              <div className="text-[10px] text-white/60 -mt-0.5">Connection secure</div>
            </div>
            <button aria-hidden className="size-7 grid place-items-center text-white/90">
              <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
                <circle cx="3" cy="8" r="1.6" />
                <circle cx="8" cy="8" r="1.6" />
                <circle cx="13" cy="8" r="1.6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mock site content */}
        <MockSiteContent />

        {/* Fallback pill — overlays at the bottom (visual only — preview page) */}
        <div className="absolute left-0 right-0 bottom-[78px] flex justify-center px-5 pointer-events-none">
          <span
            className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight rounded-full bg-white text-black px-5 py-3"
            style={{ boxShadow: "0 10px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,0.04)" }}
          >
            Tap to open in browser
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>

        {/* Instagram bottom toolbar */}
        <div
          className="absolute left-0 right-0 bottom-0 flex items-center justify-around py-3 text-white/80"
          style={{ background: "#1c1d24", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <BackArrow />
          <ForwardArrow />
          <ShareIcon />
          <SafariIcon />
        </div>

        {/* Home indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[6px] w-[110px] h-[4px] rounded-full bg-white/85" />
      </div>
    </div>
  );
}

function MockSiteContent() {
  return (
    <div className="relative px-5 pt-5 pb-[180px] bg-[var(--color-bg)] overflow-hidden h-full">
      {/* Beta pill */}
      <div className="flex justify-center mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-2.5 py-0.5 text-[10px] text-[var(--color-fg-dim)]">
          <span className="size-1 rounded-full bg-[var(--color-success)]" />
          Now in private beta
        </span>
      </div>
      {/* Headline */}
      <h2 className="text-center text-balance">
        <span className="block h-display text-[22px] leading-[1.05] text-[var(--color-fg)]">
          Your Instagram ads work.
        </span>
        <span className="block mt-0.5 h-editorial text-[22px] leading-[1.05] text-[var(--color-accent)]">
          Your Instagram checkout doesn&apos;t.
        </span>
      </h2>
      {/* Subhead */}
      <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[var(--color-fg-dim)]">
        Every paid IG ad click opens inside Instagram&apos;s broken in-app browser. EscapeHatch detects it and reopens your store in <span className="text-[var(--color-accent)] font-medium">Safari</span> before checkout loads.
      </p>
      {/* Fake form preview */}
      <div className="mt-4 flex items-center gap-1.5">
        <div className="flex-1 h-8 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-3 flex items-center text-[10.5px] text-[var(--color-fg-muted)]">
          you@yourstore.com
        </div>
        <div className="h-8 px-3 rounded-full bg-[var(--color-fg)] text-[var(--color-bg)] text-[10.5px] font-medium flex items-center">
          Start →
        </div>
      </div>
      {/* Proof tiles */}
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {[
          { v: "+47.2%", l: "Avg checkout lift" },
          { v: "$184k", l: "Recovered (90d)" },
          { v: "1.1 KB", l: "Snippet · edge" },
        ].map((p) => (
          <div
            key={p.l}
            className="text-center px-2 py-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)]/60"
          >
            <div className="text-[12px] font-semibold tnum text-[var(--color-fg)]">{p.v}</div>
            <div className="mt-0.5 text-[8px] text-[var(--color-fg-muted)] leading-tight">{p.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Beat({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-[10.5px] font-mono tracking-[0.16em] text-[var(--color-fg-muted)] font-medium">
          {n}
        </span>
        <h3 className="text-[14px] font-semibold tracking-tight">{t}</h3>
      </div>
      <p className="text-[12.5px] text-[var(--color-fg-dim)] leading-relaxed pl-[34px]">{d}</p>
    </div>
  );
}

function BackArrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13L5 8l5-5" />
    </svg>
  );
}
function ForwardArrow() {
  return (
    <svg viewBox="0 0 16 16" className="size-5 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10V2M5 5l3-3 3 3" />
      <rect x="3" y="9" width="10" height="5" rx="1" />
    </svg>
  );
}
function SafariIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5l1.5 3.5L6.5 9.5z" fill="currentColor" />
    </svg>
  );
}
