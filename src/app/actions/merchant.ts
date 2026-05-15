"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMerchant } from "@/lib/db";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

export async function updateMerchantSettings(formData: FormData) {
  // getCurrentMerchant honors the eh_imp_merchant_id impersonation cookie
  // for admins, so this resolves the same row the settings page just rendered.
  const merchant = await getCurrentMerchant();
  if (!merchant) return;

  const supabase = await getSupabaseServer();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const owns = merchant.user_id === user.id;
  if (!owns && !isAdmin) return;

  const ab = formData.get("ab_enabled") === "on";
  const fb = formData.get("fallback_button") === "on";
  const escape = formData.get("escape_enabled") === "on";
  const paidOnly = formData.get("paid_only") === "on";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120) || null;
  const fallback = String(formData.get("fallback_text") ?? "").trim().slice(0, 60) || null;

  // Admin updating a merchant they don't own (impersonation path) needs the
  // service-role client to bypass RLS. Owner path uses their auth context so
  // RLS still applies to non-admins.
  const client = isAdmin && !owns ? getSupabaseAdmin() : supabase;
  if (!client) return;

  await client
    .from("merchants")
    .update({
      ab_enabled: ab,
      fallback_button: fb,
      escape_enabled: escape,
      paid_only: paidOnly,
      fallback_text: fallback,
      name,
      domain,
    })
    .eq("id", merchant.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=1");
}
