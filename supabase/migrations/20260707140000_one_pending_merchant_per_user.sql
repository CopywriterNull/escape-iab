-- One pending (self-serve signup) merchant per creating user. The signup
-- action's check-then-insert has a double-submit race; enforce the
-- invariant at the DB layer so the losing racer's insert errors (surfaced
-- as create_failed) instead of minting a duplicate pending workspace.
-- Scoped to user_id is not null so admin-created rows (null user_id) and
-- live merchants are unaffected.
create unique index if not exists merchants_one_pending_per_user
  on public.merchants (user_id)
  where status = 'pending' and user_id is not null;
