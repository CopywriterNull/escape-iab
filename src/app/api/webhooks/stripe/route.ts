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
        // Unguarded by design: a throw here surfaces as a 5xx to Stripe, which
        // retries delivery — safe and idempotent, so no try/catch is needed.
        await stripe.customers.update(String(session.customer), {
          invoice_settings: { default_payment_method: String(si.payment_method) },
        });
      }
    }
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const rowId = invoice.metadata?.billing_invoice_id;
    const status = event.type === "invoice.paid" ? "paid" : "failed";
    // Ordering rule: paid (and voided) is terminal; late payment_failed events
    // must not downgrade a row that's already settled.
    if (rowId) {
      // Reconciliation path: an invoice can get stuck in "charging" if the
      // local write after stripe.invoices.finalizeInvoice() failed (e.g. a
      // crash between charging chargeInvoice() and its own bookkeeping). The
      // webhook is the fallback that still lands stripe_invoice_id (and, on
      // the first paid event, charged_at) even when that earlier write never
      // happened — not just the status.
      const update: Record<string, unknown> = { status, stripe_invoice_id: invoice.id };
      if (event.type === "invoice.paid") {
        const { error } = await sb.from("billing_invoices").update(update).eq("id", rowId);
        if (error) {
          console.error("stripe webhook: db write failed", event.type, invoice.id, rowId, error);
          return new Response("db write failed", { status: 500 });
        }
        // Atomic charged_at backfill: only set it the first time it's null.
        const { error: chargedAtError } = await sb
          .from("billing_invoices")
          .update({ charged_at: new Date().toISOString() })
          .eq("id", rowId)
          .is("charged_at", null);
        if (chargedAtError) {
          console.error(
            "stripe webhook: db write failed",
            event.type,
            invoice.id,
            rowId,
            chargedAtError,
          );
          return new Response("db write failed", { status: 500 });
        }
      } else {
        const { error } = await sb
          .from("billing_invoices")
          .update(update)
          .eq("id", rowId)
          .in("status", ["charging", "failed", "pending_review"]);
        if (error) {
          console.error("stripe webhook: db write failed", event.type, invoice.id, rowId, error);
          return new Response("db write failed", { status: 500 });
        }
      }
    } else if (invoice.id) {
      // Fallback join by stripe_invoice_id (no metadata to key off of) —
      // status only, mirroring the brief.
      if (event.type === "invoice.paid") {
        const { error } = await sb
          .from("billing_invoices")
          .update({ status })
          .eq("stripe_invoice_id", invoice.id);
        if (error) {
          console.error("stripe webhook: db write failed", event.type, invoice.id, "n/a", error);
          return new Response("db write failed", { status: 500 });
        }
      } else {
        const { error } = await sb
          .from("billing_invoices")
          .update({ status })
          .eq("stripe_invoice_id", invoice.id)
          .in("status", ["charging", "failed", "pending_review"]);
        if (error) {
          console.error("stripe webhook: db write failed", event.type, invoice.id, "n/a", error);
          return new Response("db write failed", { status: 500 });
        }
      }
    }
  }
  return new Response("ok");
}
