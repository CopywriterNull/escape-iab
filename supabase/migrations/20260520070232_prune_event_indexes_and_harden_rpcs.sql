-- Prune indexes that became redundant after moving cart-token attribution
-- out of escape_events, and lock SECURITY DEFINER RPCs to service-role usage.

drop index if exists public.escape_events_merchant_cart_token_idx;
drop index if exists public.escape_events_admin_ig_iab_impressions_idx;
drop index if exists public.escape_events_admin_ig_escape_sessions_idx;
drop index if exists public.escape_events_admin_ig_purchases_idx;
drop index if exists public.escape_events_merchant_type_idx;
drop index if exists public.escape_events_merchant_kind_idx;
drop index if exists public.escape_events_merchant_utm_idx;

drop policy if exists "cart attributions self read" on public.cart_attributions;
create policy "cart attributions self read" on public.cart_attributions
for select using (
  exists (
    select 1
    from public.merchants m
    where m.id = cart_attributions.merchant_id
      and m.user_id = (select auth.uid())
  )
);

revoke execute on function public.eh_increment_rollup(uuid, date, text, text) from anon, authenticated;
revoke execute on function public.eh_increment_rollup(uuid, date, text, text, integer) from anon, authenticated;
revoke execute on function public.eh_test_funnel(uuid, timestamptz) from anon, authenticated;
revoke execute on function public.eh_test_sources(uuid, timestamptz, integer) from anon, authenticated;
