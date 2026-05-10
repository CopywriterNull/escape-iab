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
    <div className="min-h-dvh flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-5 h-12 flex items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold tracking-tight focus-ring rounded-md text-[13.5px]"
            >
              <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
                <svg viewBox="0 0 24 24" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 4h6v6" />
                  <path d="M20 4l-8 8" />
                  <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
                </svg>
              </span>
              <span>{brand.name}</span>
              <span className="kbd ml-1">prod</span>
            </Link>
            <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
              <NavLink href="/dashboard">Overview</NavLink>
              <NavLink href="/dashboard/install">Install</NavLink>
              <NavLink href="/dashboard/settings">Settings</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <div className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-fg-muted)]">
              <span className="size-1.5 rounded-full bg-[var(--color-success)] pulse-ring" />
              <span>{user.email}</span>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[12.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="relative flex-1">
        <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
      </main>
      {!merchant ? (
        <div className="mx-auto max-w-7xl px-5 pb-6 text-xs text-[var(--color-fg-muted)] font-mono">
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
      className="px-2.5 py-1 rounded-md text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors focus-ring"
    >
      {children}
    </Link>
  );
}
