-- 010_safety_systems.sql
-- Emergency medical profile + dead-man / check-in escalation support, plus a
-- server-side enforcement function so missed check-ins escalate even when the
-- user's app is backgrounded or killed (client timers can't fire then).

-- ── Emergency medical profile (on profiles) ──────────────────────────────────
alter table public.profiles
  add column if not exists blood_type            text,
  add column if not exists allergies             text,
  add column if not exists medications           text,
  add column if not exists medical_notes         text,
  add column if not exists medical_share_with_crew boolean not null default false;

-- ── Check-in / dead-man fields ───────────────────────────────────────────────
alter table public.check_in_timers
  add column if not exists mode             text not null default 'checkin',  -- 'checkin' | 'deadman'
  add column if not exists interval_minutes integer,
  add column if not exists reminder_sent    boolean not null default false,
  add column if not exists escalated        boolean not null default false,
  add column if not exists escalated_at     timestamptz,
  add column if not exists acknowledged_at  timestamptz;

create index if not exists idx_check_in_timers_due
  on public.check_in_timers (is_resolved, escalated, check_in_at);

-- ── Server-side escalation ───────────────────────────────────────────────────
-- Flags overdue, unresolved, not-yet-escalated timers and writes a group_events
-- row (which streams to crew via realtime). A scheduled job should call this,
-- e.g. with pg_cron:  select cron.schedule('escalate-checkins','* * * * *',
-- 'select public.escalate_overdue_checkins()');
-- For background PUSH delivery, pair this with an edge function that reads the
-- newly-written group_events and calls send-push.
create or replace function public.escalate_overdue_checkins()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  n integer := 0;
begin
  for rec in
    select * from public.check_in_timers
    where is_resolved = false
      and escalated = false
      and check_in_at <= now()
  loop
    update public.check_in_timers
      set escalated = true, escalated_at = now()
      where id = rec.id;

    if rec.group_id is not null then
      insert into public.group_events (group_id, user_id, event_type, title, body, metadata)
      values (
        rec.group_id,
        rec.user_id,
        case when rec.mode = 'deadman' then 'deadman_triggered' else 'checkin_timer_missed' end,
        case when rec.mode = 'deadman' then 'Dead-man switch activated' else 'Check-in missed' end,
        coalesce(rec.label, 'Safety timer was not confirmed.'),
        jsonb_build_object('timer_id', rec.id, 'mode', rec.mode)
      );
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.escalate_overdue_checkins() from public;
