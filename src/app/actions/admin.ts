"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

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
  return isAdminEmail(user?.email);
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

  // Post-migration, merchants.user_id alone no longer grants read access —
  // the only merchants SELECT policy is membership-based. Create the owner
  // membership row too, so the assign-to-me flow actually resolves a
  // workspace instead of landing on the "No workspace yet" card.
  await admin
    .from("merchant_members")
    .upsert(
      { merchant_id: id, user_id: user.id, role: "owner" },
      { onConflict: "merchant_id,user_id", ignoreDuplicates: true },
    );

  revalidateMerchantSurfaces(id);
}

/** Admin kill switch. Disabling leaves install code in place but stops escape
 * behavior on the hosted snippet and lets ingest endpoints ignore old pixels. */
export async function setMerchantEnabledAsAdmin(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "").trim();
  const enabled = formData.get("enabled") === "true";
  if (!UUID_RE.test(id)) return;

  await admin.from("merchants").update({ escape_enabled: enabled }).eq("id", id);
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

/** Best-effort detection of the merchant's *.myshopify.com admin domain from
 *  the public storefront HTML. Operators still review/save manually when the
 *  storefront does not expose it. */
export async function detectMerchantShopifyDomain(formData: FormData) {
  if (!(await requireAdmin())) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  if (!UUID_RE.test(id) || !domain) return;

  const url = normalizeStorefrontUrl(domain);
  if (!url) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    html = (await res.text()).slice(0, 2_000_000);
  } catch {
    clearTimeout(timer);
    return;
  }
  clearTimeout(timer);

  const detected = detectMyshopifyDomain(html);
  if (!detected) return;

  await admin.from("merchants").update({ shopify_domain: detected }).eq("id", id);
  revalidateMerchantSurfaces(id);
}

function normalizeStorefrontUrl(domain: string): string | null {
  try {
    const raw = domain.startsWith("http://") || domain.startsWith("https://")
      ? domain
      : `https://${domain}`;
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function detectMyshopifyDomain(html: string): string | null {
  const matches = html.match(/[a-z0-9][a-z0-9-]*\.myshopify\.com/gi) ?? [];
  for (const m of matches) {
    const cleaned = m.toLowerCase();
    if (!cleaned.startsWith("cdn.") && !cleaned.startsWith("shopify.")) {
      return cleaned;
    }
  }
  return null;
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
