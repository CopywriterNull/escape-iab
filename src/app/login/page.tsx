import Link from "next/link";
import { brand } from "@/lib/branding";
import { supabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
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
        ) : (
          <LoginForm />
        )}

        <p className="mt-7 text-[11px] text-[var(--color-fg-muted)] leading-relaxed">
          By signing in you agree to the <a className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline" href="#">terms</a> and <a className="underline-offset-2 hover:text-[var(--color-fg-dim)] underline" href="#">privacy policy</a>.
        </p>
      </div>
    </div>
  );
}
