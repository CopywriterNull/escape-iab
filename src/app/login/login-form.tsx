"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

// Initiates the magic-link OTP from the browser so the PKCE code verifier
// cookie is written by the browser client directly. Doing this on the server
// (via a server action) doesn't reliably persist the Set-Cookie across the
// redirect, which is why callbacks fail with "PKCE code verifier not found".
export function LoginForm() {
  const [email, setEmail] = useState("");
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setStatus("error");
      setError(err.message);
      return;
    }
    setStatus("sent");
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
  );
}
