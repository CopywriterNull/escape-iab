"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { siteOrigin } from "@/lib/site";

async function requireAdmin(): Promise<{ error: string } | null> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { error: "backend not configured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAdminEmail(data.user.email)) return { error: "admin only" };
  return null;
}

function parsePct(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

export async function createReferrer(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const email = String(formData.get("email") ?? "").trim() || null;
  const pct = parsePct(formData.get("default_share_pct")) ?? 20;
  await sb.from("referrers").insert({ name, email, default_share_pct: pct });
  revalidatePath("/admin/referrers");
}

export async function updateReferrer(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  const email = String(formData.get("email") ?? "").trim() || null;
  const pct = parsePct(formData.get("default_share_pct"));
  await sb
    .from("referrers")
    .update({ name, email, ...(pct != null ? { default_share_pct: pct } : {}) })
    .eq("id", id);
  revalidatePath("/admin/referrers");
}

export async function deleteReferrer(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // merchants.referrer_id is ON DELETE SET NULL — assignments detach cleanly.
  await sb.from("referrers").delete().eq("id", id);
  revalidatePath("/admin/referrers");
}

/** Assign (or move) a merchant to a referrer, with an optional per-merchant
 *  share override. Also mints the merchant's billing_view_token if missing so
 *  the partner page can always deep-link the brand's live dashboard. */
export async function assignMerchantReferrer(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const merchantId = String(formData.get("merchant_id") ?? "");
  const referrerId = String(formData.get("referrer_id") ?? "");
  if (!merchantId || !referrerId) return;
  const overridePct = parsePct(formData.get("referral_share_pct"));
  await sb
    .from("merchants")
    .update({ referrer_id: referrerId, referral_share_pct: overridePct })
    .eq("id", merchantId);
  const { data: m } = await sb
    .from("merchants")
    .select("billing_view_token")
    .eq("id", merchantId)
    .maybeSingle();
  if (m && !m.billing_view_token) {
    await sb
      .from("merchants")
      .update({ billing_view_token: crypto.randomUUID().replace(/-/g, "") })
      .eq("id", merchantId)
      .is("billing_view_token", null);
  }
  revalidatePath("/admin/referrers");
}

export async function unassignMerchantReferrer(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const merchantId = String(formData.get("merchant_id") ?? "");
  if (!merchantId) return;
  await sb
    .from("merchants")
    .update({ referrer_id: null, referral_share_pct: null })
    .eq("id", merchantId);
  revalidatePath("/admin/referrers");
}

export async function setMerchantReferralPct(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const merchantId = String(formData.get("merchant_id") ?? "");
  if (!merchantId) return;
  await sb
    .from("merchants")
    .update({ referral_share_pct: parsePct(formData.get("referral_share_pct")) })
    .eq("id", merchantId);
  revalidatePath("/admin/referrers");
}

/** Partner dashboard link. Stable: mints the token once, same URL forever. */
export async function generatePartnerLink(referrerId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "backend not configured" };
  const { data: r, error: readErr } = await sb
    .from("referrers")
    .select("view_token")
    .eq("id", referrerId)
    .single();
  if (readErr || !r) return { error: readErr?.message ?? "referrer not found" };
  let token = r.view_token as string | null;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb
      .from("referrers")
      .update({ view_token: token })
      .eq("id", referrerId)
      .is("view_token", null);
    if (error) return { error: error.message };
    // Concurrent mint: re-read in case another request won the null-guard.
    const { data: after } = await sb
      .from("referrers")
      .select("view_token")
      .eq("id", referrerId)
      .single();
    token = (after?.view_token as string | null) ?? token;
    revalidatePath("/admin/referrers");
  }
  return { url: `${siteOrigin()}/partner/${token}` };
}
