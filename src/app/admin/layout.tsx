import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { brand } from "@/lib/branding";
import { PixelIcon } from "@/components/PixelIcon";
import { AdminSidebarNav } from "./_components/sidebar-nav";

const ADMIN_EMAIL = "lennyhuynh526@gmail.com";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  if (!supabase) {
    return (
      <Locked title="Backend not configured">
        Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
        <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to enable admin.
      </Locked>
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Locked title="Admin only">Signed in as {user.email}.</Locked>;
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-[var(--color-bg)] text-[var(--color-fg)]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/30 sticky top-0 h-dvh z-30">
        <div className="h-12 px-4 flex items-center gap-2 border-b border-[var(--color-border-soft)]">
          <Link href="/admin" className="flex items-center gap-2 focus-ring rounded-md shrink-0">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <PixelIcon name="arrow-up-right" size={12} className="text-white" />
            </span>
            <span className="text-[13.5px] font-semibold tracking-tight">{brand.name}</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-mono tracking-wider">
              ADMIN
            </span>
          </Link>
        </div>

        <div className="px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.12em] font-mono text-[var(--color-fg-muted)] font-medium">
          Workspace
        </div>
        <AdminSidebarNav />

        <div className="mt-auto px-3 py-3 border-t border-[var(--color-border-soft)]">
          <div className="px-1 pb-2 flex items-center gap-2 min-w-0">
            <span className="size-6 rounded-full bg-[var(--color-accent)]/15 grid place-items-center text-[10px] font-semibold text-[var(--color-accent)] shrink-0">
              {user.email?.[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0">
              <div className="text-[11.5px] truncate" title={user.email ?? ""}>
                {user.email}
              </div>
              <div className="text-[10px] font-mono text-[var(--color-fg-muted)]">admin</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="block text-[11.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-ring rounded-md px-2 py-1 transition-colors"
          >
            ← back to dashboard
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 border-b border-[var(--color-border-soft)] bg-[var(--color-bg)]/95 backdrop-blur">
        <div className="px-4 h-12 flex items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2 font-semibold tracking-tight text-[14px]">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--color-accent)]">
              <PixelIcon name="arrow-up-right" size={12} className="text-white" />
            </span>
            {brand.name}
            <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-mono tracking-wider">
              ADMIN
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[12px]">
            <Link href="/admin" className="px-2 py-1 text-[var(--color-fg-muted)]">Overview</Link>
            <Link href="/admin/merchants" className="px-2 py-1 text-[var(--color-fg-muted)]">Merchants</Link>
            <Link href="/admin/health" className="px-2 py-1 text-[var(--color-fg-muted)]">Health</Link>
            <Link href="/admin/guides" className="px-2 py-1 text-[var(--color-fg-muted)]">Guides</Link>
            <Link href="/admin/diagnostics" className="px-2 py-1 text-[var(--color-fg-muted)]">Diag</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

function Locked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="max-w-md p-8 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]">
        <h1 className="h-display text-[24px] tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-[var(--color-fg-dim)]">{children}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--color-accent)] link-grow">
          ← dashboard
        </Link>
      </div>
    </div>
  );
}
