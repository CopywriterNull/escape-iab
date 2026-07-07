import { redirect } from "next/navigation";
import { getCurrentMerchant, getCurrentRole } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  inviteMember,
  resendInvitation,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/app/actions/team";
import { CopyLinkButton } from "./_components/copy-link-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ msg?: string; email?: string }>;

type MemberRow = {
  id: string;
  user_id: string;
  email: string | null;
  role: "owner" | "member" | "viewer";
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
};

const MESSAGES: Record<string, { text: string; error: boolean }> = {
  invite_sent: { text: "Invitation email sent.", error: false },
  invite_created_no_email: {
    text: "Invite created — email delivery isn't configured, share the link below.",
    error: false,
  },
  invite_revoked: { text: "Invitation revoked.", error: false },
  member_removed: { text: "Member removed.", error: false },
  role_updated: { text: "Role updated.", error: false },
  role_unchanged: { text: "That member already has that role.", error: false },
  already_member: { text: "That email is already a member.", error: true },
  bad_email: { text: "Enter a valid email address.", error: true },
  bad_role: { text: "Pick a valid role.", error: true },
  last_owner: {
    text: "Every workspace needs at least one owner — promote someone else first.",
    error: true,
  },
  not_found: { text: "That invitation or member no longer exists.", error: true },
  invite_failed: { text: "Couldn't save the invitation — try again.", error: true },
  forbidden: { text: "Only owners can manage the team.", error: true },
  no_backend: { text: "Backend not configured.", error: true },
};

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://getescapehatch.com";
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [merchant, sp] = await Promise.all([getCurrentMerchant(), searchParams]);
  if (!merchant) redirect("/dashboard");
  const role = await getCurrentRole(merchant);
  // Spec §3: viewers have no team page; members get the read-only list.
  if (!role || role === "viewer") redirect("/dashboard");
  const isOwner = role === "owner";

  const admin = getSupabaseAdmin();
  const [membersRes, invitesRes] = admin
    ? await Promise.all([
        admin.rpc("eh_team_members", { p_merchant_id: merchant.id }),
        admin
          .from("invitations")
          .select("id, email, role, token, expires_at, created_at")
          .eq("merchant_id", merchant.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  const members = ((membersRes.data ?? []) as MemberRow[]);
  const invites = ((invitesRes.data ?? []) as InviteRow[]);
  const now = Date.now();

  const banner = sp.msg ? MESSAGES[sp.msg] : undefined;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Workspace
        </div>
        <h1 className="mt-1.5 h-display text-4xl">Team</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)] max-w-prose">
          {isOwner
            ? "Invite teammates and manage their access to this workspace."
            : "People with access to this workspace. Ask an owner to make changes."}
        </p>
      </div>

      {banner ? (
        <div
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            banner.error
              ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
              : "border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-fg)]"
          }`}
        >
          {banner.text}
          {sp.email ? <span className="font-mono text-[12px]"> ({sp.email})</span> : null}
        </div>
      ) : null}

      {isOwner ? (
        <section className="card-hi p-5">
          <h2 className="text-sm font-semibold tracking-tight">Invite a teammate</h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-fg-dim)]">
            They'll get an email with a link that expires in 7 days. Viewers can
            see reports only; members can also use the install page; owners can
            change settings and manage the team.
          </p>
          <form action={inviteMember} className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@brand.com"
              className="flex-1 px-3.5 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus-ring"
            />
            <select
              name="role"
              defaultValue="member"
              className="px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            >
              Send invite
            </button>
          </form>
        </section>
      ) : null}

      <section className="card-hi p-5">
        <h2 className="text-sm font-semibold tracking-tight">
          Members <span className="text-[var(--color-fg-muted)] font-normal">({members.length})</span>
        </h2>
        <div className="mt-3 divide-y divide-[var(--color-border-soft)]">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className="size-7 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[11px] font-semibold text-[var(--color-accent)] shrink-0">
                {m.email?.[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate">{m.email ?? m.user_id}</div>
                <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                  joined {new Date(m.created_at).toISOString().slice(0, 10)}
                </div>
              </div>
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <form action={updateMemberRole} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={m.id} />
                    <select
                      name="role"
                      defaultValue={m.role}
                      className="px-2 py-1 rounded-md bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[12px] focus-ring"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
                    >
                      Update
                    </button>
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] border border-[var(--color-border-soft)] transition-colors"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wide bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] text-[var(--color-fg-dim)]">
                  {m.role}
                </span>
              )}
            </div>
          ))}
          {members.length === 0 ? (
            <div className="py-4 text-sm text-[var(--color-fg-dim)]">No members found.</div>
          ) : null}
        </div>
      </section>

      {isOwner ? (
        <section className="card-hi p-5">
          <h2 className="text-sm font-semibold tracking-tight">
            Pending invitations{" "}
            <span className="text-[var(--color-fg-muted)] font-normal">({invites.length})</span>
          </h2>
          <div className="mt-3 divide-y divide-[var(--color-border-soft)]">
            {invites.map((inv) => {
              const expired = new Date(inv.expires_at).getTime() < now;
              return (
                <div key={inv.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{inv.email}</div>
                    <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                      {inv.role} ·{" "}
                      {expired ? (
                        <span className="text-[var(--color-danger)]">expired</span>
                      ) : (
                        `expires ${new Date(inv.expires_at).toISOString().slice(0, 10)}`
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyLinkButton url={`${siteOrigin()}/invite/${inv.token}`} />
                    <form action={resendInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border-soft)] transition-colors"
                      >
                        Resend
                      </button>
                    </form>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-md text-[11.5px] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] border border-[var(--color-border-soft)] transition-colors"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
            {invites.length === 0 ? (
              <div className="py-4 text-sm text-[var(--color-fg-dim)]">
                No pending invitations.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
