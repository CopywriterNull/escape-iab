"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentMerchant } from "@/lib/db";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

export async function updateMerchantSettings(formData: FormData) {
  // Resolve which merchant the *current view* is showing (honors the
  // impersonation cookie for admins). This is the ONLY merchant we will
  // ever write to from this action.
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    redirect("/dashboard/settings?saved=0&err=no_merchant");
  }

  // Defensive cross-check: the form embeds a hidden merchant_id snapshot
  // of which row was rendered. If the cookie has shifted between render
  // and submit (e.g. user opened settings, then "Exit impersonation"
  // before saving), abort rather than write to the wrong row.
  const formMerchantId = String(formData.get("merchant_id") ?? "").trim();
  if (formMerchantId && formMerchantId !== merchant.id) {
    redirect("/dashboard/settings?saved=0&err=merchant_mismatch");
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    redirect("/dashboard/settings?saved=0&err=no_supabase");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const owns = merchant.user_id === user.id;
  if (!owns && !isAdmin) {
    redirect("/dashboard/settings?saved=0&err=forbidden");
  }

  const ab = formData.get("ab_enabled") === "on";
  const fb = formData.get("fallback_button") === "on";
  const escape = formData.get("escape_enabled") === "on";
  const paidOnly = formData.get("paid_only") === "on";
  const escapeInstagram = formData.get("escape_instagram") === "on";
  const escapeThreads = formData.get("escape_threads") === "on";
  const escapeFacebook = formData.get("escape_facebook") === "on";
  const escapeMessenger = formData.get("escape_messenger") === "on";
  const escapeDiscord = formData.get("escape_discord") === "on";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120) || null;
  const fallback = String(formData.get("fallback_text") ?? "").trim().slice(0, 60) || null;
  // A/B split — value is the % of in-test traffic placed in bucket A.
  // Parse defensively; clamp to [1, 99] to match DB check + snippet builder.
  const rawSplit = parseInt(String(formData.get("ab_split_pct") ?? ""), 10);
  const abSplitPct = Number.isFinite(rawSplit)
    ? Math.min(99, Math.max(1, rawSplit))
    : 50;

  // Service role only for the admin-impersonating-other-merchant path so
  // RLS doesn't block writes on rows the admin doesn't own. Owners go
  // through their auth context so RLS still governs regular users.
  const client = isAdmin && !owns ? getSupabaseAdmin() : supabase;
  if (!client) {
    redirect("/dashboard/settings?saved=0&err=no_client");
  }

  // Base set of fields that have existed since the earliest migrations.
  // Everything in here is safe to write on any deployed schema.
  const baseUpdate = {
    ab_enabled: ab,
    fallback_button: fb,
    escape_enabled: escape,
    paid_only: paidOnly,
    escape_instagram: escapeInstagram,
    escape_threads: escapeThreads,
    escape_facebook: escapeFacebook,
    escape_messenger: escapeMessenger,
    escape_discord: escapeDiscord,
    fallback_text: fallback,
    name,
    domain,
  };

  let { error } = await client
    .from("merchants")
    .update({ ...baseUpdate, ab_split_pct: abSplitPct })
    .eq("id", merchant.id);

  // Postgres SQLSTATE 42703 = undefined_column. If migration 0016 isn't
  // applied yet on this environment, gracefully degrade: write everything
  // except ab_split_pct so the rest of the settings save isn't blocked.
  // Operator sees a console warning but the save still succeeds.
  if (
    error &&
    (error as { code?: string }).code === "42703" &&
    /ab_split_pct/i.test(error.message ?? "")
  ) {
    console.warn(
      "[updateMerchantSettings] ab_split_pct column missing — skipping that field. Apply migration 0016.",
    );
    ({ error } = await client.from("merchants").update(baseUpdate).eq("id", merchant.id));
  }

  if (error) {
    console.error("[updateMerchantSettings] update failed", { id: merchant.id, error });
    redirect(`/dashboard/settings?saved=0&err=${encodeURIComponent(error.message)}`);
  }

  // Revalidate every surface that might display this merchant.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/merchants");
  revalidatePath("/admin/diagnostics");
  // Invalidate the served snippet so config changes propagate within
  // seconds instead of waiting for the 1h edge cache TTL.
  revalidatePath(`/s/${merchant.id}.js`);
  redirect("/dashboard/settings?saved=1");
}
