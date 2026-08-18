-- APPLIED. Mirrors what was run against the project so the repo stays in sync.
--
-- Let a creator recover crews that lost their membership row. The pre-016
-- non-atomic create path could leave a groups row with no members: invisible
-- in-app (fetchMyGroups reads THROUGH group_members) and undeletable
-- (groups_delete needs is_group_owner, false when nobody is a member).
--
-- Hands ownership back so the normal delete flow works, rather than deleting
-- anyone's data for them. Narrow by design: only crews YOU created, only ones
-- with ZERO members — it can never take over a crew someone else is in.
create or replace function public.reclaim_orphaned_crews()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  with orphans as (
    select g.id from public.groups g
    where g.created_by = v_uid
      and not exists (select 1 from public.group_members m where m.group_id = g.id)
  ), restored as (
    insert into public.group_members (group_id, user_id, role)
    select o.id, v_uid, 'owner' from orphans o
    on conflict (group_id, user_id) do nothing
    returning 1
  )
  select count(*) into v_count from restored;

  return v_count;
end; $$;

revoke all on function public.reclaim_orphaned_crews() from public, anon;
grant execute on function public.reclaim_orphaned_crews() to authenticated;
