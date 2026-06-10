-- 007_delete_account.sql
-- Self-service account deletion (required by the App Store). A SECURITY DEFINER
-- function lets an authenticated user delete their own auth.users row; all
-- dependent rows (profiles, group_members, sessions, etc.) cascade via their
-- foreign keys with `on delete cascade`.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only ever deletes the caller's own account.
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
