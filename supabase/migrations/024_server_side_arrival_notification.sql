-- ─────────────────────────────────────────────────────────────────────────────
-- Arrival notification must not depend on the traveller's phone.
--
-- APPLIED. Trigger verified against a real row inside a rolled-back
-- transaction — it ran without error and production data was untouched.
--
-- ── The problem ─────────────────────────────────────────────────────────────
-- "Arrived safely" fired from the client as a fire-and-forget fetch, at the
-- exact moment the journey ended. If the phone was dying, had no signal, or was
-- killed by the OS on the walk indoors, the request never left the device and
-- NOBODY WAS EVER TOLD. The watchers simply kept waiting, unable to distinguish
-- "still walking" from "arrived twenty minutes ago and the notification
-- evaporated". Silence meant both things.
--
-- The arrival itself is recorded in the database regardless. So the database is
-- where the notification belongs: it is the one participant guaranteed to still
-- be running when the phone is not.
--
-- The client call remains as a fast path. Both routes are idempotent — the edge
-- function only emails watchers whose is_notified is not already true — so a
-- double fire sends one email, and either route alone still delivers.
--
-- ── Operator step required ──────────────────────────────────────────────────
-- The trigger authenticates to the edge function with a credential read from
-- Vault. Until it is provisioned the trigger is a deliberate no-op and the
-- client fast path carries the load. To provision:
--
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--
-- Run it from the SQL editor or psql — NOT through anything that records the
-- statement. The key must never appear in this repo, in a transcript, or in
-- any client-side environment variable.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.edge_function_url(p_slug text)
returns text
language sql
immutable
as $$
  select 'https://mpunvpomwkmfukcfxdlp.supabase.co/functions/v1/' || p_slug;
$$;

/**
 * Call an edge function as a trusted server caller.
 *
 * The credential lives in Vault, never in this function body and never in the
 * repo. A missing secret is a no-op rather than an error: it must not roll back
 * a traveller's arrival, which is real and already recorded.
 */
create or replace function public.call_edge_function(p_slug text, p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if v_key is null then
    raise notice '[call_edge_function] vault secret service_role_key is not set; skipping %', p_slug;
    return null;
  end if;

  select net.http_post(
    url     := public.edge_function_url(p_slug),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := p_body
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

/**
 * Fire when a journey actually transitions into 'arrived'.
 *
 * Guarded on the TRANSITION, not the value, so an unrelated later update to an
 * already-arrived row cannot re-announce it.
 */
create or replace function public.on_session_arrived()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'arrived' and coalesce(old.status, '') is distinct from 'arrived' then
    perform public.call_edge_function(
      'send-arrival-email',
      jsonb_build_object('sessionId', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_session_arrived on public.sessions;
create trigger trg_session_arrived
  after update of status on public.sessions
  for each row
  execute function public.on_session_arrived();
