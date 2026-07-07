"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// Initiates the magic-link OTP from the browser so the PKCE code verifier
// cookie is written by the browser client directly. Doing this on the server
// (via a server action) doesn't reliably persist the Set-Cookie across the
// redirect, which is why callbacks fail with "PKCE code verifier not found".
export function LoginForm({
  initialEmail = "",
  next,
}: {
  initialEmail?: string;
  next?: string;
} = {}) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email.");
      return;
    }
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("Backend not configured.");
      return;
    }
    setStatus("sending");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    if (err) {
      setStatus("error");
      setError(err.message);
      return;
    }
    setStatus("sent");
  }

  async function onGoogle() {
    setError(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError("Backend not configured.");
      return;
    }
    // OAuth also lands on /auth/callback with a ?code= — the same PKCE
    // exchange as magic links, so the callback route needs no changes.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    // On success the browser navigates away; only errors reach here
    // (e.g. provider not enabled in Supabase yet).
    if (err) setError(err.message);
  }

  if (status === "sent") {
    return (
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
              Magic link sent to <strong className="text-[var(--color-fg)]">{email}</strong>. Open it in this browser.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <label className="block">
          <span className="block text-xs text-[var(--color-fg-dim)] mb-1.5 font-medium">Email</span>
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          {status === "sending" ? (
            <>
              <svg viewBox="0 0 16 16" className="size-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" opacity="0.25" />
                <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
              </svg>
              <span>Sending magic link…</span>
            </>
          ) : (
            "Send magic link"
          )}
        </button>
      </form>
      <div className="mt-4">
        <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.14em] font-mono text-[var(--color-fg-muted)]">
          <span className="h-px flex-1 bg-[var(--color-border-soft)]" />
          or
          <span className="h-px flex-1 bg-[var(--color-border-soft)]" />
        </div>
        <button
          type="button"
          onClick={onGoogle}
          className="mt-4 w-full px-4 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] text-sm font-medium press focus-ring inline-flex items-center justify-center gap-2.5 hover:bg-[var(--color-card)] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </>
  );
}
