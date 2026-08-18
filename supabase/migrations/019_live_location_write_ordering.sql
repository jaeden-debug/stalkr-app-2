-- APPLIED. Mirrors what was run against the project so the repo stays in sync.
--
-- Server-side write ordering for live_locations.
--
-- live_locations is UNIQUE (group_id, user_id) and the client wrote it with a
-- plain upsert, so whoever wrote LAST won regardless of when the fix was taken.
-- Wrong in two situations that happen in practice:
--   1. one account on two devices -> the crew sees the marker flick between them
--   2. one device on a flaky network -> a retried write lands after a newer one
--
-- The client guard (utils/eventOrder.ts) protects the READ path only; once a
-- stale row is stored every other client fetches it.
--
-- Verified against the live database: a 10:04:04 write arriving after 10:04:08
-- is discarded, and a subsequent 10:04:12 write still applies.
create or replace function public.upsert_live_location(
  p_group_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_approximate_latitude double precision,
  p_approximate_longitude double precision,
  p_heading double precision,
  p_speed double precision,
  p_accuracy double precision,
  p_battery_level integer,
  p_status location_status,
  p_sharing_mode sharing_mode,
  p_is_approximate boolean,
  p_last_ping_at timestamptz
)
returns void
language plpgsql
security invoker            -- keep RLS in force: ll_insert/ll_update still apply
set search_path = public
as $$
begin
  insert into public.live_locations (
    group_id, user_id, latitude, longitude,
    approximate_latitude, approximate_longitude,
    heading, speed, accuracy, battery_level,
    status, sharing_mode, is_approximate,
    last_ping_at, updated_at
  ) values (
    p_group_id, auth.uid(), p_latitude, p_longitude,
    p_approximate_latitude, p_approximate_longitude,
    p_heading, p_speed, p_accuracy, p_battery_level,
    p_status, p_sharing_mode, p_is_approximate,
    p_last_ping_at, p_last_ping_at
  )
  on conflict (group_id, user_id) do update set
    latitude              = excluded.latitude,
    longitude             = excluded.longitude,
    approximate_latitude  = excluded.approximate_latitude,
    approximate_longitude = excluded.approximate_longitude,
    heading               = excluded.heading,
    speed                 = excluded.speed,
    accuracy              = excluded.accuracy,
    battery_level         = excluded.battery_level,
    status                = excluded.status,
    sharing_mode          = excluded.sharing_mode,
    is_approximate        = excluded.is_approximate,
    last_ping_at          = excluded.last_ping_at,
    updated_at            = excluded.updated_at
  where excluded.last_ping_at > public.live_locations.last_ping_at;
end;
$$;

revoke all on function public.upsert_live_location(
  uuid, double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, integer,
  location_status, sharing_mode, boolean, timestamptz
) from public, anon;

grant execute on function public.upsert_live_location(
  uuid, double precision, double precision, double precision, double precision,
  double precision, double precision, double precision, integer,
  location_status, sharing_mode, boolean, timestamptz
) to authenticated;
