-- Guided-mode 3-way cohort analysis, scoped to the iOS Meta IAB population so
-- control / prompted-stayed / escaped are apples-to-apples.
--   escaped = guided_shown AND landed (impression with opened_external_browser=true)
--   stayed  = guided_shown but never landed
--   control = iOS Meta bucket B (in-app, never prompted)
-- "escaped" uses the ground-truth post-escape landing, NOT guided_escaped, which
-- fires on any backgrounding and over-counts. Android Meta auto-escapes (no
-- overlay) and is intentionally excluded from this iOS-guided readout.
create or replace function eh_guided_cohorts(p_merchant uuid, p_since timestamptz)
returns table (
  control_b_sessions bigint, control_b_purchases bigint, control_b_revenue_cents bigint,
  a_total_sessions bigint, a_shown_sessions bigint, a_escaped_sessions bigint, a_stayed_sessions bigint,
  a_escaped_purchases bigint, a_escaped_revenue_cents bigint,
  a_stayed_purchases bigint, a_stayed_revenue_cents bigint
) language sql stable as $$
  with ev as (
    select eh_sid, event_type, bucket, value_cents, url, iab_kind, user_agent
    from escape_events
    where merchant_id = p_merchant and in_test = true
      and created_at >= p_since and eh_sid is not null
  ),
  ios_meta_b as (select distinct eh_sid from ev where bucket='b' and event_type='impression'
    and iab_kind in ('instagram','threads') and (user_agent ilike '%iphone%' or user_agent ilike '%ipad%')),
  shown as (select distinct eh_sid from ev where event_type='guided_shown'),
  landed as (select distinct eh_sid from ev where event_type='impression' and url ilike '%opened_external_browser=true%'),
  escaped as (select eh_sid from shown where eh_sid in (select eh_sid from landed)),
  stayed as (select eh_sid from shown where eh_sid not in (select eh_sid from landed)),
  a_sessions as (select distinct eh_sid from ev where bucket='a' and event_type='impression')
  select
    (select count(*) from ios_meta_b),
    (select count(*) from ev where event_type='purchase' and eh_sid in (select eh_sid from ios_meta_b)),
    coalesce((select sum(value_cents) from ev where event_type='purchase' and eh_sid in (select eh_sid from ios_meta_b)),0),
    (select count(*) from a_sessions),
    (select count(*) from shown),
    (select count(*) from escaped),
    (select count(*) from stayed),
    (select count(*) from ev where event_type='purchase' and eh_sid in (select eh_sid from escaped)),
    coalesce((select sum(value_cents) from ev where event_type='purchase' and eh_sid in (select eh_sid from escaped)),0),
    (select count(*) from ev where event_type='purchase' and eh_sid in (select eh_sid from stayed)),
    coalesce((select sum(value_cents) from ev where event_type='purchase' and eh_sid in (select eh_sid from stayed)),0)
$$;
