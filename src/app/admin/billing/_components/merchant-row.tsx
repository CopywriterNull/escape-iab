"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateSetupLink,
  startPerformancePlan,
  setBaseFeeWaived,
} from "@/app/actions/billing";

export type BillingMerchant = {
  id: string;
  name: string | null;
  billing_status: "none" | "active" | "paused";
  billing_anchor: string | null;
  ab_split_pct: number;
  stripe_customer_id: string | null;
  card_saved: boolean;
  billing_setup_token: string | null;
  base_fee_cents: number;
  base_fee_waived: boolean;
  rev_share_pct: number;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function statusPillClass(status: BillingMerchant["billing_status"]): string {
  if (status === "active") return "pill pill-success";
  if (status === "paused") return "pill pill-warn";
  return "pill pill-muted";
}

export function MerchantRow({ merchant }: { merchant: BillingMerchant }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // stripe_customer_id alone is a false positive — merely opening the setup
  // link creates a Stripe customer before any card is saved. card_saved
  // (flipped by the webhook on checkout.session.completed) is the real signal.
  const hasCard = merchant.stripe_customer_id != null && merchant.card_saved;
  const awaitingCard = !hasCard && (merchant.stripe_customer_id != null || merchant.billing_setup_token != null);
  const cardLabel = hasCard ? "card on file" : awaitingCard ? "link sent, awaiting card" : "no link sent";
  const cardClass = hasCard ? "text-[var(--color-success)]" : "text-[var(--color-fg-muted)]";

  function handleCopyLink() {
    setMessage(null);
    startTransition(async () => {
      const res = await generateSetupLink(merchant.id);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(res.url);
        setMessage("Setup link copied");
      } catch {
        setMessage(res.url);
      }
      router.refresh();
    });
  }

  function handleStartPlan() {
    if (
      !confirm(
        "Flips to 90/10 and charges $300 now (unless waived). Continue?",
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const res = await startPerformancePlan(merchant.id);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage("Plan started");
      router.refresh();
    });
  }

  function handleToggleWaive() {
    setMessage(null);
    startTransition(async () => {
      const res = await setBaseFeeWaived(merchant.id, !merchant.base_fee_waived);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-[var(--color-border-soft)] last:border-b-0">
      <td className="px-4 py-3 align-middle">
        <div className="font-medium tracking-tight">{merchant.name ?? "(unnamed)"}</div>
        <div className="mt-0.5 font-mono text-[10px] text-[var(--color-fg-muted)] truncate max-w-[180px]">
          {merchant.id.slice(0, 8)}…
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className={statusPillClass(merchant.billing_status)}>{merchant.billing_status}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="font-mono tnum text-[12px]">
          {merchant.ab_split_pct}/{100 - merchant.ab_split_pct}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        <span className={`text-[12px] font-mono ${cardClass}`}>{cardLabel}</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="font-mono tnum text-[12px]">
          {merchant.base_fee_waived ? (
            <span className="text-[var(--color-fg-muted)] line-through">{money(merchant.base_fee_cents)}</span>
          ) : (
            money(merchant.base_fee_cents)
          )}
        </div>
        {merchant.base_fee_waived ? <span className="pill pill-info mt-1 inline-flex">waived</span> : null}
      </td>
      <td className="px-4 py-3 align-middle">
        <span className="font-mono tnum text-[12px]">{merchant.rev_share_pct}%</span>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={isPending}
              className="text-[11.5px] px-2.5 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
            >
              Copy setup link
            </button>
            {merchant.billing_status !== "active" ? (
              <button
                type="button"
                onClick={handleStartPlan}
                disabled={isPending || !hasCard}
                title={hasCard ? undefined : "no card on file — send the setup link first"}
                className="text-[11.5px] px-2.5 py-1 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium press lift focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
              >
                Start performance plan
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleToggleWaive}
              disabled={isPending}
              className="text-[11.5px] px-2.5 py-1 rounded-md border border-[var(--color-border-soft)] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-elev)] press focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
            >
              {merchant.base_fee_waived ? "Unwaive base fee" : "Waive base fee"}
            </button>
          </div>
          {message ? (
            <span className="max-w-[260px] text-[10.5px] font-mono text-[var(--color-fg-muted)] break-all">
              {message}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
