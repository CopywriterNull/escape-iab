"use client";

type Preset = {
  key: string;
  label: string;
  hint: string;
  values: Record<string, boolean>;
};

const PRESETS: Preset[] = [
  {
    key: "ig",
    label: "IG only",
    hint: "Clean baseline",
    values: {
      escape_enabled: true,
      ab_enabled: true,
      paid_only: false,
      escape_instagram: true,
      escape_threads: false,
      escape_facebook: false,
      escape_messenger: false,
      escape_discord: false,
    },
  },
  {
    key: "meta",
    label: "Meta coverage",
    hint: "IG, Threads, FB, Messenger",
    values: {
      escape_enabled: true,
      ab_enabled: true,
      paid_only: false,
      escape_instagram: true,
      escape_threads: true,
      escape_facebook: true,
      escape_messenger: true,
      escape_discord: false,
    },
  },
  {
    key: "all",
    label: "Experimental all",
    hint: "Includes Discord",
    values: {
      escape_enabled: true,
      ab_enabled: true,
      paid_only: false,
      escape_instagram: true,
      escape_threads: true,
      escape_facebook: true,
      escape_messenger: true,
      escape_discord: true,
    },
  },
  {
    key: "paused",
    label: "Paused",
    hint: "Track, no redirect",
    values: {
      escape_enabled: false,
      ab_enabled: true,
    },
  },
];

export function PlatformPresets() {
  function applyPreset(preset: Preset) {
    for (const [name, checked] of Object.entries(preset.values)) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!input) continue;
      input.checked = checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => applyPreset(preset)}
          className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-bg-elev)]/45 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)]/45 hover:bg-[var(--color-bg-elev)] focus-ring"
        >
          <span className="block text-[13px] font-medium tracking-tight text-[var(--color-fg)]">
            {preset.label}
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-[var(--color-fg-muted)]">
            {preset.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
