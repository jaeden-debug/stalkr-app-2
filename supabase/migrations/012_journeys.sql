-- 012_journeys.sql
-- Journeys rebuild. Canonical model = public.sessions (journey_sessions is a
-- legacy duplicate, now deprecated and unused by the app). Additive + rerunnable.

-- Optional invite message attached to a journey.
alter table public.sessions
  add column if not exists message text;

-- Richer watcher records: name + contact + delivery status.
alter table public.session_watchers
  add column if not exists name             text,
  add column if not exists phone            text,
  add column if not exists invite_sent      boolean not null default false,
  add column if not exists arrival_notified boolean not null default false;

create index if not exists idx_session_watchers_session on public.session_watchers (session_id);
