-- ─────────────────────────────────────────────────────────────────────────────
-- A safety alert that silently does nothing is worse than one that does not
-- exist, because everyone involved believes they are covered.
--
-- APPLIED. Both holes below were found by actually exercising the path rather
-- than trusting it — and the first live test failed, which is the point.
--
-- ── Hole 1: escalation claimed success it never had ─────────────────────────
-- process_overdue_journeys() advanced a journey to 'alerted', then called
-- call_edge_function(), which returned null and skipped when the Vault
-- credential was absent. The escalation state said the watchers were told.
-- They were not. Nothing recorded the difference, and the journey was now
-- marked 'alerted' so it would never retry.
--
-- ── Hole 2: "dispatched" is not "delivered" ─────────────────────────────────
-- The log recorded 'dispatched' the moment pg_net accepted the request. pg_net
-- accepting a request says nothing about the outcome. The first real test came
-- back 401 UNAUTHORIZED_INVALID_JWT_FORMAT and nothing noticed, because the log
-- already said 'dispatched'. For a safety alert, "handed to the network layer"
-- and "delivered" are different claims and must never share a label.
--
-- ── Hole 3: the health check itself lied ────────────────────────────────────
-- It reported vault_secret_present = ok because a ROW EXISTED. The row held the
-- literal placeholder text from the setup instructions. So it reported healthy
-- while every alert was being rejected. A check that only asks "is something
-- there" is not a check.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.journey_alert_log (
  id           bigserial primary key,
  session_id   uuid references public.sessions(id) on delete cascade,
  kind         text not null,
  outcome      text not null,
  detail       text,
  request_id   bigint,
  created_at   timestamptz not null default now()
);

create index if not exists journey_alert_log_session_idx
  on public.journey_alert_log (session_id, created_at desc);

alter table public.journey_alert_log enable row level security;
-- No policies: operator-facing. service_role bypasses RLS; nobody else has any
-- business reading other people's alert history.

/**
 * Does this look like a credential that can authenticate to an edge function?
 *
 * A shape check, not a guess at validity: a legacy service_role key is a JWT
 * ('eyJ' prefix, three dot-separated segments), a current-style key is
 * 'sb_secret_...'. Anything else — empty, placeholder, publishable key — cannot
 * work, and catching it here reports the failure at configuration time instead
 * of at 2am when somebody is overdue.
 */
create or replace function public.is_plausible_service_key(p_key text)
returns boolean language sql immutable as $$
  select p_key is not null
     and length(p_key) > 40
     and (
       (p_key like 'eyJ%' and (length(p_key) - length(replace(p_key, '.', ''))) = 2)
       or p_key like 'sb_secret_%'
     );
$$;

create or replace function public.call_edge_function(
  p_slug text, p_body jsonb,
  p_session_id uuid default null, p_kind text default null
)
returns bigint language plpgsql security definer
set search_path = public, extensions as $$
declare v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  if v_key is null then
    insert into public.journey_alert_log (session_id, kind, outcome, detail)
    values (p_session_id, coalesce(p_kind, p_slug), 'skipped_no_secret',
            'vault secret service_role_key is not set; ' || p_slug || ' was never called');
    return null;
  end if;

  -- Refuse to fire a request that provably cannot authenticate; sending it
  -- anyway produces a log full of 'dispatched' entries that all 401.
  if not public.is_plausible_service_key(v_key) then
    insert into public.journey_alert_log (session_id, kind, outcome, detail)
    values (p_session_id, coalesce(p_kind, p_slug), 'skipped_invalid_secret',
            'service_role_key is present but unusable (length ' || length(v_key) ||
            '). It may still be the placeholder from the setup instructions.');
    return null;
  end if;

  select net.http_post(
    url := public.edge_function_url(p_slug),
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    body := p_body
  ) into v_request_id;

  insert into public.journey_alert_log (session_id, kind, outcome, request_id)
  values (p_session_id, coalesce(p_kind, p_slug), 'dispatched', v_request_id);
  return v_request_id;
end;
$$;

revoke all on function public.call_edge_function(text, jsonb, uuid, text) from public, anon, authenticated;

/** Turn the network layer's promise into a recorded outcome. */
create or replace function public.reconcile_alert_dispatches()
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v_count int := 0;
begin
  with resolved as (
    select l.id, r.status_code, r.error_msg, left(coalesce(r.content,''),200) as body
    from public.journey_alert_log l
    join net._http_response r on r.id = l.request_id
    where l.outcome = 'dispatched'
  )
  update public.journey_alert_log l
     set outcome = case
           when resolved.status_code between 200 and 299 then 'delivered'
           when resolved.status_code is null then 'failed_no_response'
           else 'failed_' || resolved.status_code end,
         detail = coalesce(resolved.error_msg, resolved.body)
    from resolved where l.id = resolved.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reconcile_alert_dispatches() from public, anon, authenticated;

select cron.unschedule('reconcile-alert-dispatches')
where exists (select 1 from cron.job where jobname = 'reconcile-alert-dispatches');
select cron.schedule('reconcile-alert-dispatches', '* * * * *',
  $cron$ select public.reconcile_alert_dispatches(); $cron$);

/** Health, answered honestly — shape-checked, and reporting real rejections. */
create or replace function public.journey_alerting_health()
returns table (check_name text, ok boolean, detail text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_key text; v_cron_active boolean; v_lost int; v_failed int;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  check_name := 'service_key_usable';
  ok := public.is_plausible_service_key(v_key);
  detail := case
    when v_key is null then 'MISSING. Overdue alerts and arrival emails are NOT being sent.'
    when not public.is_plausible_service_key(v_key) then
      'PRESENT BUT UNUSABLE (length ' || length(v_key) ||
      '). This looks like the placeholder text rather than a real key. ' ||
      'Replace it with the service_role key from Settings > API.'
    else 'Key shape is valid; alerts can authenticate.' end;
  return next;

  select coalesce(bool_or(active), false) into v_cron_active
  from cron.job where jobname = 'process-overdue-journeys';
  check_name := 'cron_scheduled'; ok := v_cron_active;
  detail := case when v_cron_active then 'runs every minute' else 'missing or inactive' end;
  return next;

  select count(*) into v_lost from public.journey_alert_log
  where outcome in ('skipped_no_secret','skipped_invalid_secret')
    and created_at > now() - interval '7 days';
  check_name := 'alerts_never_sent_7d'; ok := (v_lost = 0);
  detail := v_lost || ' alert(s) escalated but never even attempted'; return next;

  select count(*) into v_failed from public.journey_alert_log
  where outcome like 'failed_%' and created_at > now() - interval '7 days';
  check_name := 'alerts_rejected_7d'; ok := (v_failed = 0);
  detail := v_failed || ' alert(s) were sent and rejected by the server'; return next;
end;
$$;

revoke all on function public.journey_alerting_health() from public, anon;
grant execute on function public.journey_alerting_health() to authenticated, service_role;

drop function if exists public.call_edge_function(text, jsonb);

-- ── Operator step ───────────────────────────────────────────────────────────
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'),
--     '<the actual service_role JWT from Settings > API>');
-- Then: select * from public.journey_alerting_health();  -- every row must be ok
