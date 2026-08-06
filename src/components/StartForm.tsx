"use client";

import { useState } from "react";

// Conversion-focused replacement for the 7-field early-access form.
//
// The old version required email, brand, website, monthly visitors, platform
// AND referral source before anyone could raise a hand — six required fields
// to start a free trial. Every one of those is either derivable from the store
// URL or is a question we can ask on the call.
//
// What's left: store URL + work email. Everything else is optional and hidden
// behind a disclosure, so a motivated lead can give us more without anyone
// being forced to. Ad spend stays available because it's the one answer that
// changes how fast we respond — but it never blocks a submit.

const SPEND_BANDS = [
  "Under $10k / mo",
  "$10k–50k / mo",
  "$50k–250k / mo",
  "$250k+ / mo",
];

function normalizeWebsite(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

export function StartForm({ initialEmail = "" }: { initialEmail?: string } = {}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showMore, setShowMore] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const form = event.currentTarget;
    const fd = new FormData(form);
    const website = normalizeWebsite(String(fd.get("website") ?? ""));
    const payload = {
      email: String(fd.get("email") ?? "").trim(),
      website,
      // Derive a usable brand label from the domain so the lead is readable in
      // Slack even when nobody filled the optional name field.
      company: String(fd.get("company") ?? "").trim() || hostLabel(website),
      adSpend: String(fd.get("adSpend") ?? "").trim(),
      notes: String(fd.get("notes") ?? "").trim(),
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
      form.reset();
    } catch {
      setState("error");
      setMessage("That didn't go through. Email hi@getescapehatch.com and we'll get you set up.");
    }
  }

  if (state === "sent") {
    return (
      <div className="mt-9 mx-auto w-full max-w-lg rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-card)] p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--color-success-soft)]">
          <svg viewBox="0 0 20 20" className="size-5 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-5 h-display text-[24px] tracking-tight">You&apos;re in the queue.</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-fg-dim)]">
          We&apos;ll reply within one business day with next steps. Here&apos;s what happens after that:
        </p>
        <ol className="mt-5 space-y-2.5 text-left text-[13.5px] text-[var(--color-fg-dim)]">
          {[
            "You send a Shopify collaborator code.",
            "We install the script, pixel and order webhook — usually same day.",
            "The 50/50 test starts immediately. You watch it on a live dashboard.",
            "In about two weeks you have your own number. Only then does billing start.",
          ].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="shrink-0 size-5 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-accent)] font-mono text-[10px] flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-9 mx-auto w-full max-w-lg">
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)]/80 p-6 sm:p-7 shadow-[var(--shadow-card)] backdrop-blur space-y-4">
        <div>
          <label htmlFor="website" className="block text-[13px] font-medium tracking-tight">
            Your store URL
          </label>
          <input
            id="website"
            name="website"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoFocus
            required
            placeholder="yourbrand.com"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[15px] placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] transition-colors"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-[13px] font-medium tracking-tight">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            defaultValue={initialEmail}
            placeholder="you@yourbrand.com"
            className="mt-2 w-full px-4 py-3 rounded-xl bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[15px] placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] transition-colors"
          />
        </div>

        {showMore ? (
          <div className="space-y-4 pt-1">
            <div>
              <label htmlFor="adSpend" className="block text-[13px] font-medium tracking-tight">
                Monthly Meta spend <span className="text-[var(--color-fg-muted)] font-normal">(optional)</span>
              </label>
              <select
                id="adSpend"
                name="adSpend"
                defaultValue=""
                className="mt-2 w-full px-4 py-3 rounded-xl bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[15px] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors"
              >
                <option value="">Prefer not to say</option>
                {SPEND_BANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="block text-[13px] font-medium tracking-tight">
                Anything we should know? <span className="text-[var(--color-fg-muted)] font-normal">(optional)</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Timeline, who else needs to sign off, questions…"
                className="mt-2 w-full px-4 py-3 rounded-xl bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-[14px] placeholder:text-[var(--color-fg-muted)] focus:outline-none focus:border-[var(--color-accent)]/60 transition-colors resize-none"
              />
            </div>
            <input type="hidden" name="company" value="" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="text-[12.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-dim)] transition-colors"
          >
            + Add ad spend or a note (optional)
          </button>
        )}

        <button
          type="submit"
          disabled={state === "sending"}
          className="w-full mt-1 inline-flex items-center justify-center px-5 py-3.5 rounded-xl bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-[15px] font-semibold press lift focus-ring disabled:opacity-60 transition-opacity"
          style={{ boxShadow: "var(--shadow-cta)" }}
        >
          {state === "sending" ? "Sending…" : "Start my two-week test"}
        </button>

        {state === "error" ? (
          <p className="text-[13px] text-[var(--color-danger)] text-center">{message}</p>
        ) : null}
      </div>

      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-[var(--color-fg-muted)]">
        {["No card required", "No contract", "Kill switch on day one", "~10 min to install"].map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <svg viewBox="0 0 20 20" className="size-3.5 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t}
          </li>
        ))}
      </ul>
    </form>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
