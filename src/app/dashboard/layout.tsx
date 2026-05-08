import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMerchant } from "@/lib/db";
import { supabaseConfigured, getSupabaseServer } from "@/lib/supabase/server";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center px-5 grain">
        <div className="max-w-md card-hi p-8">
          <h1 className="text-xl font-semibold tracking-tight">Backend not configured</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            Set <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and friends in your env to enable the dashboard.
          </p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-accent)] link-grow">
            Back to home →
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = (await supabase!.auth.getUser());
  if (!user) redirect("/login");

  const merchant = await getCurrentMerchant();

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--color-bg)] grain">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold tracking-tight focus-ring rounded-md"
          >
            <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: "var(--color-accent)" }}>
              <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14a8 8 0 1 0 8-8" />
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
              </svg>
            </span>
            <span>{brand.name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink href="/dashboard">Overview</NavLink>
            <NavLink href="/dashboard/install">Install</NavLink>
            <NavLink href="/dashboard/settings">Settings</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-fg-dim)]">
              <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
              {user.email}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1.5 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="relative flex-1">
        <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      </main>
      {!merchant ? (
        <div className="mx-auto max-w-6xl px-6 pb-6 text-xs text-[var(--color-fg-muted)]">
          Provisioning your merchant record…
        </div>
      ) : null}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors focus-ring"
    >
      {children}
    </Link>
  );
}
