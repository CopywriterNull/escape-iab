"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
      style={{ boxShadow: "var(--shadow-cta)" }}
    >
      {pending ? (
        <>
          <Spinner />
          <span>Sending magic link…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  );
}
