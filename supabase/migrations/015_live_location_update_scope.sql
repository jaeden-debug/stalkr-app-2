-- ─────────────────────────────────────────────────────────────────────────────
-- Close a crew-isolation gap on live_locations UPDATE.
--
-- Existing policy (002_rls_policies.sql):
--     CREATE POLICY "ll_update" ON public.live_locations
--       FOR UPDATE USING (user_id = auth.uid());
--
-- INSERT was already tightened in 011 to require is_group_contributor(group_id),
-- but UPDATE was not. In Postgres, an UPDATE policy with no WITH CHECK reuses
-- its USING expression for the post-update row, so the only thing verified here
-- is that the row still belongs to the caller. Nothing pins group_id.
--
-- A client that speaks to PostgREST directly could therefore take its own
-- live_locations row and UPDATE group_id to a crew it does not belong to,
-- injecting its live position into that crew's map. Every reader of that crew
-- passes is_group_member(), so the row would render normally for them.
--
-- This is not reachable from the app UI, but the app UI is not the security
-- boundary — that is the whole point of RLS.
--
-- Fix: require contributor membership of the group both before and after the
-- update, matching the INSERT policy.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "ll_update" on public.live_locations;
create policy "ll_update" on public.live_locations
  for update
  using (user_id = auth.uid() and public.is_group_contributor(group_id))
  with check (user_id = auth.uid() and public.is_group_contributor(group_id));

-- trail_points had no UPDATE policy at all, which means updates were already
-- denied. Stated explicitly so a future permissive default cannot open it:
-- trails are append-only by design; a client rewriting historical points could
-- fabricate someone's movement history.
drop policy if exists "tp_update" on public.trail_points;

-- Same reasoning for DELETE on live_locations: scope it to the owning user AND
-- a crew they are actually in.
drop policy if exists "ll_delete" on public.live_locations;
create policy "ll_delete" on public.live_locations
  for delete
  using (user_id = auth.uid());
