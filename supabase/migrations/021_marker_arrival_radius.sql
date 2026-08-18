-- APPLIED. Mirrors what was run against the project so the repo stays in sync.
--
-- Arrival detection for individual markers. Zones already notify on
-- enter/leave; this adds the same idea one level down, so a crew hears
-- "Jaeden arrived at camp" as well as "Jaeden arrived at North Field".
-- The two nest: the camp pin sits inside the property zone, so walking in
-- produces the coarse zone event first and the precise marker event second.
alter table public.markers
  add column if not exists arrival_radius_m integer,
  add column if not exists notify_on_arrival boolean not null default false;

comment on column public.markers.arrival_radius_m is
  'Radius in metres for arrival detection. NULL = off. Small by design — a marker is a point of interest, not an area.';

create table if not exists public.marker_presence (
  id          uuid primary key default gen_random_uuid(),
  marker_id   uuid not null references public.markers(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  is_inside   boolean not null default false,
  arrived_at  timestamptz,
  updated_at  timestamptz not null default now(),
  unique (marker_id, user_id)
);

create index if not exists idx_marker_presence_marker on public.marker_presence (marker_id);
create index if not exists idx_marker_presence_group  on public.marker_presence (group_id);

alter table public.marker_presence enable row level security;

-- Same visibility as the marker: the crew sees who is there, only you write
-- your own presence.
drop policy if exists "mp_presence_select" on public.marker_presence;
create policy "mp_presence_select" on public.marker_presence
  for select using (public.is_group_member(group_id));

drop policy if exists "mp_presence_write" on public.marker_presence;
create policy "mp_presence_write" on public.marker_presence
  for all
  using (user_id = auth.uid() and public.is_group_contributor(group_id))
  with check (user_id = auth.uid() and public.is_group_contributor(group_id));
