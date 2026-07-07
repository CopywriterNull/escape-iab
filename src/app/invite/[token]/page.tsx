import Link from "next/link";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";
import { UUID_RE } from "@/lib/uuid";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";
import { acceptInvitation } from "@/app/actions/team";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 mesh-bg grain relative">
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative w-full max-w-sm card-hi p-8">{children}</div>
    </div>
  );
}

function ErrorCard({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="h-display text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-fg-dim)]">{body}</p>
      <Link
        href="/login"
        className="mt-5 inline-flex text-sm text-[var(--color-accent)] link-grow"
      >
        Go to sign in →
      </Link>
    </Shell>
  );
}

type InviteWithMerchant = {
  id: string;
  merchant_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  merchants: { name: string | null; domain: string | null } | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) {
    return (
      <ErrorCard
        title="Invalid invitation"
        body="This invite link is malformed. Ask your workspace admin to send a new one."
      />
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return (
      <ErrorCard
        title="Backend not configured"
        body="Invitations aren't available in this environment."
      />
    );
  }

  const { data } = await admin
    .from("invitations")
    .select("id, merchant_id, email, role, status, expires_at, merchants ( name, domain )")
    .eq("token", token)
    .maybeSingle();
  const invite = data as InviteWithMerchant | null;

  if (!invite) {
    return (
      <ErrorCard
        title="Invitation not found"
        body="This invite link doesn't exist. Ask your workspace admin to re-invite you."
      />
    );
  }
  if (invite.status === "revoked") {
    return (
      <ErrorCard
        title="Invitation revoked"
        body="This invitation was revoked. Ask your workspace admin to re-invite you."
      />
    );
  }
  if (invite.status === "accepted") {
    return (
      <ErrorCard
        title="Invitation already used"
        body="This invitation has already been accepted. If that was you, just sign in."
      />
    );
  }
  if (invite.status === "expired" || new Date(invite.expires_at) < new Date()) {
    return (
      <ErrorCard
        title="Invitation expired"
        body="Invite links last 7 days. Ask your workspace admin to re-send it."
      />
    );
  }

  const workspaceName = invite.merchants?.name ?? invite.merchants?.domain ?? "a workspace";

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (!user) {
    return (
      <Shell>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          You're invited
        </div>
        <h1 className="mt-1 h-display text-2xl">
          Join {workspaceName} on {brand.name}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
          Sign in as <strong className="text-[var(--color-fg)]">{invite.email}</strong> to
          accept this invitation. We'll email you a magic link.
        </p>
        <LoginForm initialEmail={invite.email} next={`/invite/${token}`} />
      </Shell>
    );
  }

  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Shell>
        <h1 className="h-display text-2xl">Wrong account</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
          This invitation is for{" "}
          <strong className="text-[var(--color-fg)]">{invite.email}</strong>, but you're
          signed in as <strong className="text-[var(--color-fg)]">{user.email}</strong>.
          Sign out, then open the invite link again.
        </p>
        <form action={signOut} className="mt-5">
          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          >
            Sign out
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
        You're invited
      </div>
      <h1 className="mt-1 h-display text-2xl">Join {workspaceName}</h1>
      <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
        You'll join as a{" "}
        <strong className="text-[var(--color-fg)]">{invite.role}</strong> with the account{" "}
        <strong className="text-[var(--color-fg)]">{user.email}</strong>.
      </p>
      <form action={acceptInvitation} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Accept invitation
        </button>
      </form>
    </Shell>
  );
}
