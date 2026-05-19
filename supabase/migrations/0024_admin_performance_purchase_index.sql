-- Supports the corrected admin performance RPC, which now counts all
-- attributed in-test purchases instead of only rows with iab_kind populated.

create index if not exists escape_events_admin_test_purchases_idx
  on public.escape_events (created_at desc, merchant_id, order_id)
  include (bucket, value_cents)
  where in_test = true
    and event_type = 'purchase'
    and order_id is not null;
