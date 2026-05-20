-- Cover the corrected dashboard funnel RPC. The previous indexes either put
-- `created_at` too late for range scans or did not include the visitor/session
-- ids needed for distinct stage counts.

create index if not exists escape_events_dashboard_ig_entry_idx
  on public.escape_events (merchant_id, created_at desc, bucket)
  include (eh_sid, url)
  where in_test = true
    and event_type = 'impression'
    and iab_kind = 'instagram'
    and eh_sid is not null;

create index if not exists escape_events_dashboard_stage_sessions_idx
  on public.escape_events (merchant_id, event_type, created_at desc, bucket)
  include (shopify_client_id, eh_sid)
  where in_test = true
    and event_type in ('product_viewed', 'add_to_cart', 'checkout_started');

create index if not exists escape_events_dashboard_ops_sessions_idx
  on public.escape_events (merchant_id, event_type, created_at desc, bucket)
  include (eh_sid)
  where in_test = true
    and iab_kind = 'instagram'
    and event_type in ('escape_attempt', 'escape_skipped', 'iab_detected', 'fallback_shown', 'fallback_clicked');
