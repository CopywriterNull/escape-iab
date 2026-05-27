"use client";

import type { CalculatorProof } from "@/components/Lander";
import { useMemo, useState } from "react";

const spendSteps = [
  10_000,
  25_000,
  50_000,
  75_000,
  100_000,
  150_000,
  250_000,
  500_000,
  750_000,
  1_000_000,
];

const MODELED_ROAS = 2.5;
const IG_IAB_TRAFFIC_SHARE = 0.28;
const FALLBACK_RECOVERY_RATE = 0.04;
const THREE_DAY_SHARE = 3 / 30;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmtMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000)}k`;
  return money.format(value);
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function fmtSignedMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${money.format(Math.abs(value))}`;
}

function fmtCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString();
}

export function SpendCalculator({ proof }: { proof?: CalculatorProof | null }) {
  const [step, setStep] = useState(4);
  const spend = spendSteps[step] ?? 100_000;
  const recoveryRate = proof?.recoveryRate ?? FALLBACK_RECOVERY_RATE;
  const estimate = useMemo(() => {
    const adDrivenRevenue = spend * MODELED_ROAS;
    const affectedRevenue = adDrivenRevenue * IG_IAB_TRAFFIC_SHARE;
    const monthlyRecovered = affectedRevenue * recoveryRate;
    return {
      monthlyRecovered,
      threeDayGift: monthlyRecovered * THREE_DAY_SHARE,
      affectedRevenue,
    };
  }, [recoveryRate, spend]);

  const modelLabel = proof ? "Portfolio-backed" : "Conservative";
  const modelSubcopy = proof
    ? `${fmtPct(recoveryRate)} recovery model`
    : `${fmtPct(FALLBACK_RECOVERY_RATE)} recovery model`;
  const sourceLine = proof
    ? `Uses the latest ${proof.rangeLabel} portfolio read across ${proof.activeBrands} brands: ${proof.rpvLiftPct != null ? fmtPct(proof.rpvLiftPct) : "positive"} RPV lift${proof.rpvDelta != null ? ` (${fmtSignedMoney(proof.rpvDelta)} per visitor)` : ""} across ${fmtCompact(proof.visitors)} IG-IAB visitors, then applies a conservative haircut.`
    : `Uses 2.5x ROAS, 28% Instagram in-app browser exposure, and ${fmtPct(FALLBACK_RECOVERY_RATE)} recovered revenue.`;

  return (
    <section id="calculator" className="relative">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full border border-[var(--color-border-soft)] bg-[var(--color-card)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-fg-muted)]">
            Revenue calculator
          </div>
          <h2 className="mt-4 max-w-xl text-balance">
            <span className="block h-display text-[28px] sm:text-4xl md:text-[52px]">
              What does the Instagram browser cost you?
            </span>
          </h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-[var(--color-fg-dim)]">
            Start with monthly Meta spend. We use recent portfolio A/B data as the baseline, then apply a conservative haircut before estimating recovered revenue from smoother Safari checkout.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#pricing"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--color-cta-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-cta-fg)] press lift focus-ring"
              style={{ boxShadow: "var(--shadow-cta)" }}
            >
              Try 3 days free
              <ArrowRight />
            </a>
            <a
              href="#waitlist"
              className="inline-flex items-center rounded-full border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] hover:border-[var(--color-fg-muted)] press lift focus-ring"
            >
              Get a readout
            </a>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                Monthly Meta spend
              </div>
              <div className="mt-2 h-display text-[42px] leading-none tracking-tight text-[var(--color-fg)] tnum sm:text-[56px]">
                {fmtMoney(spend)}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success-soft)] px-3 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-success)]">
                {modelLabel}
              </div>
              <div className="mt-0.5 text-[12px] text-[var(--color-fg-dim)]">{modelSubcopy}</div>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={spendSteps.length - 1}
            step={1}
            value={step}
            onChange={(event) => setStep(Number(event.currentTarget.value))}
            aria-label="Monthly Meta ad spend"
            className="mt-7 w-full accent-[var(--color-accent)]"
          />
          <div className="mt-2 flex justify-between text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            <span>$10k</span>
            <span>$1M+</span>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label="Estimated recovered / mo" value={money.format(estimate.monthlyRecovered)} tone="good" />
            <Metric label="First 3 days gifted" value={money.format(estimate.threeDayGift)} tone="good" />
            <Metric label="Modeled IG-IAB revenue" value={money.format(estimate.affectedRevenue)} />
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-bg)]/55 p-4">
            <div className="text-[12px] font-medium text-[var(--color-fg)]">
              Try us for 3 days free. If the test creates lift, keep the incremental revenue from those 3 days.
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
              {sourceLine} Trial requires the snippet to stay installed and unmodified during measurement.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good";
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-bg)]/45 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
        {label}
      </div>
      <div className={`mt-2 h-display text-[24px] leading-none tnum ${tone === "good" ? "text-[var(--color-success)]" : "text-[var(--color-fg)]"}`}>
        {value}
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h9" />
      <path d="M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
