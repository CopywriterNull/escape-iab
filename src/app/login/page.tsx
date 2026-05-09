import Link from "next/link";
import { signInWithMagicLink } from "@/app/actions/auth";
import { brand } from "@/lib/branding";
import { supabaseConfigured } from "@/lib/supabase/server";
import { SubmitButton } from "./submit-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <div className="min-h-dvh grid place-items-center px-5 mesh-bg grain relative">
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
        <div className="mt-7">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
            Welcome back
          </div>
          <h1 className="mt-1 h-display text-3xl">Sign in</h1>
          <p className="mt-1.5 text-sm text-[var(--color-fg-dim)]">
            We&apos;ll email you a magic link. No password required.
          </p>
        </div>

        {!supabaseConfigured ? (
          <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-3.5 text-xs text-[var(--color-fg-dim)]">
            Supabase isn&apos;t configured yet. Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your env to enable sign-in.
          </div>
        ) : sent ? (
          <div className="mt-6 rounded-lg border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] p-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="size-8 rounded-full bg-[var(--color-success)]/15 grid place-items-center shrink-0 mt-0.5">
                <svg viewBox="0 0 16 16" className="size-4 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <div className="font-medium text-[var(--color-fg)]">Check your inbox</div>
                <div className="mt-0.5 text-[var(--color-fg-dim)]">
                  Magic link sent {sp.email ? <>to <strong className="text-[var(--color-fg)]">{sp.email}</strong></> : "to your email"}.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form action={signInWithMagicLink} className="mt-6 space-y-3">
            <label className="block">
              <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Email</span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@yourstore.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm placeholder:text-[var(--color-fg-muted)] focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
              />
            </label>
            {error ? (
              <div className="text-xs text-[var(--color-danger)] flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3M8 10.5v0.5" strokeLinecap="round" />
                </svg>
                {error === "invalid_email"
                  ? "Enter a valid email."
                  : error === "not_configured"
                    ? "Backend not configured."
                    : decodeURIComponent(error)}
              </div>
            ) : null}
            <SubmitButton>Send magic link</SubmitButton>
          </form>
        )}

        <p className="mt-7 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
          By signing in you agree to the <a className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline" href="#">terms</a> and <a className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline" href="#">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
