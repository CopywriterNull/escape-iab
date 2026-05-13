-- Migration 0013 — allow unowned merchants for admin provisioning.
--
-- Before: merchants.user_id was NOT NULL → every merchant needed a
-- signed-up auth user before it could be created. Admin couldn't
-- provision a snippet for a client until the client logged in.
--
-- After: user_id is nullable. Admin tool can create merchants with
-- no user_id; assign later when the client signs up via:
--   update merchants set user_id = <client_user_id> where id = '<merchant_id>'.

alter table public.merchants
  alter column user_id drop not null;
