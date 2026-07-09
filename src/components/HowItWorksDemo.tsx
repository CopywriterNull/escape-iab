"use client";

import { useEffect, useState } from "react";

type Step = 0 | 1 | 2;
const DURATIONS: Record<Step, number> = { 0: 2800, 1: 1100, 2: 3200 };

const STEPS: { label: string; title: string; body: string }[] = [
  {
    label: "01",
    title: "Visitor lands inside Instagram",
    body: "Tap from a story, ad, or DM. IG's in-app browser opens. Apple Pay, autofill, and saved logins don't work here — your checkout silently degrades.",
  },
  {
    label: "02",
    title: "Snippet detects, escapes",
    body: "Within ~60ms our snippet fires a deep link Instagram itself recognizes. iOS swaps the page out of IG and into Safari. Visitor doesn't choose — it just happens.",
  },
  {
    label: "03",
    title: "Checkout works",
    body: "Same store, real Safari. Apple Pay, Shop Pay, saved cards — all back. Your A/B dashboard records the lift in your own data.",
  },
];

export function HowItWorksDemo() {
  const [step, setStep] = useState<Step>(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setStep((s) => ((s + 1) % 3) as Step);
    }, DURATIONS[step]);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 md:gap-16 items-center">
      <div className="order-2 md:order-1 mx-auto md:mx-0">
        <PhoneDemo step={step} />
      </div>
      <div className="order-1 md:order-2">
        <Stepper step={step} onSelect={setStep} />
      </div>
    </div>
  );
}

function Stepper({ step, onSelect }: { step: Step; onSelect: (s: Step) => void }) {
  return (
    <ol className="space-y-2.5">
      {STEPS.map((s, i) => {
        const idx = i as Step;
        const active = step === idx;
        const past = step > idx;
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onSelect(idx)}
              className={`w-full text-left rounded-xl border p-4 md:p-5 transition-all duration-300 ${
                active
                  ? "border-[var(--color-accent)]/40 bg-[var(--color-card)]"
                  : "border-[var(--color-border-soft)] bg-[var(--color-card)]/40 hover:bg-[var(--color-card)]/80"
              }`}
              style={
                active
                  ? {
                      boxShadow:
                        "0 0 0 1px var(--color-accent), 0 12px 28px -12px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                    }
                  : undefined
              }
              aria-current={active ? "step" : undefined}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-mono tracking-wider transition-colors duration-300 ${
                    active
                      ? "bg-[var(--color-accent)] text-white"
                      : past
                        ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                        : "bg-[var(--color-bg-elev)] text-[var(--color-fg-muted)] border border-[var(--color-border-soft)]"
                  }`}
                >
                  {past ? (
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    s.label
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[15px] md:text-[16px] font-semibold tracking-tight transition-colors duration-300 ${active ? "text-[var(--color-fg)]" : "text-[var(--color-fg-dim)]"}`}>
                    {s.title}
                  </div>
                  <p className={`mt-1 text-[13px] leading-relaxed transition-colors duration-300 ${active ? "text-[var(--color-fg-dim)]" : "text-[var(--color-fg-muted)]"}`}>
                    {s.body}
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ─── Phone with cross-faded frames ─── */

function PhoneDemo({ step }: { step: Step }) {
  return (
    <div className="relative pb-12">
      {/* Phone shell */}
      <div
        className="relative rounded-[42px] p-2 mx-auto w-[290px] max-w-full"
        style={{
          background: "linear-gradient(180deg, #1a1a1d 0%, #0d0d0f 100%)",
          boxShadow:
            "0 30px 60px -16px rgba(15,23,42,0.45), 0 1px 0 rgba(255,255,255,0.05) inset",
        }}
      >
        <div
          className="relative rounded-[34px] overflow-hidden bg-[#0a0a0b]"
          style={{ aspectRatio: "9 / 19.5" }}
        >
          {/* iOS status bar */}
          <div className="relative z-10 h-[28px] flex items-center justify-between px-5 text-[10px] font-semibold text-white">
            <span className="tnum">9:41</span>
            <span aria-hidden className="absolute left-1/2 top-[6px] -translate-x-1/2 w-[78px] h-[20px] rounded-full bg-black" />
            <span className="inline-flex items-center gap-1 opacity-90 text-[9px] tracking-wider">●●● 5G</span>
          </div>

          {/* Frame 0: IG IAB (broken) */}
          <Frame visible={step === 0}>
            <IGChromeMini />
            <StoreContent state="broken" />
          </Frame>

          {/* Frame 1: Escape pulse */}
          <Frame visible={step === 1}>
            <EscapeFlash />
          </Frame>

          {/* Frame 2: Safari (working) */}
          <Frame visible={step === 2}>
            <SafariChromeMini />
            <StoreContent state="working" />
          </Frame>

          {/* Home indicator */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[5px] w-[88px] h-[3px] rounded-full bg-white/85 z-20" />
        </div>
      </div>

      {/* Outside-the-phone label — sits fully below the phone, not overlapping the home indicator */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-wider whitespace-nowrap transition-all duration-300 ${
          step === 0
            ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)] border border-[var(--color-danger)]/30"
            : step === 1
              ? "bg-[var(--color-accent)] text-white border border-[var(--color-accent)]"
              : "bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30"
        }`}
      >
        {step === 0 ? "checkout broken" : step === 1 ? "escaping…" : "checkout works"}
      </div>
    </div>
  );
}

function Frame({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 top-[28px] flex flex-col transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}

function IGChromeMini() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-[10px] text-white shrink-0"
      style={{ background: "#1c1d24" }}
    >
      <svg viewBox="0 0 16 16" className="size-3 opacity-90" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
      </svg>
      <div className="flex-1 truncate text-center font-medium tracking-tight opacity-90">
        yourshop.com
      </div>
      <svg viewBox="0 0 16 16" className="size-3 opacity-90" fill="currentColor">
        <circle cx="3" cy="8" r="1.3" />
        <circle cx="8" cy="8" r="1.3" />
        <circle cx="13" cy="8" r="1.3" />
      </svg>
    </div>
  );
}

function SafariChromeMini() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-2 text-[10px] bg-[#f5f5f7] text-[#1d1d1f] border-b border-black/10 shrink-0">
      <span className="opacity-50 text-[12px] leading-none">‹</span>
      <span className="opacity-50 text-[12px] leading-none">›</span>
      <div className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-white px-2 py-[3px] truncate border border-black/10">
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

function StoreContent({ state }: { state: "broken" | "working" }) {
  const broken = state === "broken";
  return (
    <div className={`flex-1 px-3 pt-3 pb-3 flex flex-col gap-2.5 text-[10px] ${broken ? "bg-[#0a0a0b] text-white" : "bg-white text-[#1d1d1f]"}`}>
      {/* Product card */}
      <div className={`rounded-lg p-2 flex items-center gap-2 ${broken ? "bg-white/5 border border-white/10" : "bg-[#f5f5f7]"}`}>
        <div className={`size-9 rounded-md ${broken ? "bg-white/10" : "bg-white border border-black/10"} grid place-items-center`}>
          <span className="text-[14px]">⚡</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-semibold tracking-tight truncate">Energy Drink · Mango</div>
          <div className={`text-[8.5px] font-mono tabular-nums ${broken ? "text-white/50" : "text-black/50"}`}>$3.49 · 16 fl oz</div>
        </div>
      </div>
      {/* Field */}
      <div className={`rounded-md px-2 py-1.5 text-[9px] font-mono ${broken ? "border border-white/15 bg-white/[0.03] text-white/50" : "border border-black/10 bg-[#f9f9fb] text-black/40"}`}>
        you@email.com
      </div>
      {/* Pay row */}
      <div className="grid grid-cols-3 gap-1.5">
        <PayChip kind="apple" broken={broken} />
        <PayChip kind="shop" broken={broken} />
        <PayChip kind="card" broken={broken} />
      </div>
      {/* CTA */}
      <div
        className={`mt-auto rounded-md py-1.5 text-center text-[10px] font-semibold tracking-tight ${
          broken
            ? "bg-white/10 text-white/40 line-through decoration-[var(--color-danger)] decoration-2"
            : "bg-[#1d1d1f] text-white"
        }`}
      >
        {broken ? "Buy now" : "Buy with Apple Pay"}
      </div>
      {broken ? (
        <div className="text-[8.5px] text-[var(--color-danger)] font-mono tracking-wide flex items-center gap-1">
          <span className="size-1 rounded-full bg-[var(--color-danger)]" />
          apple pay unavailable · session lost
        </div>
      ) : (
        <div className="text-[8.5px] text-[#34a853] font-mono tracking-wide flex items-center gap-1">
          <span className="size-1 rounded-full bg-[#34a853]" />
          autofill ready · session restored
        </div>
      )}
    </div>
  );
}

function PayChip({ kind, broken }: { kind: "apple" | "shop" | "card"; broken: boolean }) {
  const label = kind === "apple" ? " Pay" : kind === "shop" ? "Shop" : "Card";
  return (
    <div
      className={`relative h-7 rounded-md flex items-center justify-center text-[9px] font-semibold ${
        broken
          ? "border border-white/10 bg-white/[0.04] text-white/30"
          : kind === "apple"
            ? "bg-black text-white"
            : kind === "shop"
              ? "bg-[#5a31f4] text-white"
              : "bg-white text-[#1d1d1f] border border-black/10"
      }`}
    >
      {kind === "apple" ? <span></span> : null}
      <span className="ml-0.5">{label}</span>
      {broken ? (
        <span className="absolute inset-0 grid place-items-center">
          <svg viewBox="0 0 16 16" className="size-3 text-[var(--color-danger)]/80" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6" />
            <path d="M4 12L12 4" strokeLinecap="round" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}

function EscapeFlash() {
  return (
    <div className="flex-1 relative grid place-items-center bg-[#0a0a0b] text-white overflow-hidden">
      {/* Pulsing ring */}
      <span
        aria-hidden
        className="absolute size-32 rounded-full"
        style={{
          background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 60%, transparent) 0%, transparent 70%)",
          animation: "ehPulse 1.1s ease-out forwards",
        }}
      />
      <div className="relative z-10 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] text-white px-3 py-1.5 text-[11px] font-semibold tracking-tight">
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
          Handoff to Safari
        </div>
        <div className="mt-3 text-[9.5px] font-mono tracking-wider text-white/60">
          instagram → ios → safari
        </div>
      </div>
      <style jsx>{`
        @keyframes ehPulse {
          0% { transform: scale(0.4); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
