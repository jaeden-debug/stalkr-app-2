-- ─────────────────────────────────────────────────────────────────────────────
-- The journey watch page had no position until the traveller's NEXT GPS fix.
--
-- APPLIED and verified — see the probe results at the bottom.
--
-- Live position reached the watch page over a Realtime BROADCAST channel only.
-- Broadcast is ephemeral: no history, no replay, nothing retained. A watcher
-- opening the link saw an empty map until the traveller's next accepted fix —
-- up to a minute on the heartbeat, and indefinitely if the phone was
-- backgrounded, out of signal, or simply stationary (the position watcher is
-- gated on distanceInterval, so standing still emits nothing at all).
--
-- Someone opens that link because they are worried. A blank map is the worst
-- possible answer to "where are they right now", and it is indistinguishable
-- from "something is broken".
--
-- Persisting last-known position on the session row means the page renders a
-- real position the instant it loads, survives reconnects and refreshes, and —
-- because last_position_at travels with it — can honestly distinguish "here
-- they are now" from "here is where they were eight minutes ago".
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sessions
  add column if not exists last_latitude    double precision,
  add column if not exists last_longitude   double precision,
  add column if not exists last_heading     double precision,
  add column if not exists last_position_at timestamptz;

-- Return type changes require a drop. The old signature also echoed watch_token
-- back to the caller, needlessly repeating the capability token in a response
-- body that may be logged or cached. The client never read it.
drop function if exists public.get_session_by_watch_token(uuid);

create function public.get_session_by_watch_token(p_token uuid)
returns table (
  id uuid,
  name text,
  traveler_name text,
  destination_name text,
  destination_latitude double precision,
  destination_longitude double precision,
  status text,
  is_active boolean,
  started_at timestamptz,
  arrived_at timestamptz,
  ended_at timestamptz,
  last_latitude double precision,
  last_longitude double precision,
  last_heading double precision,
  last_position_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.name, s.traveler_name, s.destination_name,
         s.destination_latitude, s.destination_longitude,
         s.status, s.is_active, s.started_at, s.arrived_at, s.ended_at,
         s.last_latitude, s.last_longitude, s.last_heading, s.last_position_at
  from public.sessions s
  where s.watch_token = p_token;
$$;

revoke execute on function public.get_session_by_watch_token(uuid) from public;
grant execute on function public.get_session_by_watch_token(uuid)
  to anon, authenticated, service_role;

-- Writing position is the traveller's own action, so it is gated on OWNERSHIP
-- rather than on the token. Holding a watch link must never let a viewer move
-- the dot — a watcher who could write position could fake an arrival.
create or replace function public.update_session_position(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.sessions
     set last_latitude    = p_latitude,
         last_longitude   = p_longitude,
         last_heading     = p_heading,
         last_position_at = now()
   where id = p_session_id
     and created_by = auth.uid()
     and is_active;
end;
$$;

revoke execute on function public.update_session_position(uuid, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.update_session_position(uuid, double precision, double precision, double precision)
  to authenticated, service_role;

-- ── Verified after applying, as role anon ───────────────────────────────────
--   read journey via watch token  -> OK, new columns present
--   watch_token echoed in return  -> removed
--   anon writes position          -> BLOCKED (permission denied)
