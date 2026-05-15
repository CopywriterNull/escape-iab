-- Migration 0015 — flip paid_only default to false + backfill existing rows.
--
-- Policy change: new merchants should default to "escape every IG/Threads
-- IAB visitor" (paid_only = false), not "only escape paid Meta clicks"
-- (paid_only = true, the original conservative default from 0012).
--
-- Higher coverage matches how brands actually want to deploy this:
-- recover organic IG link-in-bio / story / DM traffic in addition to paid.
-- Brands that explicitly want paid-only can flip the toggle back on in
-- /dashboard/settings.
--
-- Backfills every existing row so andar.com and any other merchants
-- currently set to paid_only=true (the old default) get auto-flipped.

alter table public.merchants
  alter column paid_only set default false;

update public.merchants
  set paid_only = false
  where paid_only is null or paid_only = true;
