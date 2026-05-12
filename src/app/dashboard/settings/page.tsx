import { getCurrentMerchant } from "@/lib/db";
import { updateMerchantSettings } from "@/app/actions/merchant";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const merchant = await getCurrentMerchant();
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

      <form action={updateMerchantSettings} className="card-hi p-7 space-y-7">
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
            name="ab_enabled"
            defaultOn={merchant.ab_enabled}
            label="A/B testing"
            hint="50/50 split: bucket A escapes, bucket B is control. Disable once you've measured the lift."
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
