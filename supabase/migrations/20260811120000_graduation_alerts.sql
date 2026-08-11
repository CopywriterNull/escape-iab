-- Ready-to-bill agent state.
--
-- The agent finds tests that have crossed significance with real billable
-- incremental and drafts the pitch. Without a memory it would re-post the same
-- brand every morning until it graduated, which trains you to ignore it — so
-- one row per merchant records when it first went ready and when it was last
-- surfaced. `dismissed_at` is the "stop telling me" switch for a brand you've
-- decided not to graduate yet.
--
-- Deliberately not a log: one row per merchant, updated in place. The invoice
-- history in billing_invoices is the audit trail that matters.

create table if not exists public.graduation_alerts (
  merchant_id uuid primary key references public.merchants (id) on delete cascade,
  first_ready_at timestamptz not null default now(),
  last_posted_at timestamptz not null default now(),
  posts integer not null default 1,
  -- Snapshot of the numbers at first flag, so a later regression is visible as
  -- a change rather than silently overwriting the reason it was flagged.
  first_lift_pct numeric,
  first_z numeric,
  dismissed_at timestamptz
);

comment on table public.graduation_alerts is
  'One row per merchant surfaced by the ready-to-bill agent. Suppresses repeat Slack posts.';

alter table public.graduation_alerts enable row level security;
-- No policies: service role only. Nothing merchant-facing reads this.
