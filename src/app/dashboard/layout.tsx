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
      <div className="min-h-dvh grid place-items-center px-5">
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
    <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)]/40 sticky top-0 h-dvh">
        <div className="px-4 h-14 flex items-center gap-2.5 border-b border-[var(--color-border)]">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight focus-ring rounded-md text-[14px]">
            <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            <span>{brand.name}</span>
          </Link>
        </div>

        <div className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          <SidebarSection label="Workspace" />
          <NavLink href="/dashboard" icon={<HomeIcon />}>Overview</NavLink>
          <NavLink href="/dashboard/install" icon={<TerminalIcon />}>Install</NavLink>
          <NavLink href="/dashboard/settings" icon={<CogIcon />}>Settings</NavLink>

          <div className="mt-auto" />

          <div className="mt-4 mx-2 px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="text-[10px] uppercase tracking-[0.08em] font-mono text-[var(--color-fg-muted)] font-medium">
              Test status
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px]">
              <span className={`size-1.5 rounded-full ${merchant?.ab_enabled ? "bg-[var(--color-success)] pulse-ring" : "bg-[var(--color-fg-muted)]"}`} />
              {merchant?.ab_enabled ? "A/B 50/50" : "A/B off"}
            </div>
            {merchant?.domain ? (
              <div className="mt-1 text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
                {merchant.domain}
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-3 py-3 border-t border-[var(--color-border)]">
          <div className="px-2 pb-2 flex items-center gap-2 min-w-0">
            <span className="size-7 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[11px] font-semibold text-[var(--color-accent)] shrink-0">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <div className="text-[12px] truncate" title={user.email ?? ""}>{user.email}</div>
              <div className="text-[10.5px] font-mono text-[var(--color-fg-muted)]">prod</div>
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left text-[12px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-card)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar (sidebar collapsed) */}
      <header className="md:hidden border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur sticky top-0 z-30 w-full">
        <div className="px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight text-[14px]">
            <span aria-hidden className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4l-8 8" />
                <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
              </svg>
            </span>
            {brand.name}
          </Link>
          <nav className="flex items-center gap-3 text-[12.5px] text-[var(--color-fg-dim)]">
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard/install">Install</Link>
            <Link href="/dashboard/settings">Settings</Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-6">{children}</div>
      </main>

      {!merchant ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-[var(--color-fg-muted)] font-mono">
          Provisioning your merchant record…
        </div>
      ) : null}
    </div>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.08em] font-medium font-mono text-[var(--color-fg-muted)]">
      {label}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] text-[var(--color-fg-dim)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors focus-ring"
    >
      <span className="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)]">{icon}</span>
      {children}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2.5 7L8 2.5L13.5 7v6a1 1 0 01-1 1h-9a1 1 0 01-1-1V7z" strokeLinejoin="round" />
      <path d="M6.5 14V9h3v5" strokeLinejoin="round" />
    </svg>
  );
}
function TerminalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4 6l2.5 2L4 10M8 10h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CogIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M1 8h2M13 8h2M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
    </svg>
  );
}
