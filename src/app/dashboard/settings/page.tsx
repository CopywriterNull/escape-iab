import { getCurrentMerchant, getImpersonationStatus } from "@/lib/db";
import { updateMerchantSettings } from "@/app/actions/merchant";
import { SplitSlider } from "./_components/split-slider";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ saved?: string; err?: string }>;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Independent fetches — run in parallel so settings nav doesn't pay
  // the round-trip cost three times.
  const [merchant, impersonation, sp] = await Promise.all([
    getCurrentMerchant(),
    getImpersonationStatus(),
    searchParams,
  ]);
  const saved = sp.saved === "1";
  const err = sp.saved === "0" ? sp.err ?? "unknown" : null;
  if (!merchant) {
    return <div className="card p-8">No merchant yet — refresh in a moment.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)] font-medium">
          Configuration
        </div>
        <h1 className="mt-1.5 h-display text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-dim)] max-w-prose">
          Per-store config. Changes apply on the next snippet fetch (~5 min edge cache).
        </p>
      </div>

      {/* Always show which row is being edited, especially during impersonation */}
      <div className={`rounded-lg border px-4 py-2.5 text-[12px] font-mono flex items-center justify-between gap-3 ${
        impersonation.active
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/8 text-[var(--color-fg)]"
          : "border-[var(--color-border-soft)] bg-[var(--color-card)] text-[var(--color-fg-dim)]"
      }`}>
        <span className="inline-flex items-center gap-2 min-w-0">
          {impersonation.active ? (
            <span className="size-1.5 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          ) : (
            <span className="size-1.5 rounded-full bg-[var(--color-fg-muted)] shrink-0" />
          )}
          <span className="font-semibold tracking-tight text-[var(--color-fg)]">
            {impersonation.active ? "Editing as admin:" : "Editing:"}
          </span>
          <span className="truncate text-[var(--color-fg)]">{merchant.name ?? "(unnamed)"}</span>
          <span className="text-[var(--color-fg-muted)] truncate hidden sm:inline">· {merchant.domain ?? "—"}</span>
        </span>
        <span className="text-[10px] tnum text-[var(--color-fg-muted)] truncate hidden md:inline" title={merchant.id}>
          {merchant.id.slice(0, 8)}…
        </span>
      </div>

      {saved ? (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] px-4 py-2.5 text-sm flex items-center gap-2.5">
          <span className="size-5 rounded-full bg-[var(--color-success)]/20 grid place-items-center shrink-0">
            <svg viewBox="0 0 16 16" className="size-3 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[var(--color-fg)]">
            Saved to <strong>{merchant.name ?? "this merchant"}</strong>. Bump <code className="font-mono text-[12px]">?v=</code> on the install snippet to bust the 5-min edge cache.
          </span>
        </div>
      ) : err ? (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/40 px-4 py-2.5 text-sm">
          <strong className="text-[var(--color-danger)]">Save failed</strong>{" "}
          <span className="text-[var(--color-fg-dim)]">— {err}. Refresh and try again. If this keeps happening, exit impersonation and back in.</span>
        </div>
      ) : null}

      <form action={updateMerchantSettings} className="card-hi p-7 space-y-7">
        {/* Defensive id pin — server cross-checks against getCurrentMerchant
            so the save can't drift to a different row mid-flow. */}
        <input type="hidden" name="merchant_id" value={merchant.id} />
        <div className="grid md:grid-cols-2 gap-6">
          <Field label="Store name" hint="Shown only on this dashboard.">
            <input
              type="text"
              name="name"
              defaultValue={merchant.name ?? ""}
              placeholder="Acme Supplements"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </Field>
          <Field label="Domain" hint="Display only — not enforced for tracking.">
            <input
              type="text"
              name="domain"
              defaultValue={merchant.domain ?? ""}
              placeholder="yourshop.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm font-mono focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </Field>
        </div>

        <div className="border-t border-[var(--color-border-soft)] pt-7 space-y-5">
          <Toggle
            name="paid_only"
            defaultOn={merchant.paid_only === true}
            label="Only escape paid Meta traffic"
            hint="Default off — escape every IG/Threads in-app browser visitor (organic story / DM / link-in-bio + paid). On: restrict to paid clicks only (fbclid present or paid-UTM tags)."
          />
          <Toggle
            name="ab_enabled"
            defaultOn={merchant.ab_enabled}
            label="A/B testing"
            hint="Split traffic between an escape arm (bucket A) and a silent control (bucket B) so the dashboard can compute lift with statistical confidence. Disable to escape 100%."
          />
          <SplitSlider
            defaultPct={
              typeof merchant.ab_split_pct === "number" && Number.isFinite(merchant.ab_split_pct)
                ? Math.min(99, Math.max(1, Math.round(merchant.ab_split_pct)))
                : 50
            }
          />
          <Toggle
            name="fallback_button"
            defaultOn={merchant.fallback_button}
            label="Fallback button"
            hint='If the auto-redirect doesn&apos;t fire within 2s, show a "tap to open in browser" button.'
          />
          <Field
            label="Custom fallback text"
            hint="Override the fallback button copy (max 60 chars). Leave blank for default."
          >
            <input
              type="text"
              name="fallback_text"
              defaultValue={merchant.fallback_text ?? ""}
              maxLength={60}
              placeholder="tap to open in browser"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus-ring focus:border-[var(--color-accent)]/60 transition-colors"
            />
          </Field>
        </div>

        <div className="border-t border-[var(--color-border-soft)] pt-7 space-y-5">
          <Toggle
            name="escape_enabled"
            defaultOn={merchant.escape_enabled ?? true}
            label="Escape engine"
            hint="Master switch. Off = snippet still tracks impressions but skips the redirect. Use as a panic button without uninstalling from theme.liquid."
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] text-sm font-medium press lift focus-ring"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            Save changes
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium tracking-tight">{label}</span>
      {hint ? <span className="block text-xs text-[var(--color-fg-muted)] mt-1">{hint}</span> : null}
      <div className="mt-2.5">{children}</div>
    </label>
  );
}

function Toggle({
  name,
  defaultOn,
  label,
  hint,
}: {
  name: string;
  defaultOn: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <div className="text-sm font-medium tracking-tight">{label}</div>
        {hint ? <div className="mt-1 text-xs text-[var(--color-fg-muted)] leading-relaxed">{hint}</div> : null}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultOn} className="peer sr-only" />
        <span className="relative inline-block h-6 w-11 rounded-full bg-[var(--color-border)] peer-checked:bg-[var(--color-accent)] transition-colors duration-200">
          <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-md peer-checked:translate-x-5 transition-transform duration-200" />
        </span>
      </label>
    </div>
  );
}
