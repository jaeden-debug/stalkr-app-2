-- ─────────────────────────────────────────────────────────────────────────────
-- Crew lifecycle: joining, creating and leaving must be server-authoritative.
--
-- Three defects addressed, all reachable from normal use.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. P0: joining a crew by invite code was IMPOSSIBLE ──────────────────────
--
-- groups_select is `USING (public.is_group_member(id))`, but the client joined by
-- doing:
--     supabase.from('groups').select('*').eq('invite_code', code)
-- as a NON-member. RLS correctly returned zero rows, .single() errored, and the
-- join silently returned null. Every entry point — the /invite/[code] deep link,
-- the Crews tab and the nav drawer — funnels through that one call, so no user
-- could ever join a crew by code.
--
-- The fix is NOT to loosen groups_select: letting any authenticated user read
-- arbitrary groups would leak crew names and invite codes wholesale. Instead a
-- SECURITY DEFINER function performs the lookup, and only ever reveals a crew to
-- a caller who already supplied that crew's valid code.
create or replace function public.join_crew_by_code(p_code text)
returns table (
  id uuid,
  name text,
  type group_type,
  created_by uuid,
  invite_code text,
  invite_enabled boolean,
  tracking_mode text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_group
  from public.groups g
  where g.invite_code = upper(btrim(p_code))
    and g.invite_enabled = true;

  -- One generic failure for "no such code", "code disabled" and "typo" so the
  -- function cannot be used to enumerate which codes exist.
  if not found then
    raise exception 'INVALID_INVITE';
  end if;

  -- Idempotent: accepting the same invite twice yields exactly one membership.
  -- The UNIQUE (group_id, user_id) constraint is the real guarantee; ON CONFLICT
  -- turns a double-tap into a no-op instead of an error the UI has to interpret.
  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return query
    select g.id, g.name, g.type, g.created_by, g.invite_code,
           g.invite_enabled, g.tracking_mode, g.created_at, g.updated_at
    from public.groups g
    where g.id = v_group.id;
end;
$$;

revoke all on function public.join_crew_by_code(text) from public;
grant execute on function public.join_crew_by_code(text) to authenticated;


-- ── 2. P1: crew creation was not atomic ──────────────────────────────────────
--
-- The client inserted the group, then separately inserted the owner membership
-- WITHOUT checking that second insert's error. If it failed, the result was an
-- orphaned crew with no members — invisible to fetchMyGroups (which reads
-- through group_members), so the user could neither see nor delete it, while the
-- app optimistically showed it as owned.
--
-- Both writes now happen in one function, so they share a transaction.
create or replace function public.create_crew(
  p_name text,
  p_type group_type default 'custom',
  p_tracking_mode text default 'flexible'
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_tracking_mode not in ('flexible', 'enforced') then
    raise exception 'INVALID_TRACKING_MODE';
  end if;

  insert into public.groups (name, type, created_by, tracking_mode)
  values (btrim(p_name), p_type, v_uid, p_tracking_mode)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'owner');

  return v_group;
end;
$$;

revoke all on function public.create_crew(text, group_type, text) from public;
grant execute on function public.create_crew(text, group_type, text) to authenticated;


-- ── 3. P1: the last owner could leave, orphaning the crew ────────────────────
--
-- leaveGroup deleted the membership unconditionally. An owner leaving a crew
-- with no other owner left it permanently unadministrable: groups_update and
-- groups_delete both require is_group_admin / is_group_owner, so nobody could
-- rename it, change tracking policy, or delete it ever again.
create or replace function public.leave_crew(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role member_role;
  v_owner_count integer;
  v_member_count integer;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select role into v_role
  from public.group_members
  where group_id = p_group and user_id = v_uid;

  -- Already gone — leaving twice is a no-op, not an error.
  if not found then
    return;
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.group_members
    where group_id = p_group and role = 'owner';

    select count(*) into v_member_count
    from public.group_members
    where group_id = p_group;

    -- A sole owner who is also the sole member may leave: the crew is emptied
    -- and cascades away. What must not happen is an owner abandoning a crew that
    -- still has members in it.
    if v_owner_count <= 1 and v_member_count > 1 then
      raise exception 'LAST_OWNER';
    end if;
  end if;

  delete from public.group_members
  where group_id = p_group and user_id = v_uid;

  -- Emptied crew: remove it rather than leaving an unreachable row behind.
  select count(*) into v_member_count
  from public.group_members where group_id = p_group;
  if v_member_count = 0 then
    delete from public.groups where id = p_group;
  end if;
end;
$$;

revoke all on function public.leave_crew(uuid) from public;
grant execute on function public.leave_crew(uuid) to authenticated;


-- ── 4. Invite-code rotation belongs on the server ────────────────────────────
--
-- regenerateInviteCode built the code client-side with
--     Math.random().toString(36).substring(2, 10)
-- Math.random is not a CSPRNG, so codes were predictable from prior output —
-- and this is the only secret guarding crew membership. It also wrote directly
-- to groups.invite_code, which groups_update permits for any admin but does not
-- constrain the VALUE of.
--
-- The column default already uses gen_random_uuid(); this makes rotation match.
create or replace function public.regenerate_invite_code(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'FORBIDDEN';
  end if;

  -- 10 hex chars ≈ 40 bits from a CSPRNG, up from 8.
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  update public.groups
  set invite_code = v_code, updated_at = now()
  where id = p_group;

  return v_code;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
