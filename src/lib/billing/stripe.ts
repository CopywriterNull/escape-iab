import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Pin to the API version the installed SDK's types are built against
  // (node_modules/stripe/cjs/apiVersion.d.ts) so wire behavior can't drift
  // out from under our types via an account-default version change.
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

export async function ensureCustomer(
  stripe: Stripe,
  merchant: { id: string; name: string | null; stripe_customer_id: string | null },
  sb: SupabaseClient,
): Promise<string> {
  if (merchant.stripe_customer_id) return merchant.stripe_customer_id;
  // Idempotency key: concurrent/retried calls for the same merchant converge
  // on the same Stripe customer instead of creating duplicates.
  const customer = await stripe.customers.create(
    {
      name: merchant.name ?? undefined,
      metadata: { merchant_id: merchant.id },
    },
    { idempotencyKey: `eh-cust-${merchant.id}` },
  );
  const { error } = await sb
    .from("merchants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", merchant.id);
  if (error) throw new Error(`persist customer id: ${error.message}`);
  return customer.id;
}

export async function createSetupCheckoutSession(
  stripe: Stripe,
  customerId: string,
  token: string,
): Promise<{ url: string }> {
  const origin = siteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${origin}/billing/setup/${token}/done`,
    cancel_url: `${origin}/billing/setup/${token}`,
  });
  if (!session.url) throw new Error("checkout session has no url");
  return { url: session.url };
}

/** Creates an itemized invoice and lets Stripe auto-collect the saved card.
 *  With collection_method: "charge_automatically" + auto_advance, Stripe
 *  itself attempts collection right after finalization and runs smart
 *  retries + dunning on failure — the invoice.paid / invoice.payment_failed
 *  webhooks are our source of truth. We deliberately do NOT call
 *  invoices.pay() here: that would be a second, immediate charge attempt
 *  against the same card on top of Stripe's own auto-collection. */
export async function chargeInvoice(
  stripe: Stripe,
  opts: {
    customerId: string;
    merchantId: string;
    invoiceRowId: string;
    lines: { description: string; amountCents: number }[];
  },
): Promise<{ stripeInvoiceId: string }> {
  const invoice = await stripe.invoices.create(
    {
      customer: opts.customerId,
      collection_method: "charge_automatically",
      auto_advance: true,
      metadata: { merchant_id: opts.merchantId, billing_invoice_id: opts.invoiceRowId },
    },
    { idempotencyKey: `eh-inv-${opts.invoiceRowId}` },
  );
  try {
    for (let i = 0; i < opts.lines.length; i++) {
      const line = opts.lines[i];
      if (line.amountCents <= 0) continue;
      await stripe.invoiceItems.create(
        {
          customer: opts.customerId,
          invoice: invoice.id,
          amount: line.amountCents,
          currency: "usd",
          description: line.description,
        },
        { idempotencyKey: `eh-item-${opts.invoiceRowId}-${i}` },
      );
    }
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    if (!finalized.id) throw new Error("finalized invoice has no id");
    return { stripeInvoiceId: finalized.id };
  } catch (err) {
    // The invoice is still a draft at this point (finalization either
    // hasn't happened or threw) — drafts are deleted, not voided. Clean it
    // up so auto_advance can't silently finalize and charge it ~1h later
    // with no billing_invoices record pointing at it.
    try {
      await stripe.invoices.del(invoice.id);
    } catch (delErr) {
      console.error(`failed to delete orphaned draft invoice ${invoice.id}`, delErr);
    }
    throw err;
  }
}
