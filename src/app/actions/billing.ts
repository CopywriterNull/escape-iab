"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { siteOrigin } from "@/lib/site";
import { computeInvoice } from "@/lib/billing/math";
import { buildSnapshot, computePeriodMetrics } from "@/lib/billing/data";
import { chargeInvoice, ensureCustomer, getStripe } from "@/lib/billing/stripe";

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
  if (m.billing_status === "active") return { error: "plan already active" };
  if (!m.stripe_customer_id) return { error: "no card on file — send the setup link first" };

  const customer = await stripe.customers.retrieve(m.stripe_customer_id);
  if (customer.deleted || !customer.invoice_settings?.default_payment_method) {
    return { error: "no default payment method — merchant must complete the setup link" };
  }

  const anchor = new Date();
  const { error: upErr } = await sb
    .from("merchants")
    .update({ billing_status: "active", billing_anchor: anchor.toISOString(), ab_split_pct: 90 })
    .eq("id", merchantId);
  if (upErr) return { error: upErr.message };

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
    })
    .select("id")
    .single();
  if (insErr || !row) return { error: insErr?.message ?? "invoice insert failed" };

  if (baseFee > 0) {
    try {
      const { stripeInvoiceId } = await chargeInvoice(stripe, {
        customerId: m.stripe_customer_id,
        merchantId,
        invoiceRowId: row.id,
        lines: [{ description: "EscapeHatch platform fee — month 1", amountCents: baseFee }],
      });
      await sb
        .from("billing_invoices")
        .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
        .eq("id", row.id);
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
  const { error } = await sb
    .from("billing_invoices")
    .update({
      base_fee_cents: baseFeeCents,
      rev_share_cents: revShareCents,
      total_cents: baseFeeCents + revShareCents,
      edited: true,
      note: note || null,
    })
    .eq("id", invoiceId)
    .eq("status", "pending_review"); // never edit after charge
  if (error) return { error: error.message };
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
      "id, merchant_id, base_fee_cents, rev_share_cents, total_cents, status, stripe_invoice_id, snapshot, period_start, period_end, note",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review" && inv.status !== "failed")
    return { error: `cannot charge from status ${inv.status}` };
  if (inv.stripe_invoice_id && inv.status !== "failed")
    return { error: "already has a stripe invoice" };
  if (inv.total_cents <= 0) return { error: "total is $0 — void it instead" };

  const { data: m } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id")
    .eq("id", inv.merchant_id)
    .single();
  if (!m?.stripe_customer_id) return { error: "merchant has no stripe customer" };

  await sb.from("billing_invoices").update({ status: "charging" }).eq("id", inv.id);

  const period = `${inv.period_start.slice(0, 10)} → ${inv.period_end.slice(0, 10)}`;
  const snap = (inv.snapshot ?? {}) as { incrementalCents?: number; revSharePct?: number };
  const lines = [
    {
      description: `Performance fee — ${snap.revSharePct ?? 10}% of $${((snap.incrementalCents ?? 0) / 100).toFixed(2)} incremental revenue (${period})`,
      amountCents: inv.rev_share_cents,
    },
    { description: "EscapeHatch platform fee — next period", amountCents: inv.base_fee_cents },
  ];
  try {
    const { stripeInvoiceId } = await chargeInvoice(stripe, {
      customerId: m.stripe_customer_id,
      merchantId: m.id,
      invoiceRowId: inv.id,
      lines,
    });
    await sb
      .from("billing_invoices")
      .update({ stripe_invoice_id: stripeInvoiceId, charged_at: new Date().toISOString() })
      .eq("id", inv.id);
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
  const { error } = await sb
    .from("billing_invoices")
    .update({ status: "voided" })
    .eq("id", invoiceId)
    .in("status", ["pending_review", "failed"]);
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { ok: true as const };
}

/** Re-pull rollups + purchases and rebuild the snapshot (e.g. after refunds). */
export async function recomputeInvoiceAction(invoiceId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { data: inv, error } = await sb
    .from("billing_invoices")
    .select("id, merchant_id, kind, period_start, period_end, status")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) return { error: error?.message ?? "invoice not found" };
  if (inv.status !== "pending_review") return { error: "only pending invoices recompute" };
  if (inv.kind !== "monthly") return { error: "plan-start invoices are fixed" };

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
