import { getCurrentMerchant } from "@/lib/db";
import { updateMerchantSettings } from "@/app/actions/merchant";

export default async function SettingsPage() {
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    return <div className="card p-8">No merchant yet — refresh in a moment.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-dim)]">
          Per-store config. Changes apply on the next snippet fetch (~5min edge cache).
        </p>
      </div>

      <form action={updateMerchantSettings} className="card p-6 space-y-6">
        <Field label="Store name" hint="Shown only on this dashboard.">
          <input
            type="text"
            name="name"
            defaultValue={merchant.name ?? ""}
            placeholder="Acme Supplements"
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]/60"
          />
        </Field>
        <Field label="Domain" hint="Used for display — not enforced for tracking.">
          <input
            type="text"
            name="domain"
            defaultValue={merchant.domain ?? ""}
            placeholder="yourshop.com"
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-elev)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]/60"
          />
        </Field>

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

        <div className="pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--color-cta-bg)] text-[var(--color-cta-fg)] font-medium hover:opacity-90"
          >
            Save changes
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
      <span className="block text-sm font-medium">{label}</span>
      {hint ? <span className="block text-xs text-[var(--color-fg-muted)] mt-0.5">{hint}</span> : null}
      <div className="mt-2">{children}</div>
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
        <div className="text-sm font-medium">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{hint}</div> : null}
      </div>
      <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" name={name} defaultChecked={defaultOn} className="peer sr-only" />
        <span className="relative inline-block h-6 w-11 rounded-full bg-[var(--color-border)] peer-checked:bg-[var(--color-accent)] transition-colors">
          <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white peer-checked:translate-x-5 transition-transform" />
        </span>
      </label>
    </div>
  );
}
