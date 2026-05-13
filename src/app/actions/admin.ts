"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

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

  await admin
    .from("merchants")
    .insert({
      name,
      domain,
      plan: "free",
      ab_enabled: true,
      fallback_button: true,
    });

  revalidatePath("/admin");
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
