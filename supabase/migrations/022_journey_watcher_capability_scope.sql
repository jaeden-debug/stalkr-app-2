-- ─────────────────────────────────────────────────────────────────────────────
-- P1: anyone could subscribe any email address to any journey.
--
-- APPLIED. Verified against a live active journey — see the probe results at
-- the bottom of this file.
--
-- ── What was found ──────────────────────────────────────────────────────────
-- Two independent paths let an unauthenticated caller attach an arbitrary
-- email address to an arbitrary journey. Closing either one alone fixes
-- nothing, because the other remains open.
--
-- PATH 1 — the RPC. add_session_email_watcher was SECURITY DEFINER (so it
-- bypassed RLS), executable by anon, and contained no authorization check of
-- any kind. Its entire body was an unguarded insert keyed on session_id.
--
-- PATH 2 — the table. Policy sw_anon_insert on session_watchers was a
-- PERMISSIVE INSERT policy whose whole WITH CHECK was:
--
--     (user_id IS NULL) AND (email IS NOT NULL)
--       AND (length(email) > 3) AND (email LIKE '%@%')
--
-- It never constrained session_id. Any holder of the anon key — which ships
-- inside the app bundle and is therefore public — could insert a watcher row
-- against any journey directly, straight past the RPC.
--
-- ── Why it matters ──────────────────────────────────────────────────────────
-- 1. LOCATION PRIVACY. Subscribe your own address to someone else's journey
--    and you receive their arrival notices — a feed of where that person goes.
-- 2. SENDER REPUTATION. Subscribe a victim's address and they receive
--    unsolicited mail from navtrl.com. Auth email now runs on that domain, so
--    the cost of a damaged sending reputation lands on every real user.
--
-- Session UUIDs are not secrets. They travel in share links and screenshots,
-- and every past legitimate watcher keeps one forever.
--
-- ── The fix, and the correction inside it ───────────────────────────────────
-- The first attempt required auth + session ownership on the RPC. That was
-- wrong: the caller is the PUBLIC watch page (app/watch/[token]+web.tsx),
-- which is unauthenticated by design — someone following a shared journey link
-- subscribes for the arrival notice. Requiring auth broke the real flow.
--
-- The actual defect was never "no auth". It was keying on session_id, which is
-- an IDENTIFIER, not a CAPABILITY. watch_token is the capability: 122 bits of
-- gen_random_uuid() behind a unique index, and holding it already grants live
-- view of the journey. Keying subscription on the token makes the privilege
-- consistent — you can subscribe to exactly the journeys whose link you were
-- given, and to nothing else.
--
-- Also note: `revoke execute ... from anon` on the other session RPCs was a
-- no-op on its own. Postgres grants EXECUTE to PUBLIC by default and anon
-- inherits it, so the revoke must name PUBLIC and then re-grant.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.add_watch_email_subscriber(
  p_token uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_count int;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  -- Only ACTIVE journeys accept subscribers. A finished journey has nothing
  -- left to notify about, so a stale link cannot keep seeding rows.
  select id into v_session_id
  from public.sessions
  where watch_token = p_token and is_active;

  if v_session_id is null then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  -- Cap per journey. Without this, one leaked link is an open relay for
  -- unsolicited mail from our sending domain.
  select count(*) into v_count
  from public.session_watchers
  where session_id = v_session_id and email is not null;

  if v_count >= 25 then
    raise exception 'WATCHER_LIMIT_REACHED';
  end if;

  insert into public.session_watchers (session_id, email)
  values (v_session_id, v_email)
  on conflict do nothing;
end;
$$;

revoke execute on function public.add_watch_email_subscriber(uuid, text) from public;
grant execute on function public.add_watch_email_subscriber(uuid, text)
  to anon, authenticated, service_role;

-- PATH 2.
drop policy if exists "sw_anon_insert" on public.session_watchers;

-- Retire the unsafe entry point so an older client build cannot call it.
drop function if exists public.add_session_email_watcher(uuid, text);

-- ── Defense in depth on the remaining session RPCs ──────────────────────────
-- Each already guards on auth.uid() internally, so anon could accomplish
-- nothing — but a SECURITY DEFINER function reachable by an unauthenticated
-- role is not a surface worth leaving open.
--
-- NOT revoked, deliberately:
--   get_session_by_watch_token — the public watch page depends on it, and it
--     returns only journey fields (no crew, no markers, no other journeys).
--   is_session_creator / is_session_member — predicates called from inside RLS
--     policy expressions, which evaluate with the QUERYING role's privileges.
--     Revoking these would break policy evaluation.
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.create_safety_session(uuid, text, text)',
    'public.end_session(uuid)',
    'public.leave_session(uuid)',
    'public.join_session_by_invite_code(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;

-- ── Verified after applying, as role anon, against a live active journey ────
--   direct anon insert into session_watchers -> BLOCKED (RLS violation)
--   subscribe with a WRONG watch token       -> BLOCKED (SESSION_NOT_FOUND)
--   subscribe with the CORRECT watch token   -> OK (0 -> 1 rows)
--   subscribe with a malformed address       -> REJECTED (INVALID_EMAIL)
-- Test rows removed afterwards.
