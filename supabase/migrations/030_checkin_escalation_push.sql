-- ─────────────────────────────────────────────────────────────────────────────
-- A lapsed deadman switch now actually reaches someone.
--
-- APPLIED and verified end to end.
--
-- escalate_overdue_checkins() marked the timer and wrote a group_events row,
-- then stopped. Crew members learned that someone's safety timer had lapsed
-- only if they happened to open the app. For the one feature whose entire
-- purpose is "tell someone if I stop responding", a passive feed entry is not
-- delivery.
--
-- Escalation now dispatches to the notify-checkin edge function, which pushes
-- to the users recorded ON THE TIMER at arm time — not the crew's current
-- admins. The person who armed it was shown who would be told, and that promise
-- should not silently change if the roster does.
--
-- The push fires AFTER the row is marked escalated, so a delivery failure
-- cannot make the same timer alarm every minute. Same ordering as journey
-- overdue, for the same reason.
--
-- The dispatch log is renamed: it is no longer journey-specific, and a table
-- called journey_alert_log holding check-in failures is the kind of naming
-- drift that makes an incident harder to read at 3am.
--
-- ── Client dedupe (see src/store/useSafetyStore.ts) ─────────────────────────
-- The client escalates immediately when the app is alive, which beats waiting
-- up to a minute for the sweep. It previously did NOT write escalated=true, so
-- once this sweep went live the crew would have been alerted TWICE for one
-- missed check-in, with two feed entries. The client now claims the escalation
-- with a conditional update (escalated=false) before notifying; whichever path
-- gets there first wins and the other does nothing.
--
-- ── Verified ────────────────────────────────────────────────────────────────
-- Probe timer whose only recipient had no push token, so nothing reached a real
-- device:  escalation sweep -> dispatched -> delivered
--          {"pushed":0,"reason":"no_push_tokens","recipients":1}
-- Probe rows removed afterwards.
-- ─────────────────────────────────────────────────────────────────────────────

alter table if exists public.journey_alert_log rename to alert_dispatch_log;
alter index if exists journey_alert_log_session_idx rename to alert_dispatch_log_session_idx;

-- call_edge_function / reconcile_alert_dispatches / journey_alerting_health are
-- rebound to the renamed table; journey_alerting_health additionally reports on
-- all three safety schedules rather than one. Bodies applied as in migration.

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
    where is_resolved = false and escalated = false and check_in_at <= now()
    for update skip locked
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

    -- Actually tell the people this timer names.
    perform public.call_edge_function(
      'notify-checkin',
      jsonb_build_object('timerId', rec.id),
      null,
      case when rec.mode = 'deadman' then 'deadman' else 'checkin' end
    );

    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.escalate_overdue_checkins() from public, anon, authenticated;
