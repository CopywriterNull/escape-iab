"use client";

import { useState } from "react";

type WebhookResult = {
  ok: boolean;
  configured: boolean;
  status?: number;
  statusText?: string;
  body?: string;
  hint?: string;
  error?: string;
  detail?: string;
};

type SubmitResult = { httpStatus: number; ok: boolean; json: unknown };

const SAMPLE = {
  email: "test@brand.com",
  company: "Test Brand",
  website: "brand.com",
  monthlyVisitors: "250k-1M",
  platform: "Shopify",
  referralSource: "Twitter / X",
  notes: "Test submission from /early-access-test",
};

export function WebhookTester() {
  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<WebhookResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submit, setSubmit] = useState<SubmitResult | null>(null);
  const [form, setForm] = useState(SAMPLE);

  async function runPing() {
    setPinging(true);
    setPing(null);
    try {
      const res = await fetch("/api/early-access/test", { cache: "no-store" });
      setPing((await res.json()) as WebhookResult);
    } catch {
      setPing({ ok: false, configured: true, error: "request_failed", hint: "Could not reach the test endpoint." });
    } finally {
      setPinging(false);
    }
  }

  async function runSubmit() {
    setSubmitting(true);
    setSubmit(null);
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, page: "/early-access-test" }),
      });
      const json = await res.json().catch(() => null);
      setSubmit({ httpStatus: res.status, ok: res.ok, json });
    } catch {
      setSubmit({ httpStatus: 0, ok: false, json: { error: "request_failed" } });
    } finally {
      setSubmitting(false);
    }
  }

  const pingTone = ping == null ? "neutral" : ping.ok ? "good" : "bad";

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-14">
        <div className="text-[10.5px] uppercase tracking-[0.18em] font-mono text-[var(--color-fg-muted)]">
          Internal · Diagnostics
        </div>
        <h1 className="mt-2 text-[26px] md:text-[30px] font-semibold tracking-tight">Early-access webhook test</h1>
        <p className="mt-1.5 max-w-xl text-[13px] text-[var(--color-fg-dim)]">
          Fire a test lead at the configured webhook and see exactly what comes back. Use this to confirm the Make
          scenario is live.
        </p>

        {/* Step 1 — ping the webhook */}
        <section className="mt-7 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[14px] font-semibold tracking-tight">1 · Ping the webhook</h2>
              <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
                Server-side POST straight to the Make webhook.
              </p>
            </div>
            <button
              type="button"
              onClick={runPing}
              disabled={pinging}
              className="rounded-full bg-[var(--color-cta-bg)] px-4 py-2 text-[13px] font-medium text-[var(--color-cta-fg)] disabled:opacity-60"
            >
              {pinging ? "Testing…" : "Send test lead"}
            </button>
          </div>

          {ping ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={pingTone}>
                  {ping.configured === false
                    ? "Not configured"
                    : ping.ok
                      ? `OK · ${ping.status}`
                      : ping.status
                        ? `Failed · ${ping.status}`
                        : "Failed"}
                </StatusPill>
                {ping.configured === false ? (
                  <span className="text-[12px] font-mono text-[var(--color-fg-muted)]">env var missing</span>
                ) : null}
              </div>
              {ping.hint ? (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    pingTone === "good"
                      ? "border-[var(--color-success)]/40 text-[var(--color-fg)]"
                      : "border-[var(--color-danger)]/40 text-[var(--color-fg)]"
                  }`}
                >
                  {ping.hint}
                </div>
              ) : null}
              {ping.body ? (
                <pre className="overflow-x-auto rounded-lg bg-[var(--color-bg)] p-3 text-[11.5px] font-mono text-[var(--color-fg-dim)]">
                  {ping.body}
                </pre>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-[12px] text-[var(--color-fg-muted)]">No test run yet.</p>
          )}
        </section>

        {/* Step 2 — full form path */}
        <section className="mt-4 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-5">
          <h2 className="text-[14px] font-semibold tracking-tight">2 · Full submit path</h2>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
            Posts through <code className="font-mono">/api/early-access</code> exactly like the real form. Try a bare
            domain like <code className="font-mono">brand.com</code> to confirm it&apos;s accepted.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <TextField label="Brand" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
            <TextField label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
            <TextField
              label="Referral source"
              value={form.referralSource}
              onChange={(v) => setForm({ ...form, referralSource: v })}
            />
          </div>

          <button
            type="button"
            onClick={runSubmit}
            disabled={submitting}
            className="mt-4 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit test form"}
          </button>

          {submit ? (
            <div className="mt-4 space-y-2">
              <StatusPill tone={submit.ok ? "good" : "bad"}>
                HTTP {submit.httpStatus} · {submit.ok ? "accepted" : "rejected"}
              </StatusPill>
              <pre className="overflow-x-auto rounded-lg bg-[var(--color-bg)] p-3 text-[11.5px] font-mono text-[var(--color-fg-dim)]">
                {JSON.stringify(submit.json, null, 2)}
              </pre>
            </div>
          ) : null}
        </section>

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-fg-muted)]">
          If you see <span className="font-mono">410 · no scenario listening</span>, the Make scenario is turned off —
          switch it ON in Make, then re-run. Test leads are tagged <span className="font-mono">test:true</span>.
        </p>
      </div>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "good" | "bad" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "good"
      ? "border-[var(--color-success)]/50 text-[var(--color-success)]"
      : tone === "bad"
        ? "border-[var(--color-danger)]/50 text-[var(--color-danger)]"
        : "border-[var(--color-border-soft)] text-[var(--color-fg-muted)]";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-mono ${cls}`}>
      {children}
    </span>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-fg-muted)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60"
      />
    </label>
  );
}
