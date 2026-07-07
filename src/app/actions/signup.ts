"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ACTIVE_MERCHANT_COOKIE, getMemberships } from "@/lib/db";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const PLATFORMS = ["shopify", "woocommerce", "custom", "other"] as const;

export async function createPendingMerchant(formData: FormData) {
  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/signup?err=no_backend");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  // One workspace per self-serve signup: users who already belong
  // somewhere go to their dashboard instead of minting another
  // pending merchant on a double-submit or revisit.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().slice(0, 120);
  const platformRaw = String(formData.get("platform") ?? "");
  const platform = (PLATFORMS as readonly string[]).includes(platformRaw)
    ? platformRaw
    : "other";
  if (!name || !domain) redirect("/signup?err=missing_fields");

  const admin = getSupabaseAdmin();
  if (!admin) redirect("/signup?err=no_backend");

  // status=pending routes the dashboard into the approval experience;
  // escape_enabled=false keeps the hosted snippet inert until approval.
  const { data: merchant, error } = await admin
    .from("merchants")
    .insert({
      name,
      domain,
      platform,
      plan: "free",
      ab_enabled: true,
      fallback_button: true,
      escape_enabled: false,
      status: "pending",
      user_id: user.id,
    })
    .select("id")
    .single();
  if (error || !merchant) {
    console.error("[createPendingMerchant] insert failed", error);
    redirect("/signup?err=create_failed");
  }

  const { error: memberError } = await admin.from("merchant_members").insert({
    merchant_id: merchant.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) {
    // Membership is what grants access — a merchant row without one is
    // an orphan the user can never see. Roll it back and surface the error.
    console.error("[createPendingMerchant] membership failed", memberError);
    await admin.from("merchants").delete().eq("id", merchant.id);
    redirect("/signup?err=create_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MERCHANT_COOKIE, merchant.id as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin/merchants");
  redirect("/dashboard");
}
