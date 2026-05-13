"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function updateMerchantSettings(formData: FormData) {
  const supabase = await getSupabaseServer();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const ab = formData.get("ab_enabled") === "on";
  const fb = formData.get("fallback_button") === "on";
  const escape = formData.get("escape_enabled") === "on";
  const paidOnly = formData.get("paid_only") === "on";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || null;
  const domain = String(formData.get("domain") ?? "").trim().slice(0, 120) || null;
  const fallback = String(formData.get("fallback_text") ?? "").trim().slice(0, 60) || null;

  await supabase
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
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}
