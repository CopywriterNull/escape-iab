import type { Merchant } from "@/lib/db";
import { brand } from "@/lib/branding";
import { signOut } from "@/app/actions/auth";

/** Full-screen experience for status='pending' merchants: what the product
 *  does (static sample metrics — clearly labeled), their install snippet
 *  (inert until approval flips escape_enabled), and where they stand.
 *  Static markup on purpose — no live queries for unapproved workspaces. */
export function PendingApprovalScreen({
  merchant,
  userEmail,
}: {
  merchant: Merchant;
  userEmail: string;
}) {
  const snippet = `<script src="https://${brand.domain}/s/${merchant.id}.js?v=13"></script>`;
  const SAMPLE = [
    { label: "IG escape rate", value: "38.2%", hint: "of in-app visitors rerouted" },
    { label: "CVR lift (A vs B)", value: "+27%", hint: "escape bucket vs control" },
    { label: "Recovered revenue", value: "$12.4k", hint: "last 14 days, sample brand" },
  ];

  return (
    <div className="min-h-dvh grid place-items-center px-5 py-12 bg-[var(--color-bg)] text-[var(--color-fg)]">
      <div className="w-full max-w-xl space-y-5">
        <div className="card-hi p-7">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-mono text-[var(--color-warn)]">
            <span className="size-1.5 rounded-full bg-[var(--color-warn)] animate-pulse" />
            Pending approval
          </div>
          <h1 className="mt-2 h-display text-3xl">
            {merchant.name ?? "Your workspace"} is in review
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            We approve new brands within one business day. You&apos;ll get an
            email at <strong className="text-[var(--color-fg)]">{userEmail}</strong>{" "}
            the moment {merchant.domain ?? "your store"} goes live.
          </p>
        </div>

        <div className="card-hi p-7">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            What you&apos;ll see once you&apos;re live
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {SAMPLE.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-card)] p-3.5"
              >
                <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-[var(--color-fg-muted)]">
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tnum">{s.value}</div>
                <div className="mt-0.5 text-[10.5px] text-[var(--color-fg-muted)]">{s.hint}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-mono text-[var(--color-fg-muted)]">
            Sample data from a live {brand.name} brand — your dashboard fills
            with your own traffic after install.
          </p>
        </div>

        <div className="card-hi p-7">
          <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--color-fg-muted)]">
            Get a head start — your install snippet
          </div>
          <p className="mt-2 text-sm text-[var(--color-fg-dim)]">
            You can paste this into your theme now. It stays dormant and
            activates automatically the moment you&apos;re approved.
          </p>
          <pre className="mt-3 text-[11.5px] font-mono bg-[var(--color-bg-elev)] border border-[var(--color-border-soft)] rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {snippet}
          </pre>
          <p className="mt-2 text-[11px] font-mono text-[var(--color-fg-muted)]">
            Place as the first &lt;script&gt; in &lt;head&gt; — no async, no defer.
          </p>
        </div>

        <div className="flex items-center justify-between text-sm px-1">
          <a href="mailto:lenny@getescapehatch.com" className="text-[var(--color-accent)] link-grow">
            Questions? Contact us →
          </a>
          <form action={signOut}>
            <button type="submit" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
