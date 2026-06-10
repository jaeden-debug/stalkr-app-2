-- 009_realtime_group_members.sql
-- group_members was not in the realtime publication, so the client's
-- subscription to roster changes (new members appearing live on join) never
-- fired. Add it. Guarded so re-running is safe.

do $$
begin
  alter publication supabase_realtime add table public.group_members;
exception
  when duplicate_object then null;  -- already in the publication
end $$;
