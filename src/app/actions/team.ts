"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ACTIVE_MERCHANT_COOKIE,
  getCurrentMerchant,
  getCurrentRole,
  type Merchant,
} from "@/lib/db";
import type { MemberRole } from "@/lib/roles";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/uuid";
import { sendInviteEmail } from "@/lib/email";

const TEAM_PATH = "/dashboard/team";
const ROLES: readonly MemberRole[] = ["owner", "member", "viewer"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function teamRedirect(msg: string, extra: Record<string, string> = {}): never {
  const params = new URLSearchParams({ msg, ...extra });
  redirect(`${TEAM_PATH}?${params.toString()}`);
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://getescapehatch.com";
}

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Owner gate shared by every team mutation. Resolves the current merchant
 *  and requires role owner (admin allowlist counts as owner). All writes
 *  below use the service-role client and MUST scope every filter by
 *  merchant.id so an owner of workspace A can never touch workspace B. */
async function requireOwner(): Promise<{
  merchant: Merchant;
  admin: SupabaseAdminClient;
  userId: string;
  userEmail: string | null;
}> {
  const merchant = await getCurrentMerchant();
  if (!merchant) redirect("/dashboard");
  const role = await getCurrentRole(merchant);
  if (role !== "owner") teamRedirect("forbidden");
  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  if (!admin || !supabase) teamRedirect("no_backend");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { merchant, admin, userId: user.id, userEmail: user.email ?? null };
}

export async function inviteMember(formData: FormData) {
  const { merchant, admin, userId, userEmail } = await requireOwner();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!EMAIL_RE.test(email)) teamRedirect("bad_email");
  if (!ROLES.includes(role as MemberRole)) teamRedirect("bad_role");

  // Already a member → no-op with message (spec §3 edge case). Fail safe:
  // if the membership lookup errors we cannot prove non-membership, so
  // abort rather than risk a duplicate invite.
  const { data: members, error: membersError } = await admin.rpc("eh_team_members", {
    p_merchant_id: merchant.id,
  });
  if (membersError) teamRedirect("invite_failed");
  const memberRows = (members ?? []) as { email: string | null }[];
  if (memberRows.some((m) => (m.email ?? "").toLowerCase() === email)) {
    teamRedirect("already_member", { email });
  }

  // Existing pending invite for this address → refresh it instead of
  // inserting a duplicate row (keeps one live token per email).
  const { data: existing, error: existingError } = await admin
    .from("invitations")
    .select("id, token")
    .eq("merchant_id", merchant.id)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingError) teamRedirect("invite_failed");

  let token: string;
  if (existing) {
    token = existing.token as string;
    const { error } = await admin
      .from("invitations")
      .update({
        role,
        invited_by: userId,
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      })
      .eq("id", existing.id)
      .eq("merchant_id", merchant.id);
    if (error) teamRedirect("invite_failed");
  } else {
    const { data, error } = await admin
      .from("invitations")
      .insert({ merchant_id: merchant.id, email, role, invited_by: userId })
      .select("token")
      .single();
    if (error || !data) teamRedirect("invite_failed");
    token = data.token as string;
  }

  const acceptUrl = `${siteOrigin()}/invite/${token}`;
  const result = await sendInviteEmail({
    to: email,
    merchantName: merchant.name ?? merchant.domain ?? "your workspace",
    invitedBy: userEmail,
    role,
    acceptUrl,
  });

  revalidatePath(TEAM_PATH);
  teamRedirect(result.sent ? "invite_sent" : "invite_created_no_email", { email });
}

export async function resendInvitation(formData: FormData) {
  const { merchant, admin, userEmail } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  const { data: invite } = await admin
    .from("invitations")
    .select("id, email, role, token, status")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!invite || invite.status !== "pending") teamRedirect("not_found");

  const { error } = await admin
    .from("invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() })
    .eq("id", invite.id)
    .eq("merchant_id", merchant.id);
  if (error) teamRedirect("invite_failed");

  const acceptUrl = `${siteOrigin()}/invite/${invite.token}`;
  const result = await sendInviteEmail({
    to: invite.email as string,
    merchantName: merchant.name ?? merchant.domain ?? "your workspace",
    invitedBy: userEmail,
    role: invite.role as string,
    acceptUrl,
  });

  revalidatePath(TEAM_PATH);
  teamRedirect(result.sent ? "invite_sent" : "invite_created_no_email", {
    email: invite.email as string,
  });
}

export async function revokeInvitation(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  await admin
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .eq("status", "pending");

  revalidatePath(TEAM_PATH);
  teamRedirect("invite_revoked");
}

/** Shared guard: block removing/demoting the only owner (spec §3). */
async function assertNotLastOwner(
  admin: SupabaseAdminClient,
  merchantId: string,
): Promise<void> {
  const { count } = await admin
    .from("merchant_members")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("role", "owner");
  if ((count ?? 0) <= 1) teamRedirect("last_owner");
}

export async function removeMember(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  if (!UUID_RE.test(id)) teamRedirect("not_found");

  const { data: target } = await admin
    .from("merchant_members")
    .select("id, role")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!target) teamRedirect("not_found");
  if (target.role === "owner") await assertNotLastOwner(admin, merchant.id);

  await admin
    .from("merchant_members")
    .delete()
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  revalidatePath(TEAM_PATH);
  revalidatePath("/dashboard", "layout");
  teamRedirect("member_removed");
}

export async function updateMemberRole(formData: FormData) {
  const { merchant, admin } = await requireOwner();
  const id = String(formData.get("id") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  if (!UUID_RE.test(id)) teamRedirect("not_found");
  if (!ROLES.includes(role as MemberRole)) teamRedirect("bad_role");

  const { data: target } = await admin
    .from("merchant_members")
    .select("id, role")
    .eq("id", id)
    .eq("merchant_id", merchant.id)
    .maybeSingle();
  if (!target) teamRedirect("not_found");
  if (target.role === role) teamRedirect("role_unchanged");
  if (target.role === "owner" && role !== "owner") {
    await assertNotLastOwner(admin, merchant.id);
  }

  await admin
    .from("merchant_members")
    .update({ role })
    .eq("id", id)
    .eq("merchant_id", merchant.id);

  revalidatePath(TEAM_PATH);
  revalidatePath("/dashboard", "layout");
  teamRedirect("role_updated");
}

/** Invite accept — the only membership-creation path for non-admin users.
 *  Called from /invite/[token] after the page has already rendered the
 *  precise error state for bad tokens; failures here just bounce back to
 *  the page, which re-renders the current truth. */
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!UUID_RE.test(token)) redirect("/login");

  const supabase = await getSupabaseServer();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/invite/${token}`);

  const admin = getSupabaseAdmin();
  if (!admin) redirect(`/invite/${token}`);

  const { data: invite } = await admin
    .from("invitations")
    .select("id, merchant_id, email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (
    !invite ||
    invite.status !== "pending" ||
    new Date(invite.expires_at as string) < new Date() ||
    (user.email ?? "").toLowerCase() !== (invite.email as string).toLowerCase()
  ) {
    redirect(`/invite/${token}`);
  }

  const { error: memberError } = await admin.from("merchant_members").upsert(
    { merchant_id: invite.merchant_id, user_id: user.id, role: invite.role },
    { onConflict: "merchant_id,user_id", ignoreDuplicates: true },
  );
  if (memberError) redirect(`/invite/${token}`);

  await admin
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "pending");

  // Land the new member directly in the workspace they just joined.
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_MERCHANT_COOKIE, invite.merchant_id as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
