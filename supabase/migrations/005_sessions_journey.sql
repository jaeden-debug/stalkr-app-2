-- ============================================================
-- STALKR — Sessions v2: Journey / Live Share
-- ============================================================

-- ─── 1. Make group_id nullable on sessions ────────────────────
-- Allows standalone (non-group) journey sessions
ALTER TABLE public.sessions
  ALTER COLUMN group_id DROP NOT NULL;

-- ─── 2. Add watch_token ───────────────────────────────────────
-- UUID that grants read-only viewer access to this session.
-- Used in the /watch/[token] web page URL.
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS watch_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS traveler_name text,      -- display name for the watch page
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'arrived', 'cancelled'));

-- Unique index on watch_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS sessions_watch_token_idx
  ON public.sessions (watch_token);

-- Backfill any existing rows that got NULL watch_token (shouldn't happen with DEFAULT)
UPDATE public.sessions
  SET watch_token = gen_random_uuid()
  WHERE watch_token IS NULL;

-- ─── 3. session_watchers ─────────────────────────────────────
-- Tracks everyone watching a session.
-- user_id is set for app members; email for non-members who opt in.
CREATE TABLE IF NOT EXISTS public.session_watchers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email        text,
  push_token   text,           -- Expo push token (app members)
  is_notified  boolean NOT NULL DEFAULT false,  -- true once arrival email/push sent
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id),
  CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS session_watchers_session_idx
  ON public.session_watchers (session_id);

-- ─── 4. RLS ───────────────────────────────────────────────────
ALTER TABLE public.session_watchers ENABLE ROW LEVEL SECURITY;

-- Session owner can do anything
CREATE POLICY "sw_owner_all" ON public.session_watchers
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.sessions WHERE created_by = auth.uid()
    )
  );

-- Watchers can read their own row
CREATE POLICY "sw_self_select" ON public.session_watchers
  FOR SELECT USING (user_id = auth.uid());

-- Anonymous insert allowed (non-member watchers registering their email)
-- We use a check to prevent abuse: email must be valid-ish
CREATE POLICY "sw_anon_insert" ON public.session_watchers
  FOR INSERT WITH CHECK (
    user_id IS NULL
    AND email IS NOT NULL
    AND length(email) > 3
    AND email LIKE '%@%'
  );

-- ─── 5. Allow public SELECT on sessions by watch_token ────────
-- The watch page needs to read session details without auth.
-- We expose only safe columns via a security-definer function.
CREATE OR REPLACE FUNCTION public.get_session_by_watch_token(p_token uuid)
RETURNS TABLE (
  id                    uuid,
  name                  text,
  traveler_name         text,
  destination_name      text,
  destination_latitude  double precision,
  destination_longitude double precision,
  status                text,
  is_active             boolean,
  watch_token           uuid,
  started_at            timestamptz,
  arrived_at            timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.traveler_name,
    s.destination_name,
    s.destination_latitude,
    s.destination_longitude,
    s.status,
    s.is_active,
    s.watch_token,
    s.started_at,
    s.arrived_at
  FROM public.sessions s
  WHERE s.watch_token = p_token;
END;
$$;

-- Grant execute to anon role (web page)
GRANT EXECUTE ON FUNCTION public.get_session_by_watch_token(uuid) TO anon;

-- ─── 6. Helper: register email watcher (anon-safe) ────────────
CREATE OR REPLACE FUNCTION public.add_session_email_watcher(
  p_session_id uuid,
  p_email      text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.session_watchers (session_id, email)
  VALUES (p_session_id, lower(trim(p_email)))
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_session_email_watcher(uuid, text) TO anon;

-- ─── 7. Updated sessions RLS to allow anon watch_token reads ──
-- (sessions table itself stays protected; use the function above)
-- Existing session RLS policies remain unchanged.
