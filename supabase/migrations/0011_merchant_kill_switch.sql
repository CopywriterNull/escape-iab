-- Migration 0011 — kill-switch + custom fallback button text on merchants.
--
-- escape_enabled (boolean, default true)
--   When false, the snippet still beacons impressions for tracking but
--   skips the redirect entirely. Useful as a panic-button without
--   uninstalling the snippet from theme.liquid.
--
-- fallback_text (text, nullable)
--   Overrides the default "tap to open in browser" copy on the 2-second
--   fallback button. Lets merchants localize or brand-match the prompt.

alter table public.merchants
  add column if not exists escape_enabled boolean not null default true,
  add column if not exists fallback_text text;
