-- The guided-mode beacons were being dropped because escape_events has TWO
-- allowlists and only the app-level one (ALLOWED_EVENTS in /api/track) had been
-- updated. This DB CHECK constraint is the second gate; the track route does not
-- surface the insert error, so a violating insert returned {ok:true} and the
-- beacon was silently lost. Add the guided_* types here too.
-- NOT VALID: skip the full-table validation scan (every existing row already
-- satisfies the superset); the constraint still enforces all NEW inserts.
alter table escape_events drop constraint if exists escape_events_event_type_check;
alter table escape_events add constraint escape_events_event_type_check
  check (event_type = any (array[
    'impression','iab_detected','escape_attempt','escape_skipped',
    'fallback_shown','fallback_clicked',
    'guided_shown','guided_scheme_tapped','guided_escaped','guided_copied','guided_dismissed',
    'product_viewed','add_to_cart','checkout_started','purchase','cart_check'
  ])) not valid;
