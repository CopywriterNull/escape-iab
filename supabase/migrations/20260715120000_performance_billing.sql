-- Performance billing: merchant billing fields + invoice ledger + rollup sums RPC.

alter table merchants
  add column if not exists stripe_customer_id text,
  add column if not exists billing_status text not null default 'none'
    check (billing_status in ('none','active','paused')),
  add column if not exists billing_anchor timestamptz,
  add column if not exists base_fee_cents integer not null default 30000,
  add column if not exists base_fee_waived boolean not null default false,
  add column if not exists rev_share_pct numeric not null default 10,
  add column if not exists billing_setup_token text;

create unique index if not exists merchants_billing_setup_token_idx
  on merchants (billing_setup_token) where billing_setup_token is not null;

create table if not exists billing_invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  kind text not null check (kind in ('plan_start','monthly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  snapshot jsonb not null default '{}'::jsonb,
  base_fee_cents integer not null default 0,
  rev_share_cents integer not null default 0,
  total_cents integer not null default 0,
  edited boolean not null default false,
  note text,
  status text not null default 'pending_review'
    check (status in ('pending_review','charging','paid','failed','voided')),
  stripe_invoice_id text,
  created_at timestamptz not null default now(),
  charged_at timestamptz
);

create unique index if not exists billing_invoices_period_uidx
  on billing_invoices (merchant_id, period_start, kind);
create index if not exists billing_invoices_status_idx on billing_invoices (status);
create unique index if not exists billing_invoices_stripe_idx
  on billing_invoices (stripe_invoice_id) where stripe_invoice_id is not null;

-- Service-role only (admin pages + cron use getSupabaseAdmin). RLS on, no policies.
alter table billing_invoices enable row level security;

-- Per-bucket impression/revenue sums over an hour-aligned window.
-- Boundary rule: hour >= date_trunc('hour', p_from) AND hour < p_to
-- (matches eh_test_funnel / outlier-window-boundary-fix semantics).
create or replace function eh_billing_rollup_sums(
  p_merchant uuid, p_from timestamptz, p_to timestamptz
) returns table (bucket text, impressions bigint, revenue_cents bigint)
language sql stable security definer set search_path = public as $$
  select r.bucket,
         coalesce(sum(r.impressions), 0)::bigint,
         coalesce(sum(r.revenue_cents), 0)::bigint
  from hourly_funnel_rollups r
  where r.merchant_id = p_merchant
    and r.hour >= date_trunc('hour', p_from)
    and r.hour < p_to
  group by r.bucket
$$;
