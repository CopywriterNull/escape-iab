-- Merchant owners can UPDATE their own merchants row (policy "merchants owner
-- update", 20260707160000). The billing columns added by 20260715120000 must
-- not be writable by session roles — a merchant could zero their own fees
-- (rev_share_pct=0, base_fee_waived=true) or stop drafting (billing_status).
-- Triggers DO fire for every role, including service_role — this function
-- whitelists service_role (and postgres/supabase_admin) so admin actions and
-- cron writes still work, and blocks everyone else from touching these
-- columns.

alter table merchants add column if not exists card_saved boolean not null default false;

-- SECURITY INVOKER (the default) is load-bearing here: inside a SECURITY
-- DEFINER function current_user resolves to the function OWNER (postgres),
-- which would make the whitelist below always pass and the guard a no-op.
-- With invoker semantics current_user is the role performing the UPDATE
-- (anon/authenticated via PostgREST, service_role for admin actions + cron).
create or replace function eh_protect_billing_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.billing_status is distinct from old.billing_status
     or new.billing_anchor is distinct from old.billing_anchor
     or new.base_fee_cents is distinct from old.base_fee_cents
     or new.base_fee_waived is distinct from old.base_fee_waived
     or new.rev_share_pct is distinct from old.rev_share_pct
     or new.billing_setup_token is distinct from old.billing_setup_token
     or new.card_saved is distinct from old.card_saved then
    raise exception 'billing columns are managed by the operator';
  end if;
  return new;
end $$;

drop trigger if exists merchants_protect_billing_columns on merchants;
create trigger merchants_protect_billing_columns
  before update on merchants
  for each row execute function eh_protect_billing_columns();
