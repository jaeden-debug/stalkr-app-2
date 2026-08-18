-- ─────────────────────────────────────────────────────────────────────────────
-- P0: the check-in / deadman-switch safety feature cannot function.
--
-- *** NOT APPLIED — awaiting authorization. ***
--
-- check_in_timers has RLS ENABLED and ZERO policies. In Postgres that denies
-- every operation to every non-superuser role, so the client cannot insert,
-- read, update or delete a single row. Verified as role authenticated against
-- the live database:
--
--   insert -> BLOCKED: new row violates row-level security policy
--   select -> 0 rows
--
-- The whole feature is wired up in the app — services/checkInTimers.ts,
-- store/useSafetyStore.ts, SafetyCenter, CheckInBadge, and the checkin_due /
-- checkin_missed notification types — and none of it can persist anything.
--
-- Worse, it failed SILENTLY. createCheckInTimer returned null on error, arm()
-- did `if (!timer) return;`, and the UI closed its sheet regardless. A user
-- arming a deadman switch before going out alone got no error, no haptic, and
-- no timer — while believing someone would come looking if they missed it.
-- That client-side silence is fixed separately in this commit; this migration
-- makes the feature actually work.
--
-- ── Policy design ───────────────────────────────────────────────────────────
-- A timer belongs to one user, who is the only one who may create, resolve or
-- delete it. Crew admins listed in notify_user_ids need to READ it, because
-- they are the people who get alerted when it is missed — an alert naming a
-- timer they cannot see is not actionable.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "cit_select_own_or_notified" on public.check_in_timers;
create policy "cit_select_own_or_notified"
  on public.check_in_timers
  for select
  using (
    user_id = auth.uid()
    -- Watchers named on the timer can see it. auth.uid() is compared against
    -- the notify list rather than crew membership, so a timer only exposes
    -- itself to the specific people it will actually escalate to.
    or auth.uid()::text = any(coalesce(notify_user_ids, '{}'))
  );

drop policy if exists "cit_insert_own" on public.check_in_timers;
create policy "cit_insert_own"
  on public.check_in_timers
  for insert
  with check (user_id = auth.uid());

-- Update is how a timer is RESOLVED ("I'm safe"). Only the owner may say that;
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

-- The active-timer lookup filters on (user_id, is_resolved) and orders by
-- created_at; unindexed it degrades as history accumulates.
create index if not exists check_in_timers_active_idx
  on public.check_in_timers (user_id, is_resolved, created_at desc);

-- ── Verify after applying ───────────────────────────────────────────────────
--   As the owning user: insert, select, resolve, delete all succeed.
--   As an unrelated user: select returns 0 rows.
--   As a user named in notify_user_ids: select returns the row, update fails.
