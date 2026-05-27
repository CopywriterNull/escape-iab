import { getSupabaseAdmin } from "@/lib/supabase/server";

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export async function isMerchantDisabled(
  admin: AdminClient,
  merchantId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("merchants")
    .select("escape_enabled")
    .eq("id", merchantId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { escape_enabled?: boolean | null }).escape_enabled === false;
}
