-- 006_crew_notification_prefs.sql
-- Per-crew and per-member notification preferences (in addition to the global
-- per-user prefs in user_notification_prefs). These let a user tune, for each
-- crew they're in, which crew/zone alerts they receive — and per individual
-- member, whether to be alerted when that member enters/leaves/overstays a zone.
--
-- The client (useCrewPrefsStore) persists these locally for instant/offline use
-- and syncs here for cross-device permanence. Server-side push filtering can be
-- extended to read these tables.

-- ── Per-crew prefs ───────────────────────────────────────────────────────────
create table if not exists public.crew_notification_prefs (
  user_id     uuid not null references auth.users (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,
  muted       boolean not null default false,
  -- null = inherit the user's global default (user_notification_prefs)
  notify_crew_zone_activity boolean,
  notify_sos  boolean,
  updated_at  timestamptz not null default now(),
  primary key (user_id, group_id)
);

-- ── Per-member prefs (scoped to a crew) ──────────────────────────────────────
create table if not exists public.member_notification_prefs (
  user_id        uuid not null references auth.users (id) on delete cascade,
  group_id       uuid not null references public.groups (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  notify_enter    boolean not null default true,
  notify_leave    boolean not null default true,
  notify_overstay boolean not null default true,
  muted           boolean not null default false,
  updated_at     timestamptz not null default now(),
  primary key (user_id, group_id, target_user_id)
);

-- ── RLS — a user can only read/write their own preference rows ────────────────
alter table public.crew_notification_prefs   enable row level security;
alter table public.member_notification_prefs enable row level security;

create policy "crew_prefs_owner" on public.crew_notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "member_prefs_owner" on public.member_notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
