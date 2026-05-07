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
        <div className="max-w-md card p-8">
          <h1 className="text-xl font-semibold">Backend not configured</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and friends in your env to enable the dashboard.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm underline">
            Back to home
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
    <div className="min-h-dvh flex flex-col bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="inline-flex size-6 items-center justify-center rounded-md"
              style={{ background: "linear-gradient(135deg, #4f7cff 0%, #06b6d4 100%)" }}
            />
            {brand.name}
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--color-fg-dim)]">
            <Link href="/dashboard" className="hover:text-[var(--color-fg)]">Overview</Link>
            <Link href="/dashboard/install" className="hover:text-[var(--color-fg)]">Install</Link>
            <Link href="/dashboard/settings" className="hover:text-[var(--color-fg)]">Settings</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-[var(--color-fg-muted)]">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="text-[var(--color-fg-dim)] hover:text-[var(--color-fg)]">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      </main>
      {!merchant ? (
        <div className="mx-auto max-w-6xl px-5 pb-6 text-xs text-[var(--color-fg-muted)]">
          Provisioning your merchant record…
        </div>
      ) : null}
    </div>
  );
}
