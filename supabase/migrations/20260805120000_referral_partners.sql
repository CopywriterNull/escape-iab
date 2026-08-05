-- Referral / affiliate partners. An admin assigns merchants to a referrer with
-- a share pct; the referrer gets a tokened, no-login dashboard (/partner/<token>)
-- listing their referred brands, collected billing, and their cut.
--
-- Share basis: PAID billing_invoices.total_cents × effective pct, where
-- effective pct = merchants.referral_share_pct override, else
-- referrers.default_share_pct. Computed at read time — no payout ledger yet
-- (payouts are manual for now; a payouts table can come later without
-- changing this schema).

create table if not exists referrers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  default_share_pct numeric not null default 20
    check (default_share_pct >= 0 and default_share_pct <= 100),
  view_token text,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists referrers_view_token_key
  on public.referrers (view_token)
  where view_token is not null;

-- Service-role only (admin pages + the tokened partner page both read through
-- getSupabaseAdmin). RLS on, no policies — same posture as billing_invoices.
alter table referrers enable row level security;

alter table merchants
  add column if not exists referrer_id uuid references referrers(id) on delete set null,
  add column if not exists referral_share_pct numeric
    check (referral_share_pct >= 0 and referral_share_pct <= 100);

create index if not exists merchants_referrer_idx
  on public.merchants (referrer_id)
  where referrer_id is not null;
