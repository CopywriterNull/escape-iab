-- Indexes for the admin brand-performance RPC.
-- Production was created concurrently before this migration was checked in;
-- keep the file transaction-safe for migration runners.

create index if not exists escape_events_admin_ig_iab_impressions_idx
  on public.escape_events (created_at desc, merchant_id, eh_sid)
  include (bucket, url)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'impression'
    and eh_sid is not null;

create index if not exists escape_events_admin_ig_escapes_idx
  on public.escape_events (created_at desc, merchant_id, eh_sid)
  include (bucket)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'escape_attempt'
    and eh_sid is not null;

create index if not exists escape_events_admin_ig_purchases_idx
  on public.escape_events (created_at desc, merchant_id, order_id)
  include (bucket, value_cents)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'purchase'
    and order_id is not null;
