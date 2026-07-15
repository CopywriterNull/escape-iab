import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { siteOrigin } from "@/lib/site";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function ensureCustomer(
  stripe: Stripe,
  merchant: { id: string; name: string | null; stripe_customer_id: string | null },
  sb: SupabaseClient,
): Promise<string> {
  if (merchant.stripe_customer_id) return merchant.stripe_customer_id;
  const customer = await stripe.customers.create({
    name: merchant.name ?? undefined,
    metadata: { merchant_id: merchant.id },
  });
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

/** Creates an itemized invoice and auto-collects the saved card.
 *  charge_automatically + explicit pay() so the attempt is immediate and
 *  failures still ride Stripe smart retries. */
export async function chargeInvoice(
  stripe: Stripe,
  opts: {
    customerId: string;
    merchantId: string;
    invoiceRowId: string;
    lines: { description: string; amountCents: number }[];
  },
): Promise<{ stripeInvoiceId: string }> {
  const invoice = await stripe.invoices.create({
    customer: opts.customerId,
    collection_method: "charge_automatically",
    auto_advance: true,
    metadata: { merchant_id: opts.merchantId, billing_invoice_id: opts.invoiceRowId },
  });
  for (const line of opts.lines) {
    if (line.amountCents <= 0) continue;
    await stripe.invoiceItems.create({
      customer: opts.customerId,
      invoice: invoice.id,
      amount: line.amountCents,
      currency: "usd",
      description: line.description,
    });
  }
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  try {
    await stripe.invoices.pay(finalized.id);
  } catch {
    // Card declined etc. — webhook will mark failed; smart retries take over.
  }
  return { stripeInvoiceId: finalized.id };
}
