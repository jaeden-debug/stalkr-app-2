-- ─────────────────────────────────────────────────────────────────────────────
-- Being named a watcher must grant read access to the journey.
--
-- APPLIED and verified against real rows (see results at the bottom).
--
-- ── The problem ─────────────────────────────────────────────────────────────
-- Session reads were gated purely on crew membership:
--   sessions_select_group_members USING is_group_member(group_id)
--
-- That works for a crew-tied journey and fails everywhere else:
--   - a journey started with no active crew has group_id null, so
--     is_group_member is false and the people explicitly invited to watch it
--     cannot read it
--   - a watcher outside the traveller's crew cannot read it either
--
-- So an in-app watcher receives "X started a journey", taps it, and finds
-- nothing: invited to watch something the database will not let them see.
--
-- Being added as a watcher IS the grant. The traveller chose those people
-- deliberately, one at a time, which is a stronger statement of intent than
-- shared crew membership.
--
-- Read only. Every write path stays gated on created_by or crew admin, so a
-- watcher can never forge an arrival — verified below.
--
-- ── Note on the first attempt ───────────────────────────────────────────────
-- The initial version wrote these policies as inline EXISTS over
-- session_watchers. The policy ON session_watchers then had to evaluate itself
-- to decide whether it could read session_watchers:
--   "infinite recursion detected in policy for relation session_watchers"
-- Any read by a watcher errored outright. The fix is the SECURITY DEFINER
-- predicate below, which runs as the owner and does not re-enter RLS — the
-- same pattern is_group_member and is_session_member already use.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.is_session_watcher(p_session_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.session_watchers w
    where w.session_id = p_session_id
      and w.user_id = auth.uid()
  );
$$;

grant execute on function public.is_session_watcher(uuid) to authenticated, anon, service_role;

drop policy if exists "sessions_select_watcher" on public.sessions;
create policy "sessions_select_watcher"
  on public.sessions
  for select
  using (public.is_session_watcher(id));

-- Watchers can see who else is watching, so the traveller's chosen circle is
-- visible to itself. Scoped to journeys they actually watch.
drop policy if exists "sw_watcher_select_peers" on public.session_watchers;
create policy "sw_watcher_select_peers"
  on public.session_watchers
  for select
  using (public.is_session_watcher(session_id));

create index if not exists session_watchers_user_idx
  on public.session_watchers (user_id) where user_id is not null;

-- ── Verified as role authenticated, on a journey detached from any crew ─────
--   non-watcher reads solo journey -> rows=0   (no leak)
--   watcher reads solo journey     -> rows=1   (grant works)
--   watcher forges arrival         -> rows_updated=0 (read-only holds)
--   watcher sees peer list         -> rows=1   (no recursion)
-- Original group_id/status restored afterwards.
