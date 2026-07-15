"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveInvoiceEdits,
  chargeInvoiceAction,
  voidInvoiceAction,
  recomputeInvoiceAction,
} from "@/app/actions/billing";

export type InvoiceStatus = "pending_review" | "charging" | "paid" | "failed" | "voided";

export type InvoiceRow = {
  id: string;
  merchant_id: string;
  kind: "plan_start" | "monthly";
  period_start: string;
  period_end: string;
  snapshot: Record<string, unknown>;
  base_fee_cents: number;
  rev_share_cents: number;
  total_cents: number;
  edited: boolean;
  note: string | null;
  status: InvoiceStatus;
  stripe_invoice_id: string | null;
  charge_attempts: number;
  created_at: string;
  charged_at: string | null;
};

// Full math snapshot — only present on `kind: 'monthly'` rows. `plan_start`
// rows carry a much thinner `{ planStart: true, baseFeeCents }` snapshot
// (see buildSnapshot/startPerformancePlan), so this component renders a
// simplified summary for those instead of the full breakdown.
type MonthlySnapshot = {
  impA: number;
  impB: number;
  trimmedRevACents: number;
  trimmedRevBCents: number;
  outliersA: number[];
  outliersB: number[];
  controlRpvMicroCents: number;
  counterfactualCents: number;
  incrementalCents: number;
  revSharePct: number;
};

function isMonthlySnapshot(s: Record<string, unknown>): s is MonthlySnapshot {
  return typeof s.impA === "number" && typeof s.controlRpvMicroCents === "number";
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function outlierSummary(vals: number[] | undefined): string {
  if (!vals || vals.length === 0) return "none";
  const sum = vals.reduce((a, b) => a + b, 0);
  return `${vals.length} (${money(sum)})`;
}

// ISO date slice — deterministic across server render + client hydration
// (no locale-dependent Date formatting that could drift between them).
function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

function statusPillClass(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "pill pill-success";
    case "failed":
      return "pill pill-danger";
    case "charging":
      return "pill pill-info";
    case "voided":
      return "pill pill-muted";
    default:
      return "pill pill-warn";
  }
}

export function InvoiceCard({
  invoice,
  merchantName,
}: {
  invoice: InvoiceRow;
  merchantName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [baseFeeInput, setBaseFeeInput] = useState((invoice.base_fee_cents / 100).toFixed(2));
  const [revShareInput, setRevShareInput] = useState((invoice.rev_share_cents / 100).toFixed(2));
  const [note, setNote] = useState(invoice.note ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const snap = invoice.snapshot ?? {};
  const monthly = isMonthlySnapshot(snap) ? snap : null;

  const editable = invoice.status === "pending_review";
  const canCharge = invoice.status === "pending_review" || invoice.status === "failed";
  const canVoid = invoice.status === "pending_review" || invoice.status === "failed";
  const canRecompute = invoice.kind === "monthly" && invoice.status === "pending_review";

  function parsedCents(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
  }

  function handleSave() {
    const baseFeeCents = parsedCents(baseFeeInput);
    const revShareCents = parsedCents(revShareInput);
    if (baseFeeCents == null || revShareCents == null) {
      setMessage("Enter valid non-negative dollar amounts");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await saveInvoiceEdits(invoice.id, baseFeeCents, revShareCents, note);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  function handleCharge() {
    // Charge always bills the invoice's persisted row values, so the confirm
    // dialog must show exactly that — never live (possibly unsaved) input state.
    if (editable) {
      const baseFeeCents = parsedCents(baseFeeInput);
      const revShareCents = parsedCents(revShareInput);
      const dirty =
        baseFeeCents !== invoice.base_fee_cents || revShareCents !== invoice.rev_share_cents;
      if (dirty) {
        setMessage("Unsaved edits — Save (or reset) before charging");
        return;
      }
    }
    if (!confirm(`Charge ${money(invoice.total_cents)} to ${merchantName}'s card now?`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await chargeInvoiceAction(invoice.id);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage("Charging…");
      router.refresh();
    });
  }

  function handleVoid() {
    if (!confirm(`Void this invoice for ${merchantName}? This cannot be undone.`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await voidInvoiceAction(invoice.id);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage("Voided");
      router.refresh();
    });
  }

  function handleRecompute() {
    if (invoice.edited) {
      if (!confirm(`Discard manual edits on this invoice and recompute from source data?`)) return;
      setMessage(null);
      startTransition(async () => {
        const res = await recomputeInvoiceAction(invoice.id, true);
        if ("error" in res) {
          setMessage(res.error);
          return;
        }
        setMessage("Recomputed");
        router.refresh();
      });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await recomputeInvoiceAction(invoice.id);
      if ("error" in res) {
        setMessage(res.error);
        return;
      }
      setMessage("Recomputed");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-medium tracking-tight">{merchantName}</span>
            <span className={statusPillClass(invoice.status)}>{invoice.status.replace("_", " ")}</span>
            {invoice.edited ? <span className="pill pill-info">edited</span> : null}
            <span className="pill pill-muted">{invoice.kind === "plan_start" ? "plan start" : "monthly"}</span>
          </div>
          <div className="mt-1 text-[10.5px] font-mono text-[var(--color-fg-muted)]">
            {fmtDate(invoice.period_start)} → {fmtDate(invoice.period_end)} · created {fmtDate(invoice.created_at)}
            {invoice.charged_at ? ` · charged ${fmtDate(invoice.charged_at)}` : ""}
            {invoice.charge_attempts > 0 ? ` · attempt ${invoice.charge_attempts}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">Total</div>
          <div className="text-[20px] font-semibold tracking-tight tnum">{money(invoice.total_cents)}</div>
        </div>
      </div>

      {invoice.status === "charging" ? (
        <div className="mt-3 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-3 py-2 text-[11.5px] text-[var(--color-fg)]">
          In flight — Stripe auto-collects after finalization, typically within the hour. The webhook settles this to paid/failed; this is normal, not an error.
        </div>
      ) : null}

      {monthly && monthly.trimmedRevBCents === 0 && monthly.incrementalCents > 0 ? (
        // amber matches .pill-warn — there is no --color-warning token
        <div className="mt-3 rounded-md border border-[rgba(245,158,11,0.30)] bg-[rgba(245,158,11,0.10)] px-3 py-2 text-[11.5px] text-[var(--color-fg)]">
          Control too thin — $0 control revenue over {monthly.impB.toLocaleString("en-US")} impressions
          makes the counterfactual $0, so ALL escape revenue is counted as incremental. Review the split
          runtime before charging; consider editing the performance fee down or voiding until the control
          has purchases.
        </div>
      ) : null}

      <div className="mt-4 grid gap-x-6 gap-y-1.5 text-[12.5px] font-mono sm:grid-cols-[minmax(0,1fr)_auto]">
        {monthly ? (
          <>
            <Row label="impressions (escape, period)" value={monthly.impA.toLocaleString("en-US")} />
            <Row label="trimmed revenue (escape)" value={money(monthly.trimmedRevACents)} />
            <Row
              label="control RPV (running, trimmed)"
              value={`$${(monthly.controlRpvMicroCents / 1e6).toFixed(4)}/visitor`}
              hint={`from ${monthly.impB.toLocaleString("en-US")} control impressions`}
            />
            <Row label="counterfactual" value={money(monthly.counterfactualCents)} />
            <Row label="incremental" value={money(monthly.incrementalCents)} />
            <Row
              label="outliers trimmed"
              value={`A: ${outlierSummary(monthly.outliersA)} · B: ${outlierSummary(monthly.outliersB)}`}
            />
          </>
        ) : (
          <Row label="plan start — month 1 platform fee" value={money(invoice.base_fee_cents)} />
        )}
      </div>

      <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            rev share{monthly ? ` (${monthly.revSharePct}%)` : ""}
          </span>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[12px] text-[var(--color-fg-muted)]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={revShareInput}
              disabled={!editable || isPending}
              onChange={(e) => setRevShareInput(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono tnum focus-ring focus:border-[var(--color-accent)]/60 disabled:opacity-60 transition-colors"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            base fee
          </span>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[12px] text-[var(--color-fg-muted)]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={baseFeeInput}
              disabled={!editable || isPending}
              onChange={(e) => setBaseFeeInput(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12.5px] font-mono tnum focus-ring focus:border-[var(--color-accent)]/60 disabled:opacity-60 transition-colors"
            />
          </div>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
            note
          </span>
          <input
            type="text"
            value={note}
            disabled={!editable || isPending}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="internal note (optional)"
            className="mt-1 w-full px-2.5 py-1.5 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[12px] focus-ring focus:border-[var(--color-accent)]/60 disabled:opacity-60 transition-colors"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {editable ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-elev)] press focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            Save
          </button>
        ) : null}
        {canCharge ? (
          <button
            type="button"
            onClick={handleCharge}
            disabled={isPending}
            className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium press lift focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            {invoice.status === "failed" ? "Retry charge" : "Charge"}
          </button>
        ) : null}
        {canRecompute ? (
          <button
            type="button"
            onClick={handleRecompute}
            disabled={isPending}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-bg-elev)] press focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            {invoice.edited ? "Recompute (discards edits)" : "Recompute"}
          </button>
        ) : null}
        {canVoid ? (
          <button
            type="button"
            onClick={handleVoid}
            disabled={isPending}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] press focus-ring disabled:cursor-wait disabled:opacity-60 transition-colors"
          >
            Void
          </button>
        ) : null}
        {message ? (
          <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">{message}</span>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <>
      <div className="text-[var(--color-fg-muted)]">
        {label}
        {hint ? <span className="ml-1 text-[10.5px] text-[var(--color-fg-muted)]">← {hint}</span> : null}
      </div>
      <div className="text-right tnum text-[var(--color-fg)]">{value}</div>
    </>
  );
}
