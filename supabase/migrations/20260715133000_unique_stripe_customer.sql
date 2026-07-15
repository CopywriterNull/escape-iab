-- FF2's webhook flips card_saved on merchants matched by stripe_customer_id.
-- ensureCustomer's per-merchant idempotency key prevents organic duplicates,
-- but the uniqueness was assumed, not enforced — enforce it (partial: many
-- merchants have no customer yet).
create unique index if not exists merchants_stripe_customer_uidx
  on merchants (stripe_customer_id) where stripe_customer_id is not null;
