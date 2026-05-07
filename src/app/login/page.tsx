import Link from "next/link";
import { signInWithMagicLink } from "@/app/actions/auth";
import { brand } from "@/lib/branding";
import { supabaseConfigured } from "@/lib/supabase/server";

type SearchParams = Promise<{ error?: string; sent?: string; email?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const error = sp.error;

  return (
    <div className="min-h-dvh grid place-items-center px-5 mesh-bg">
      <div className="w-full max-w-sm card elevated p-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-md"
            style={{ background: "linear-gradient(135deg, #5b8cff 0%, #b46bff 100%)" }}
          />
          {brand.name}
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-dim)]">
          We&apos;ll email you a magic link. No password required.
        </p>

        {!supabaseConfigured ? (
          <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3 text-xs text-[var(--color-fg-dim)]">
            Supabase isn&apos;t configured yet. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your env to enable sign-in.
          </div>
        ) : sent ? (
          <div className="mt-5 rounded-lg border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] p-3 text-sm text-[var(--color-fg)]">
            Check {sp.email ? <strong>{sp.email}</strong> : "your inbox"} for the magic link.
          </div>
        ) : (
          <form action={signInWithMagicLink} className="mt-5 space-y-3">
            <label className="block">
              <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5">Email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@yourstore.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[var(--color-accent)]/20"
              />
            </label>
            {error ? (
              <div className="text-xs text-[var(--color-danger)]">
                {error === "invalid_email"
                  ? "Enter a valid email."
                  : error === "not_configured"
                    ? "Backend not configured."
                    : decodeURIComponent(error)}
              </div>
            ) : null}
            <button
              type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium hover:opacity-90"
            >
              Send magic link
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-[var(--color-fg-muted)]">
          By signing in you agree to the <a className="underline" href="#">terms</a> and <a className="underline" href="#">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
