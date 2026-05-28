-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marker_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_place_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_place_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trail_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rally_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_timers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid() AND role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(gid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = auth.uid() AND role = 'owner');
$$;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_members gm1 JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
  )
);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- groups
CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (public.is_group_member(id));
CREATE POLICY "groups_insert" ON public.groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
CREATE POLICY "groups_update" ON public.groups FOR UPDATE USING (public.is_group_admin(id));
CREATE POLICY "groups_delete" ON public.groups FOR DELETE USING (public.is_group_owner(id));

-- group_members
CREATE POLICY "gm_select" ON public.group_members FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "gm_insert" ON public.group_members FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_group_admin(group_id));
CREATE POLICY "gm_update" ON public.group_members FOR UPDATE USING (public.is_group_admin(group_id) OR user_id = auth.uid());
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE USING (public.is_group_admin(group_id) OR user_id = auth.uid());

-- live_locations
CREATE POLICY "ll_select" ON public.live_locations FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "ll_insert" ON public.live_locations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ll_update" ON public.live_locations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ll_delete" ON public.live_locations FOR DELETE USING (user_id = auth.uid());

-- markers
CREATE POLICY "markers_select" ON public.markers FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "markers_insert" ON public.markers FOR INSERT WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());
CREATE POLICY "markers_update" ON public.markers FOR UPDATE USING (created_by = auth.uid() OR public.is_group_admin(group_id));
CREATE POLICY "markers_delete" ON public.markers FOR DELETE USING (created_by = auth.uid() OR public.is_group_admin(group_id));

-- marker_photos
CREATE POLICY "mp_select" ON public.marker_photos FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "mp_insert" ON public.marker_photos FOR INSERT WITH CHECK (public.is_group_member(group_id) AND uploaded_by = auth.uid());
CREATE POLICY "mp_delete" ON public.marker_photos FOR DELETE USING (uploaded_by = auth.uid() OR public.is_group_admin(group_id));

-- saved_places
CREATE POLICY "sp_select" ON public.saved_places FOR SELECT USING (
  public.is_group_member(group_id) AND (visibility = 'crew' OR created_by = auth.uid() OR (visibility = 'admins' AND public.is_group_admin(group_id)))
);
CREATE POLICY "sp_insert" ON public.saved_places FOR INSERT WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());
CREATE POLICY "sp_update" ON public.saved_places FOR UPDATE USING (created_by = auth.uid() OR public.is_group_admin(group_id));
CREATE POLICY "sp_delete" ON public.saved_places FOR DELETE USING (created_by = auth.uid() OR public.is_group_admin(group_id));

-- saved_place_presence
CREATE POLICY "spp_select" ON public.saved_place_presence FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "spp_all_own" ON public.saved_place_presence FOR ALL USING (user_id = auth.uid());

-- saved_place_photos
CREATE POLICY "spph_select" ON public.saved_place_photos FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "spph_insert" ON public.saved_place_photos FOR INSERT WITH CHECK (public.is_group_member(group_id) AND uploaded_by = auth.uid());
CREATE POLICY "spph_delete" ON public.saved_place_photos FOR DELETE USING (uploaded_by = auth.uid() OR public.is_group_admin(group_id));

-- sessions
CREATE POLICY "sess_select" ON public.sessions FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "sess_insert" ON public.sessions FOR INSERT WITH CHECK (public.is_group_member(group_id) AND created_by = auth.uid());
CREATE POLICY "sess_update" ON public.sessions FOR UPDATE USING (created_by = auth.uid() OR public.is_group_admin(group_id));

-- session_members
CREATE POLICY "sm_select" ON public.session_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND public.is_group_member(s.group_id))
);
CREATE POLICY "sm_insert" ON public.session_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- trail_points
CREATE POLICY "tp_select" ON public.trail_points FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "tp_insert" ON public.trail_points FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));

-- group_events
CREATE POLICY "ge_select" ON public.group_events FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "ge_insert" ON public.group_events FOR INSERT WITH CHECK (public.is_group_member(group_id) AND user_id = auth.uid());

-- emergency_contacts
CREATE POLICY "ec_own" ON public.emergency_contacts FOR ALL USING (user_id = auth.uid());

-- journey_sessions
CREATE POLICY "js_own" ON public.journey_sessions FOR ALL USING (user_id = auth.uid());

-- subscriptions (read-only for client; writes are server-side only via service role)
CREATE POLICY "subs_select" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());

-- entitlements (read-only for client)
CREATE POLICY "ent_select" ON public.entitlements FOR SELECT USING (user_id = auth.uid());

-- device_push_tokens
CREATE POLICY "dpt_own" ON public.device_push_tokens FOR ALL USING (user_id = auth.uid());

-- app_settings
CREATE POLICY "as_own" ON public.app_settings FOR ALL USING (user_id = auth.uid());

-- rally_points
CREATE POLICY "rp_select" ON public.rally_points FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "rp_insert" ON public.rally_points FOR INSERT WITH CHECK (public.is_group_admin(group_id) AND created_by = auth.uid());
CREATE POLICY "rp_update" ON public.rally_points FOR UPDATE USING (public.is_group_admin(group_id));
CREATE POLICY "rp_delete" ON public.rally_points FOR DELETE USING (public.is_group_admin(group_id));

-- check_in_timers
CREATE POLICY "cit_own" ON public.check_in_timers FOR ALL USING (user_id = auth.uid());
