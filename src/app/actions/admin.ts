"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";
const IMP_COOKIE = "eh_imp_merchant_id";

async function requireAdmin(): Promise<boolean> {
  const supabase = await getSupabaseServer();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export async function createMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120);
  if (!name || !domain) return;

  const { data } = await admin
    .from("merchants")
    .insert({
      name,
      domain,
      plan: "free",
      ab_enabled: true,
      fallback_button: true,
    })
    .select("id")
    .single();

  revalidatePath("/admin");
  // Drop straight into the install guide for this new merchant — copy the URL
  // from the address bar, paste into a DM, you're done.
  if (data?.id) redirect(`/install/${data.id}`);
}

export async function deleteMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await admin.from("merchants").delete().eq("id", id);
  revalidatePath("/admin");
}

export async function assignMerchantToCurrentUser(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  if (!admin || !supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await admin.from("merchants").update({ user_id: user.id }).eq("id", id);
  revalidatePath("/admin");
}

/** Rename a merchant (name + domain). For fixing miskeyed/overwritten rows. */
export async function renameMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120);
  if (!id || !name) return;
  await admin
    .from("merchants")
    .update({ name, domain: domain || null })
    .eq("id", id);
  revalidatePath("/admin");
}

/** Set or clear a merchant's Shopify *.myshopify.com admin domain.
 *  This is what the order webhook handler matches X-Shopify-Shop-Domain
 *  against for multi-tenant routing.
 */
export async function setMerchantShopifyDomain(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  const raw = String(formData.get("shopify_domain") ?? "").trim().toLowerCase();
  if (!id) return;
  const shopify_domain = raw || null;
  await admin.from("merchants").update({ shopify_domain }).eq("id", id);
  revalidatePath("/admin");
}

/** Set the impersonation cookie + jump into the dashboard as that merchant. */
export async function impersonateMerchant(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const cookieStore = await cookies();
  cookieStore.set(IMP_COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
  redirect("/dashboard");
}

/** Clear impersonation and return to /admin. */
export async function stopImpersonating() {
  const cookieStore = await cookies();
  cookieStore.delete(IMP_COOKIE);
  redirect("/admin");
}
