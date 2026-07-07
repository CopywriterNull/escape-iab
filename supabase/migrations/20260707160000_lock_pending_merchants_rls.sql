-- Phase 3 hardening: the approval gate must hold at the data layer.
-- Self-serve signups get an owner membership on their PENDING merchant,
-- and the Phase 1 owner-update policy had no status restriction — an
-- unapproved owner could PATCH status='live' (self-approve) through
-- PostgREST with the public anon key. Restrict session-client owner
-- updates to live rows, and forbid writing any status other than 'live'
-- so no owner can transition status at all. Admin approve/reject go
-- through the service-role client, which bypasses RLS.
drop policy if exists "merchants owner update" on public.merchants;
create policy "merchants owner update" on public.merchants
  for update
  using (public.eh_member_role(id) = 'owner' and status = 'live')
  with check (status = 'live');
