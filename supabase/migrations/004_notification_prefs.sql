-- ============================================================
-- STALKR — Notification Preferences
-- Each user has one row controlling which push categories
-- the send-push Edge Function will deliver to them.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id                  uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_zone_enter        boolean NOT NULL DEFAULT true,
  notify_zone_leave        boolean NOT NULL DEFAULT true,
  notify_zone_overstay     boolean NOT NULL DEFAULT true,
  notify_crew_zone_activity boolean NOT NULL DEFAULT true,
  notify_sos_alerts        boolean NOT NULL DEFAULT true,
  notify_sos_cancel        boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a default row whenever a profile is inserted
CREATE OR REPLACE FUNCTION public.create_default_notification_prefs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_notification_prefs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_notif_prefs ON public.profiles;
CREATE TRIGGER on_profile_created_notif_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_prefs();

-- Backfill existing profiles (safe to run multiple times)
INSERT INTO public.user_notification_prefs (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can read and write only their own row
CREATE POLICY "owner_select" ON public.user_notification_prefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_insert" ON public.user_notification_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update" ON public.user_notification_prefs
  FOR UPDATE USING (auth.uid() = user_id);

-- Service-role bypass (used by Edge Function)
-- No extra policy needed — service role bypasses RLS by default.
