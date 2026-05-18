"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";
const IMP_COOKIE = "eh_imp_merchant_id";

// UUID guard: every admin merchant write must filter by a real PK shape.
// Prevents any chance of accidental "match many rows" if a form field
// arrived empty or partially typed.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin(): Promise<boolean> {
  const supabase = await getSupabaseServer();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function revalidateMerchantSurfaces(merchantId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/merchants");
  revalidatePath("/admin/diagnostics");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  // Per-merchant snippet route lives behind a 1h edge cache. Invalidate
  // explicitly when the merchant's config could have changed so the new
  // body is served on the next pageview instead of waiting for TTL.
  if (merchantId) revalidatePath(`/s/${merchantId}.js`);
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

  revalidateMerchantSurfaces(data?.id);
  if (data?.id) redirect(`/install/${data.id}`);
}

export async function deleteMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return;

  await admin.from("merchants").delete().eq("id", id);
  revalidateMerchantSurfaces(id);
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
  if (!UUID_RE.test(id)) return;

  await admin.from("merchants").update({ user_id: user.id }).eq("id", id);
  revalidateMerchantSurfaces(id);
}

/** Rename a merchant (name + domain). For fixing miskeyed/overwritten rows.
 *  Filters by strict UUID `id` only — no fallback. Every code path that
 *  could write to merchants goes through here for admin renames. */
export async function renameMerchantAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120);
  if (!UUID_RE.test(id) || !name) return;
  await admin
    .from("merchants")
    .update({ name, domain: domain || null })
    .eq("id", id);
  revalidateMerchantSurfaces(id);
}

/** Set or clear a merchant's Shopify *.myshopify.com admin domain. */
export async function setMerchantShopifyDomain(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "").trim();
  const raw = String(formData.get("shopify_domain") ?? "").trim().toLowerCase();
  if (!UUID_RE.test(id)) return;
  const shopify_domain = raw || null;
  await admin.from("merchants").update({ shopify_domain }).eq("id", id);
  revalidateMerchantSurfaces(id);
}

/** Set the impersonation cookie + jump into the dashboard as that merchant. */
export async function impersonateMerchant(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) return;
  const cookieStore = await cookies();
  cookieStore.set(IMP_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });
  redirect("/dashboard");
}

/** Clear impersonation and return to the merchants list. */
export async function stopImpersonating() {
  const cookieStore = await cookies();
  cookieStore.delete(IMP_COOKIE);
  redirect("/admin/merchants");
}
