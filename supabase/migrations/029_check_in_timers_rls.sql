-- ─────────────────────────────────────────────────────────────────────────────
-- P0: the check-in / deadman-switch safety feature is broken at THREE
-- independent layers. Fixing any one of them alone leaves it non-functional.
--
-- APPLIED with authorization.
--
-- ── Layer 1: RLS denies everything ──────────────────────────────────────────
-- check_in_timers has RLS enabled with ZERO policies. In Postgres that denies
-- every operation to every non-superuser role. Verified as role authenticated:
--   insert -> BLOCKED: new row violates row-level security policy
--   select -> 0 rows
--
-- ── Layer 2: the client writes a column that does not exist ─────────────────
-- services/checkInTimers.ts inserts `notify_user_ids`, and the table has no
-- such column. The insert would therefore fail with an undefined-column error
-- EVEN IF RLS allowed it. (An earlier draft of this migration referenced the
-- same phantom column in a policy and would have failed to apply — caught by
-- checking the live schema before applying rather than after.)
--
-- The column is added rather than removed from the client because it records
-- WHO should be told, captured at arm time. Deriving recipients later from
-- current crew admins would notify a different set of people than the user was
-- shown when they armed it.
--
-- ── Layer 3: nothing ever escalates ─────────────────────────────────────────
-- escalate_overdue_checkins() exists (migration 010) and is correct, but no
-- schedule ever invoked it. A missed check-in escalated only via a LOCAL
-- notification on the user's own phone — which, for a deadman switch, protects
-- nobody: if you are incapacitated, your own phone buzzing is not a safety net.
--
-- ── Known remaining limitation ──────────────────────────────────────────────
-- escalate_overdue_checkins() writes a group_events row and nothing else. Crew
-- members see it only if they open the app. There is no push. That is a real
-- gap for a deadman switch and is called out rather than silently accepted.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Layer 2 ─────────────────────────────────────────────────────────────────
-- Snapshot of the crew admins to alert, captured when the timer was armed.
alter table public.check_in_timers
  add column if not exists notify_user_ids uuid[] not null default '{}';

-- ── Layer 1 ─────────────────────────────────────────────────────────────────
drop policy if exists "cit_select_own_or_notified" on public.check_in_timers;
create policy "cit_select_own_or_notified"
  on public.check_in_timers
  for select
  using (
    user_id = auth.uid()
    -- The people this timer escalates to can read it. Scoped to the recorded
    -- notify list rather than to crew membership, so a timer exposes itself
    -- only to those it will actually alert.
    or auth.uid() = any(notify_user_ids)
  );

drop policy if exists "cit_insert_own" on public.check_in_timers;
create policy "cit_insert_own"
  on public.check_in_timers
  for insert
  with check (user_id = auth.uid());

-- Update is how a timer is RESOLVED ("I'm safe"). Only the owner may say that:
-- letting anyone else resolve it would let a third party silence someone's
-- safety timer.
drop policy if exists "cit_update_own" on public.check_in_timers;
create policy "cit_update_own"
  on public.check_in_timers
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "cit_delete_own" on public.check_in_timers;
create policy "cit_delete_own"
  on public.check_in_timers
  for delete
  using (user_id = auth.uid());

-- The active-timer lookup filters on (user_id, is_resolved) ordered by
-- created_at; unindexed it degrades as history accumulates.
create index if not exists check_in_timers_active_idx
  on public.check_in_timers (user_id, is_resolved, created_at desc);

-- ── Layer 3 ─────────────────────────────────────────────────────────────────
-- The escalation sweep must run without a phone in the loop. Every minute, so
-- a missed deadman switch is noticed promptly; the scan is bounded by the
-- partial condition and the table is small.
select cron.unschedule('escalate-overdue-checkins')
where exists (select 1 from cron.job where jobname = 'escalate-overdue-checkins');

select cron.schedule(
  'escalate-overdue-checkins',
  '* * * * *',
  $cron$ select public.escalate_overdue_checkins(); $cron$
);

create index if not exists check_in_timers_escalation_idx
  on public.check_in_timers (check_in_at)
  where is_resolved = false and escalated = false;
