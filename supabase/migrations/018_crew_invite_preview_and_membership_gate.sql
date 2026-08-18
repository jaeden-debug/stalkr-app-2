-- APPLIED. Mirrors what was run against the project so the repo stays in sync.
--
-- 1. Public invite preview. app/invite/[code]+web.tsx queried `groups` by
--    invite_code as anon, but groups_select is USING (is_group_member(id)), so
--    anon matched nothing and EVERY invite link rendered "invalid". Exposes only
--    name + member count to a caller already holding a valid code.
create or replace function public.peek_crew_invite(p_code text)
returns table (name text, member_count bigint)
language plpgsql security definer set search_path = public as $$
declare v_group public.groups%rowtype;
begin
  select * into v_group from public.groups g
  where g.invite_code = upper(btrim(p_code)) and g.invite_enabled = true;
  if not found then return; end if;
  return query
    select v_group.name,
           (select count(*) from public.group_members m where m.group_id = v_group.id);
end; $$;

revoke all on function public.peek_crew_invite(text) from public;
grant execute on function public.peek_crew_invite(text) to anon, authenticated;

-- 2. P1: membership was not gated on an invite. BOTH insert policies permitted
--    a bare `user_id = auth.uid()`, so any authenticated user who learned a
--    crew UUID could insert themselves in with no code. Legitimate joins go
--    through join_crew_by_code (SECURITY DEFINER, unaffected); no client path
--    inserts directly.
drop policy if exists "Users can join groups as themselves" on public.group_members;
drop policy if exists "group_members_insert_admin_or_self_invite" on public.group_members;
drop policy if exists "gm_insert" on public.group_members;
create policy "gm_insert" on public.group_members
  for insert
  with check (public.is_group_admin(group_id));
