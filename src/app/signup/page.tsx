import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/branding";
import { getMemberships } from "@/lib/db";
import { supabaseConfigured, getSupabaseServer } from "@/lib/supabase/server";
import { createPendingMerchant } from "@/app/actions/signup";
import { LoginForm } from "@/app/login/login-form";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing_fields: "Brand name and store domain are both required.",
  create_failed: "Couldn't create your workspace — try again.",
  no_backend: "Backend not configured.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center px-5 py-16 mesh-bg grain relative">
      <div className="absolute inset-0 dotgrid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative w-full max-w-sm card-hi p-8">
        <Link href="/" className="inline-flex items-center gap-2.5 font-semibold tracking-tight focus-ring rounded-md">
          <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg" style={{ background: "var(--color-accent)" }}>
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14a8 8 0 1 0 8-8" />
              <path d="M14 4h6v6" />
              <path d="M20 4l-8 8" />
            </svg>
          </span>
          {brand.name}
        </Link>
        {children}
      </div>
    </div>
  );
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="mt-6 text-sm text-[var(--color-fg-dim)]">
          Supabase isn&apos;t configured yet — signup is unavailable in this environment.
        </p>
      </Shell>
    );
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  // Step 1: authenticate (magic link or Google), landing back here.
  if (!user) {
    return (
      <Shell>
        <div className="mt-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Start free
          </div>
          <h1 className="mt-1 h-display text-3xl">Create your account</h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
            Sign in first — then tell us about your brand.
          </p>
        </div>
        <LoginForm next="/signup" />
      </Shell>
    );
  }

  // Already in a workspace → nothing to create here.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/dashboard");

  // Step 2: onboarding form → pending workspace.
  return (
    <Shell>
      <div className="mt-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Almost there
        </div>
        <h1 className="mt-1 h-display text-3xl">Tell us about your brand</h1>
        <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
          Signed in as <strong className="text-[var(--color-fg)]">{user.email}</strong>.
          Your workspace goes live once we approve it — usually within a business day.
        </p>
      </div>

      {err && ERRORS[err] ? (
        <div className="mt-4 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {ERRORS[err]}
        </div>
      ) : null}

      <form action={createPendingMerchant} className="mt-6 space-y-3">
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Brand name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={80}
            placeholder="e.g. G FUEL"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Store domain</span>
          <input
            type="text"
            name="domain"
            required
            maxLength={120}
            placeholder="yourstore.com"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono placeholder:text-[var(--color-fg-muted)] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Platform</span>
          <select
            name="platform"
            defaultValue="shopify"
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring"
          >
            <option value="shopify">Shopify</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="custom">Custom storefront</option>
            <option value="other">Other</option>
          </select>
        </label>
        <button
          type="submit"
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          Create workspace
        </button>
      </form>
    </Shell>
  );
}
