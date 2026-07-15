"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { siteOrigin } from "@/lib/site";
import { computeInvoice } from "@/lib/billing/math";
import { buildSnapshot, computePeriodMetrics } from "@/lib/billing/data";
import { chargeInvoice, getStripe } from "@/lib/billing/stripe";

async function requireAdmin(): Promise<{ error: string } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { error: "backend not configured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) return { error: "admin only" };
  return null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "charge failed";
}

/** Append a charge-failure reason to whatever note is already on the row,
 *  rather than clobbering it — the existing note (e.g. "base fee waived")
 *  is still useful context once the row is back in `failed`. */
function appendNote(existing: string | null | undefined, message: string): string {
  return existing ? `${existing} — charge failed: ${message}` : `charge failed: ${message}`;
}

/** Void a Stripe-side invoice, sniffing the error message for the two
 *  "nothing to do" outcomes Stripe reports as thrown errors rather than
 *  distinct states: already paid (do NOT proceed — a charge succeeded) and
 *  already void (fine — fall through as if we'd voided it ourselves).
 *  Shared by voidInvoiceAction (void a dead invoice) and chargeInvoiceAction
 *  (void the prior attempt's invoice before creating a new one on retry). */
async function voidStripeInvoice(
  stripe: Stripe,
  stripeInvoiceId: string,
): Promise<{ ok: true } | { alreadyPaid: true } | { error: string }> {
  try {
    await stripe.invoices.voidInvoice(stripeInvoiceId);
    return { ok: true };
  } catch (err) {
    const message = errorMessage(err);
    const alreadyPaid = message.toLowerCase().includes("paid");
    const alreadyVoid = message.toLowerCase().includes("void");
    if (alreadyPaid) return { alreadyPaid: true };
    if (alreadyVoid) return { ok: true };
    return { error: message };
  }
}

export async function generateSetupLink(merchantId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await sb
    .from("merchants")
    .update({ billing_setup_token: token })
    .eq("id", merchantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { url: `${siteOrigin()}/billing/setup/${token}` };
}

export async function setBaseFeeWaived(merchantId: string, waived: boolean) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { error } = await sb
    .from("merchants")
    .update({ base_fee_waived: waived })
    .eq("id", merchantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

/** Flip 90/10, anchor billing, charge the month-1 $300 (unless waived).
 *  The operator's click is the approval for this fixed charge. */
export async function startPerformancePlan(merchantId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) return { error: "backend or stripe not configured" };

  const { data: m, error: mErr } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id, billing_status, base_fee_cents, base_fee_waived")
    .eq("id", merchantId)
    .single();
  if (mErr || !m) return { error: mErr?.message ?? "merchant not found" };
  // Fast-path only — the CAS below is the authority on whether the flip
  // actually happens, so a stale read here can't double-start the plan.
  if (m.billing_status === "active") return { error: "plan already active" };
  if (!m.stripe_customer_id) return { error: "no card on file — send the setup link first" };

  const customer = await stripe.customers.retrieve(m.stripe_customer_id);
  if (customer.deleted || !customer.invoice_settings?.default_payment_method) {
    return { error: "no default payment method — merchant must complete the setup link" };
  }

  // Hour-align the anchor to the NEXT hour boundary (ceil, not floor).
  // Chained monthly periods share hour-aligned boundaries with the rollup
  // window rule (hour >= trunc(from) AND hour < to), so a non-aligned
  // anchor double-counts the boundary hour of every consecutive period.
  // Ceiling means the first few minutes after the operator's click go
  // unbilled rather than billing pre-flip revenue — conservative in the
  // merchant's favor.
  const anchor = new Date();
  anchor.setUTCMinutes(0, 0, 0);
  anchor.setTime(anchor.getTime() + 3600_000);

  // Atomic CAS: only flip if still not active. Prevents a race where two
  // concurrent clicks (or a stale page + a retry) both pass the read-time
  // check above and both create a plan_start invoice.
  const { data: casRows, error: upErr } = await sb
    .from("merchants")
    .update({ billing_status: "active", billing_anchor: anchor.toISOString(), ab_split_pct: 90 })
    .eq("id", merchantId)
    .neq("billing_status", "active")
    .select("id");
  if (upErr) return { error: upErr.message };
  if (!casRows || casRows.length === 0) return { error: "plan already active" };

  const baseFee = m.base_fee_waived ? 0 : m.base_fee_cents;
  const initialNote = m.base_fee_waived
    ? "Plan start — base fee waived"
    : "Plan start — month 1 platform fee";
  const { data: row, error: insErr } = await sb
    .from("billing_invoices")
    .insert({
      merchant_id: merchantId,
      kind: "plan_start",
      period_start: anchor.toISOString(),
      period_end: anchor.toISOString(),
      snapshot: { planStart: true, baseFeeCents: baseFee },
      base_fee_cents: baseFee,
      rev_share_cents: 0,
      total_cents: baseFee,
      status: baseFee > 0 ? "charging" : "voided",
      note: initialNote,
      charge_attempts: 1,
    })
    .select("id")
    .single();
  if (insErr || !row) {
    const insMessage = insErr?.message ?? "invoice insert failed";
    const { error: rbErr } = await sb
      .from("merchants")
      .update({ billing_status: "none", billing_anchor: null, ab_split_pct: 50 })
      .eq("id", merchantId);
    if (rbErr) {
      console.error(
        `plan-start rollback failed for merchant ${merchantId} — left active without a month-1 invoice:`,
        insMessage,
        rbErr.message,
      );
      return {
        error: `invoice insert failed AND rollback failed — merchant left active without a month-1 invoice; fix in DB: ${insMessage} / ${rbErr.message}`,
      };
    }
    return { error: `could not create the month-1 invoice — plan start rolled back: ${insMessage}` };
  }

  if (baseFee > 0) {
    try {
      const { stripeInvoiceId } = await chargeInvoice(stripe, {
        customerId: m.stripe_customer_id,
        merchantId,
        invoiceRowId: row.id,
        attempt: 1,
        lines: [{ description: "EscapeHatch platform fee — month 1", amountCents: baseFee }],
      });
      const { error: bookErr } = await sb
        .from("billing_invoices")
        .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
        .eq("id", row.id);
      if (bookErr) {
        console.error(
          `failed to record charged invoice locally (stripe invoice ${stripeInvoiceId}, row ${row.id}):`,
          bookErr,
        );
        return {
          error: `charged on Stripe (invoice ${stripeInvoiceId}) but failed to record locally: ${bookErr.message} — webhook will reconcile status via metadata`,
        };
      }
    } catch (err) {
      const message = errorMessage(err);
      await sb
        .from("billing_invoices")
        .update({ status: "failed", note: appendNote(initialNote, message) })
        .eq("id", row.id);
      revalidatePath("/admin/billing");
      return { error: message };
    }
  }
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function saveInvoiceEdits(
  invoiceId: string,
  baseFeeCents: number,
  revShareCents: number,
  note: string,
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  if (!Number.isInteger(baseFeeCents) || baseFeeCents < 0) return { error: "bad base fee" };
  if (!Number.isInteger(revShareCents) || revShareCents < 0) return { error: "bad rev share" };
  const { data, error } = await sb
    .from("billing_invoices")
    .update({
      base_fee_cents: baseFeeCents,
      rev_share_cents: revShareCents,
      total_cents: baseFeeCents + revShareCents,
      edited: true,
      note: note || null,
    })
    .eq("id", invoiceId)
    .eq("status", "pending_review") // never edit after charge
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "invoice is no longer in an editable state" };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function chargeInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) return { error: "backend or stripe not configured" };

  const { data: inv, error } = await sb
    .from("billing_invoices")
    .select(
      "id, merchant_id, kind, status, stripe_invoice_id, period_start, period_end, note, charge_attempts",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review" && inv.status !== "failed")
    return { error: `cannot charge from status ${inv.status}` };
  if (inv.stripe_invoice_id && inv.status !== "failed")
    return { error: "already has a stripe invoice" };

  const { data: m } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id")
    .eq("id", inv.merchant_id)
    .single();
  if (!m?.stripe_customer_id) return { error: "merchant has no stripe customer" };

  // Per-attempt idempotency keys (see chargeInvoice) mean a retry creates a
  // NEW Stripe invoice — the OLD one, from the attempt that flipped this row
  // to `failed`, is still live and collectible on Stripe's side (smart
  // retries keep trying for days). Void it before claiming so we never end
  // up with two collectible invoices for the same period.
  if (inv.status === "failed" && inv.stripe_invoice_id) {
    const voidResult = await voidStripeInvoice(stripe, inv.stripe_invoice_id);
    if ("error" in voidResult) return { error: voidResult.error };
    if ("alreadyPaid" in voidResult) {
      return {
        error:
          "Stripe reports the previous invoice as PAID — do not recharge; the webhook will reconcile. Refresh.",
      };
    }
    // ok (includes already-void) — do NOT clear stripe_invoice_id here; the
    // post-charge bookkeeping below overwrites it with the new invoice id.
  }

  const priorStatus = inv.status;
  const attempt = (inv.charge_attempts ?? 0) + 1;
  const { data: claimedRows, error: claimErr } = await sb
    .from("billing_invoices")
    .update({ status: "charging", charge_attempts: attempt })
    .eq("id", inv.id)
    .in("status", ["pending_review", "failed"])
    .select("id, base_fee_cents, rev_share_cents, total_cents, kind, snapshot");
  if (claimErr) return { error: claimErr.message };
  if (!claimedRows || claimedRows.length === 0)
    return { error: "invoice state changed — refresh and retry" };
  const claimed = claimedRows[0];

  // Build the charge from what the CAS claim just returned, not the earlier
  // read above — closes the read→claim window where a concurrent edit
  // (saveInvoiceEdits) could change amounts between the initial select and
  // this update. The $0 guard is checked here for the same reason.
  if (claimed.total_cents <= 0) {
    const { error: revertErr } = await sb
      .from("billing_invoices")
      .update({ status: priorStatus })
      .eq("id", inv.id);
    if (revertErr) {
      console.error(
        `failed to revert invoice ${inv.id} to ${priorStatus} after post-claim $0 guard:`,
        revertErr,
      );
    }
    return { error: "total is $0 — void it instead" };
  }

  const period = `${inv.period_start.slice(0, 10)} → ${inv.period_end.slice(0, 10)}`;
  const snap = (claimed.snapshot ?? {}) as { incrementalCents?: number; revSharePct?: number };
  const baseFeeDescription =
    claimed.kind === "plan_start"
      ? "EscapeHatch platform fee — month 1"
      : "EscapeHatch platform fee — next period";
  const lines = [
    {
      description: `Performance fee — ${snap.revSharePct ?? 10}% of $${((snap.incrementalCents ?? 0) / 100).toFixed(2)} incremental revenue (${period})`,
      amountCents: claimed.rev_share_cents,
    },
    { description: baseFeeDescription, amountCents: claimed.base_fee_cents },
  ];
  try {
    const { stripeInvoiceId } = await chargeInvoice(stripe, {
      customerId: m.stripe_customer_id,
      merchantId: m.id,
      invoiceRowId: inv.id,
      attempt,
      lines,
    });
    const { error: bookErr } = await sb
      .from("billing_invoices")
      .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
      .eq("id", inv.id);
    if (bookErr) {
      console.error(
        `failed to record charged invoice locally (stripe invoice ${stripeInvoiceId}, row ${inv.id}):`,
        bookErr,
      );
      return {
        error: `charged on Stripe (invoice ${stripeInvoiceId}) but failed to record locally: ${bookErr.message} — webhook will reconcile status via metadata`,
      };
    }
  } catch (err) {
    const message = errorMessage(err);
    await sb
      .from("billing_invoices")
      .update({ status: "failed", note: appendNote(inv.note, message) })
      .eq("id", inv.id);
    revalidatePath("/admin/billing");
    return { error: message };
  }
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

export async function voidInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };

  const { data: inv, error: readErr } = await sb
    .from("billing_invoices")
    .select("id, status, stripe_invoice_id")
    .eq("id", invoiceId)
    .single();
  if (readErr || !inv) return { error: readErr?.message ?? "invoice not found" };

  // A `failed` row can still carry a live, finalized Stripe invoice —
  // Stripe's smart retries keep trying to collect on it for days after the
  // charge attempt that flipped us to `failed`. If we only void locally,
  // Stripe can successfully charge the card after the operator believed the
  // invoice was dead (the webhook would then flip voided → paid, reflecting
  // a charge nobody wanted). So void the Stripe-side invoice first.
  // `pending_review` rows have no stripe_invoice_id (never charged), so this
  // check naturally no-ops for that path.
  if (inv.stripe_invoice_id && inv.status === "failed") {
    const stripe = getStripe();
    if (!stripe) return { error: "stripe not configured — cannot void the Stripe-side invoice" };
    const voidResult = await voidStripeInvoice(stripe, inv.stripe_invoice_id);
    if ("error" in voidResult) return { error: voidResult.error };
    if ("alreadyPaid" in voidResult) {
      return { error: "Stripe reports this invoice as already paid/settled — refresh; do not void" };
    }
    // ok (includes already-void) — fall through to the local void.
  }

  const { data, error } = await sb
    .from("billing_invoices")
    .update({ status: "voided" })
    .eq("id", invoiceId)
    .in("status", ["pending_review", "failed"])
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "invoice is no longer voidable" };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

/** Re-pull rollups + purchases and rebuild the snapshot (e.g. after refunds). */
export async function recomputeInvoiceAction(invoiceId: string, force = false) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { data: inv, error } = await sb
    .from("billing_invoices")
    .select("id, merchant_id, kind, period_start, period_end, status, edited")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review") return { error: "only pending invoices recompute" };
  if (inv.kind !== "monthly") return { error: "plan-start invoices are fixed" };
  // Voided periods are intentionally never redrafted by the cron — void is
  // not a remediation path for an edited invoice. `force` is the only way
  // to discard manual edits and recompute in place (the update below already
  // resets edited: false).
  if (inv.edited && !force)
    return {
      error: "invoice has manual edits — use Recompute (discard edits) to overwrite them",
    };

  const { data: m } = await sb
    .from("merchants")
    .select("billing_anchor, rev_share_pct, base_fee_cents, base_fee_waived")
    .eq("id", inv.merchant_id)
    .single();
  if (!m?.billing_anchor) return { error: "merchant has no billing anchor" };

  const metrics = await computePeriodMetrics(
    sb,
    inv.merchant_id,
    new Date(m.billing_anchor),
    new Date(inv.period_start),
    new Date(inv.period_end),
  );
  const comp = computeInvoice({
    impA: metrics.impA,
    trimmedRevACents: metrics.trimmedRevACents,
    impB: metrics.impB,
    trimmedRevBCents: metrics.trimmedRevBCents,
    revSharePct: Number(m.rev_share_pct),
    baseFeeCents: m.base_fee_cents,
    baseFeeWaived: m.base_fee_waived,
  });
  const { error: upErr } = await sb
    .from("billing_invoices")
    .update({
      snapshot: buildSnapshot(metrics, comp, {
        rev_share_pct: Number(m.rev_share_pct),
        base_fee_cents: m.base_fee_cents,
        base_fee_waived: m.base_fee_waived,
      }),
      base_fee_cents: comp.baseFeeCents,
      rev_share_cents: comp.revShareCents,
      total_cents: comp.totalCents,
      edited: false,
    })
    .eq("id", inv.id);
  if (upErr) return { error: upErr.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}
