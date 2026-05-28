-- ============================================================
-- REALTIME + SERVER FUNCTIONS
-- ============================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.markers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_places;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rally_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.check_in_timers;

-- Auto-create profile + entitlement + settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, updated_at)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.entitlements (user_id, plan, is_active, source)
  VALUES (NEW.id, 'free', true, 'manual_admin')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.app_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mark stale locations (call from Edge Function cron)
CREATE OR REPLACE FUNCTION public.mark_stale_locations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.live_locations
  SET status = 'offline', updated_at = now()
  WHERE status != 'offline' AND last_ping_at < now() - interval '15 minutes';
END;
$$;
