-- 011_roles_and_growth.sql
-- Expands crew roles to Owner/Admin/Moderator/Member/Viewer with enforced RLS,
-- a safe ownership-transfer function, and foundations for invite management +
-- referrals.

-- ── Roles ────────────────────────────────────────────────────────────────────
alter type member_role add value if not exists 'moderator';
alter type member_role add value if not exists 'viewer';

-- ── Role helper functions ────────────────────────────────────────────────────
create or replace function public.is_group_moderator(gid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner','admin','moderator'));
$$;

-- Contributors can create content; viewers cannot.
create or replace function public.is_group_contributor(gid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner','admin','moderator','member'));
$$;

-- ── Enforce read-only viewers + moderator content removal ────────────────────
-- Markers: only contributors create; creator/moderator/admin delete.
drop policy if exists "markers_insert" on public.markers;
create policy "markers_insert" on public.markers for insert
  with check (public.is_group_contributor(group_id) and created_by = auth.uid());
drop policy if exists "markers_delete" on public.markers;
create policy "markers_delete" on public.markers for delete
  using (created_by = auth.uid() or public.is_group_moderator(group_id));

-- Saved places (zones): contributors create; creator/admin update/delete.
drop policy if exists "sp_insert" on public.saved_places;
create policy "sp_insert" on public.saved_places for insert
  with check (public.is_group_contributor(group_id) and created_by = auth.uid());

-- Live locations + trail points: contributors only (viewers don't broadcast).
drop policy if exists "ll_insert" on public.live_locations;
create policy "ll_insert" on public.live_locations for insert
  with check (user_id = auth.uid() and public.is_group_contributor(group_id));
drop policy if exists "tp_insert" on public.trail_points;
create policy "tp_insert" on public.trail_points for insert
  with check (user_id = auth.uid() and public.is_group_contributor(group_id));

-- ── Ownership transfer (only the current owner) ──────────────────────────────
create or replace function public.transfer_crew_ownership(p_group uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_members
    where group_id = p_group and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can transfer ownership';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = p_new_owner) then
    raise exception 'New owner must be a member of the crew';
  end if;
  update public.group_members set role = 'admin', updated_at = now()
    where group_id = p_group and user_id = auth.uid();
  update public.group_members set role = 'owner', updated_at = now()
    where group_id = p_group and user_id = p_new_owner;
  update public.groups set created_by = p_new_owner, updated_at = now() where id = p_group;
end;
$$;
grant execute on function public.transfer_crew_ownership(uuid, uuid) to authenticated;

-- ── Invite management ────────────────────────────────────────────────────────
-- Multiple revocable invites per crew (one-time / time-limited / permanent).
create table if not exists public.crew_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  code        text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  max_uses    integer,                 -- null = unlimited
  uses        integer not null default 0,
  expires_at  timestamptz,             -- null = permanent
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_crew_invites_group on public.crew_invites (group_id);
alter table public.crew_invites enable row level security;
create policy "crew_invites_read"   on public.crew_invites for select using (public.is_group_member(group_id));
create policy "crew_invites_manage" on public.crew_invites for all
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

-- ── Referrals ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists referral_code text unique
    default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_reward_granted boolean not null default false;

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id  uuid references public.profiles(id) on delete set null,
  invitee_email text,
  status      text not null default 'pending' check (status in ('pending','installed','registered','rewarded')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_referrals_referrer on public.referrals (referrer_id);
alter table public.referrals enable row level security;
create policy "referrals_own" on public.referrals for select using (referrer_id = auth.uid());
