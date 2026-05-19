"use client";

import { useState } from "react";

const visitorRanges = [
  "Under 50k",
  "50k-250k",
  "250k-1M",
  "1M-5M",
  "5M+",
];

const platforms = ["Shopify", "Shopify Plus", "Headless Shopify", "Custom / other"];

export function EarlyAccessForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      monthlyVisitors: String(formData.get("monthlyVisitors") ?? "").trim(),
      platform: String(formData.get("platform") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim(),
      page: window.location.href,
    };

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "submit_failed");
      setState("sent");
      setMessage("Got it. We will reach out shortly.");
      form.reset();
    } catch {
      setState("error");
      setMessage("Could not submit. Email us directly and we will get you in.");
    }
  }

  return (
    <form
      id="waitlist"
      onSubmit={onSubmit}
      className="mt-9 mx-auto w-full max-w-2xl rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]/70 p-3 shadow-[var(--shadow-card)] backdrop-blur"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Work email">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@brand.com"
            className={inputClass}
          />
        </Field>
        <Field label="Brand">
          <input
            type="text"
            name="company"
            required
            autoComplete="organization"
            placeholder="G FUEL"
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            name="website"
            required
            autoComplete="url"
            placeholder="https://brand.com"
            className={inputClass}
          />
        </Field>
        <Field label="Visitors / month">
          <select name="monthlyVisitors" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select range
            </option>
            {visitorRanges.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Storefront" className="sm:col-span-2">
          <select name="platform" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select platform
            </option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anything we should know?" className="sm:col-span-2">
          <textarea
            name="notes"
            rows={3}
            placeholder="IG traffic, monthly spend, launch timing, or current checkout issues"
            className={`${inputClass} min-h-[92px] resize-none rounded-2xl py-3`}
          />
        </Field>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-5 text-left text-[12px] text-[var(--color-fg-muted)]" role="status" aria-live="polite">
          {message || "For brands with meaningful paid social traffic."}
        </p>
        <button
          type="submit"
          disabled={state === "sending"}
          className="rainbow-btn inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-[var(--color-cta-fg)] press lift focus-ring disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          <span>{state === "sending" ? "Sending..." : "Get early access"}</span>
          <span className="btn-icon">
            <ArrowRight />
          </span>
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-left ${className}`}>
      <span className="mb-1.5 block pl-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-fg-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-accent)]/60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)]";

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h9" />
      <path d="M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
