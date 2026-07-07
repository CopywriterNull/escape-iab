-- One live (pending) invitation per email per merchant. inviteMember
-- refreshes the existing pending row instead of inserting, but that
-- select-then-insert has a double-submit race; enforce the invariant at
-- the DB layer so a losing racer fails the insert (surfaced as
-- invite_failed) instead of silently creating a duplicate token.
create unique index if not exists invitations_one_pending_per_email
  on public.invitations (merchant_id, email)
  where status = 'pending';
