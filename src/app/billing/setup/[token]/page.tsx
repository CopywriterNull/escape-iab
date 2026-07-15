import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createSetupCheckoutSession, ensureCustomer, getStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export default async function BillingSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sb = getSupabaseAdmin();
  const stripe = getStripe();
  if (!sb || !stripe) notFound();
  const { data: m } = await sb
    .from("merchants")
    .select("id, name, stripe_customer_id")
    .eq("billing_setup_token", token)
    .single();
  if (!m) notFound();
  const customerId = await ensureCustomer(stripe, m, sb);
  const { url } = await createSetupCheckoutSession(stripe, customerId, token);
  redirect(url);
}
