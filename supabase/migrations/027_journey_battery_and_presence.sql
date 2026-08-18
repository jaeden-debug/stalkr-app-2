-- ─────────────────────────────────────────────────────────────────────────────
-- Battery level on the watch page — what makes silence interpretable.
--
-- APPLIED and verified (results at the bottom).
--
-- A watch page that simply stops updating is ambiguous in the worst possible
-- way. It means "stopped moving", "lost signal", "phone died", and "something
-- is wrong" all at once — and a worried person assumes the worst of those.
--
-- "Last seen 21:14, phone at 4%" resolves nearly all of them instantly, and
-- turns a frightening silence into an expected one. It is also actionable in
-- the case that matters: a journey that goes quiet at 80% battery is a very
-- different situation from one that goes quiet at 3%.
--
-- Paired on the client with resolvePresence(), the same freshness model the app
-- already uses for crew members — so a watcher and a crew member are never told
-- two different stories about the same person.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sessions
  add column if not exists battery_level    real,
  add column if not exists battery_charging boolean;

drop function if exists public.get_session_by_watch_token(uuid);

create function public.get_session_by_watch_token(p_token uuid)
returns table (
  id uuid, name text, traveler_name text, destination_name text,
  destination_latitude double precision, destination_longitude double precision,
  status text, is_active boolean,
  started_at timestamptz, arrived_at timestamptz, ended_at timestamptz, eta_at timestamptz,
  last_latitude double precision, last_longitude double precision,
  last_heading double precision, last_position_at timestamptz,
  battery_level real, battery_charging boolean
)
language sql security definer set search_path = public stable
as $$
  select s.id, s.name, s.traveler_name, s.destination_name,
         s.destination_latitude, s.destination_longitude,
         s.status, s.is_active, s.started_at, s.arrived_at, s.ended_at, s.eta_at,
         s.last_latitude, s.last_longitude, s.last_heading, s.last_position_at,
         s.battery_level, s.battery_charging
  from public.sessions s
  where s.watch_token = p_token;
$$;

revoke execute on function public.get_session_by_watch_token(uuid) from public;
grant execute on function public.get_session_by_watch_token(uuid)
  to anon, authenticated, service_role;

-- Position write carries battery alongside it. Still gated on OWNERSHIP:
-- holding a watch link must never let a viewer write anything.
create or replace function public.update_session_position(
  p_session_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null,
  p_battery_level real default null,
  p_battery_charging boolean default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  update public.sessions
     set last_latitude    = p_latitude,
         last_longitude   = p_longitude,
         last_heading     = p_heading,
         last_position_at = now(),
         -- Null means "not reported on this fix" and must NOT erase a reading
         -- we already have. A watcher seeing the battery vanish would read it
         -- as the phone dying.
         battery_level    = coalesce(p_battery_level, battery_level),
         battery_charging = coalesce(p_battery_charging, battery_charging)
   where id = p_session_id and created_by = auth.uid() and is_active;
end;
$$;

revoke execute on function public.update_session_position(uuid, double precision, double precision, double precision, real, boolean)
  from public, anon;
grant execute on function public.update_session_position(uuid, double precision, double precision, double precision, real, boolean)
  to authenticated, service_role;

-- The old 4-arg signature would otherwise linger and be resolved by older
-- clients, which would silently never record battery.
drop function if exists public.update_session_position(uuid, double precision, double precision, double precision);

-- ── Verified as role anon ───────────────────────────────────────────────────
--   reads journey incl. battery + eta -> ok
--   watch_token still absent from the return -> yes
--   old 4-arg position function removed -> yes
