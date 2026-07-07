-- Phase 3: gated self-serve signup.
-- status powers the approval gate: self-serve signups start 'pending' and
-- render the approval-pending experience until an admin flips them 'live'
-- from the /admin/merchants queue. Existing merchants backfill to 'live'
-- via the column default (NOT NULL + DEFAULT is metadata-only in PG 11+).
alter table public.merchants
  add column if not exists status text not null default 'live'
    check (status in ('live', 'pending'));

-- Storefront platform captured by the onboarding form (shopify /
-- woocommerce / custom / other) so the admin queue can triage installs.
-- Nullable: pre-Phase-3 merchants never filled it in.
alter table public.merchants
  add column if not exists platform text;
