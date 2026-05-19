-- Keep the admin performance RPC below API statement timeouts.
-- The RPC counts distinct IG sessions across all brands, so these indexes
-- match the session grouping shape rather than only the date range.

create index if not exists escape_events_admin_ig_impression_sessions_idx
  on public.escape_events (merchant_id, bucket, eh_sid, created_at desc)
  include (url)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'impression'
    and eh_sid is not null;

create index if not exists escape_events_admin_ig_escape_sessions_idx
  on public.escape_events (merchant_id, bucket, eh_sid, created_at desc)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type = 'escape_attempt'
    and eh_sid is not null;

alter function public.eh_admin_brand_performance(timestamptz)
  set work_mem = '32MB';
