-- ─────────────────────────────────────────────────────────────────────────────
-- Overdue detection — the change that makes a journey a safety net rather than
-- a live viewer.
--
-- APPLIED. Full escalation ladder verified inside a rolled-back transaction:
--   [nudge] state=nudged | no repeat on the next tick | [alert] state=alerted
--   | extend -> state=none, future eta | quiet after extend
--
-- ── The gap this closes ─────────────────────────────────────────────────────
-- Until now silence meant everything at once. A traveller sitting in traffic,
-- one whose phone died, and one in real trouble all produced exactly the same
-- signal: nothing. auto_end_at has existed since the initial migration and is
-- written on creation, but NOTHING has ever read it. There was no timeout
-- anywhere in the product.
--
-- Every other feature here answers "where are they". None answered "they should
-- have been there by now" — which is the question that matters most, because it
-- is the only one that fires when the traveller can no longer act.
--
-- ── Why the ladder is gentle ────────────────────────────────────────────────
-- The overwhelming majority of overdue journeys are someone who lost track of
-- time. Alarming their family for that teaches everyone to swipe these away,
-- and then the one that matters gets swiped away too. So: the traveller alone
-- at the ETA, the watchers only after the grace window.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.sessions
  -- Null means no deadline and no monitoring. Better than inventing a deadline
  -- we cannot justify and then crying wolf against it.
  add column if not exists eta_at                timestamptz,
  add column if not exists overdue_grace_minutes integer not null default 15,
  add column if not exists overdue_state         text    not null default 'none',
  add column if not exists overdue_nudged_at     timestamptz,
  add column if not exists overdue_alerted_at    timestamptz;

alter table public.sessions drop constraint if exists sessions_overdue_state_check;
alter table public.sessions add constraint sessions_overdue_state_check
  check (overdue_state in ('none', 'nudged', 'alerted'));

create index if not exists sessions_overdue_scan_idx
  on public.sessions (eta_at)
  where is_active and eta_at is not null;

/**
 * Move every overdue journey one step along the escalation ladder.
 *
 * State advances BEFORE the notification is dispatched. If the HTTP call fails
 * the traveller is not re-nudged every minute; a missed alert is bounded, while
 * a per-minute alarm loop makes people disable notifications entirely — which
 * costs them every future alert too.
 */
create or replace function public.process_overdue_journeys()
returns TABLE(session_id uuid, action text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Past the grace window goes straight to the watchers rather than spending a
  -- cycle on a nudge nobody is going to read.
  for r in
    select s.id from public.sessions s
    where s.is_active and s.status = 'active'
      and s.eta_at is not null
      and s.overdue_state <> 'alerted'
      and now() >= s.eta_at + make_interval(mins => s.overdue_grace_minutes)
    for update skip locked
  loop
    update public.sessions
       set overdue_state = 'alerted', overdue_alerted_at = now()
     where id = r.id;
    perform public.call_edge_function(
      'notify-overdue', jsonb_build_object('sessionId', r.id, 'kind', 'alert'));
    session_id := r.id; action := 'alert'; return next;
  end loop;

  for r in
    select s.id from public.sessions s
    where s.is_active and s.status = 'active'
      and s.eta_at is not null
      and s.overdue_state = 'none'
      and now() >= s.eta_at
    for update skip locked
  loop
    update public.sessions
       set overdue_state = 'nudged', overdue_nudged_at = now()
     where id = r.id;
    perform public.call_edge_function(
      'notify-overdue', jsonb_build_object('sessionId', r.id, 'kind', 'nudge'));
    session_id := r.id; action := 'nudge'; return next;
  end loop;
end;
$$;

revoke all on function public.process_overdue_journeys() from public, anon, authenticated;

/**
 * Traveller pushes their deadline back — "still going, I'm fine".
 *
 * Resetting overdue_state is the point: an extension must genuinely re-arm the
 * ladder, otherwise a journey nudged once would never nudge again and would
 * slide silently past its new deadline.
 */
create or replace function public.extend_journey_eta(p_session_id uuid, p_minutes integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_new timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_minutes is null or p_minutes <= 0 or p_minutes > 720 then
    raise exception 'INVALID_EXTENSION';
  end if;

  update public.sessions
     set eta_at = greatest(coalesce(eta_at, now()), now()) + make_interval(mins => p_minutes),
         overdue_state = 'none', overdue_nudged_at = null, overdue_alerted_at = null
   where id = p_session_id and created_by = auth.uid() and is_active
  returning eta_at into v_new;

  if v_new is null then raise exception 'SESSION_NOT_FOUND'; end if;
  return v_new;
end;
$$;

revoke execute on function public.extend_journey_eta(uuid, integer) from public, anon;
grant execute on function public.extend_journey_eta(uuid, integer) to authenticated, service_role;

-- Every minute. The scan is indexed and touches only active journeys carrying a
-- deadline, so it stays cheap; a coarser schedule would only add latency to an
-- alert whose entire value is timeliness.
select cron.unschedule('process-overdue-journeys')
where exists (select 1 from cron.job where jobname = 'process-overdue-journeys');

select cron.schedule('process-overdue-journeys', '* * * * *',
  $cron$ select public.process_overdue_journeys(); $cron$);
