import Stripe from "stripe";
import { type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sb = getSupabaseAdmin();
  if (!stripe || !secret || !sb) return new Response("not configured", { status: 500 });

  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "setup" && session.customer && session.setup_intent) {
      const si = await stripe.setupIntents.retrieve(String(session.setup_intent));
      if (si.payment_method) {
        await stripe.customers.update(String(session.customer), {
          invoice_settings: { default_payment_method: String(si.payment_method) },
        });
      }
    }
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const rowId = invoice.metadata?.billing_invoice_id;
    const status = event.type === "invoice.paid" ? "paid" : "failed";
    if (rowId) {
      // Reconciliation path: an invoice can get stuck in "charging" if the
      // local write after stripe.invoices.finalizeInvoice() failed (e.g. a
      // crash between charging chargeInvoice() and its own bookkeeping). The
      // webhook is the fallback that still lands stripe_invoice_id (and, on
      // the first paid event, charged_at) even when that earlier write never
      // happened — not just the status.
      const update: Record<string, unknown> = { status, stripe_invoice_id: invoice.id };
      if (event.type === "invoice.paid") {
        const { data: existing } = await sb
          .from("billing_invoices")
          .select("charged_at")
          .eq("id", rowId)
          .maybeSingle();
        if (!existing?.charged_at) update.charged_at = new Date().toISOString();
      }
      await sb.from("billing_invoices").update(update).eq("id", rowId);
    } else if (invoice.id) {
      // Fallback join by stripe_invoice_id (no metadata to key off of) —
      // status only, mirroring the brief.
      await sb.from("billing_invoices").update({ status }).eq("stripe_invoice_id", invoice.id);
    }
  }
  return new Response("ok");
}
