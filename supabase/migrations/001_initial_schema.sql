-- ============================================================
-- STALKR / HUNTLINK — INITIAL MIGRATION
-- Run this in your Supabase SQL editor or via CLI
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enum Types ──────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sharing_mode AS ENUM ('always', 'sessions_only', 'paused', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE location_status AS ENUM ('live', 'stale', 'offline', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE group_type AS ENUM ('hunting', 'hiking', 'camping', 'family', 'atv', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE marker_type AS ENUM ('waypoint', 'danger', 'safe_zone', 'camp', 'vehicle', 'animal_sign', 'evidence', 'supply_cache', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE saved_place_type AS ENUM ('camp', 'parking', 'access_point', 'water_source', 'hazard', 'boundary', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_provider AS ENUM ('apple_iap', 'google_play_billing', 'stripe_web', 'manual_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'crew');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'grace_period', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  nickname      text,
  initials      text,
  avatar_url    text,
  phone         text,
  default_sharing_mode sharing_mode NOT NULL DEFAULT 'sessions_only',
  is_online     boolean NOT NULL DEFAULT false,
  last_seen_at  timestamptz,
  push_token    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── groups ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          group_type NOT NULL DEFAULT 'custom',
  created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code   text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  invite_enabled boolean NOT NULL DEFAULT true,
  tracking_mode text NOT NULL DEFAULT 'flexible' CHECK (tracking_mode IN ('flexible', 'enforced')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── group_members ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role                member_role NOT NULL DEFAULT 'member',
  nickname_override   text,
  initials_override   text,
  avatar_url_override text,
  sharing_mode        sharing_mode NOT NULL DEFAULT 'sessions_only',
  status              location_status NOT NULL DEFAULT 'offline',
  joined_at           timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- ─── live_locations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_locations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude              double precision,
  longitude             double precision,
  approximate_latitude  double precision,
  approximate_longitude double precision,
  heading               double precision,
  speed                 double precision,
  accuracy              double precision,
  battery_level         integer,
  status                location_status NOT NULL DEFAULT 'offline',
  sharing_mode          sharing_mode NOT NULL DEFAULT 'sessions_only',
  is_approximate        boolean NOT NULL DEFAULT false,
  last_ping_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- ─── markers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.markers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  session_id      uuid,  -- FK added after sessions table
  created_by      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            marker_type NOT NULL DEFAULT 'waypoint',
  title           text NOT NULL DEFAULT 'Waypoint',
  notes           text,
  description     text,
  latitude        double precision NOT NULL,
  longitude       double precision NOT NULL,
  visible_to_group boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── marker_photos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marker_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_id    uuid NOT NULL REFERENCES public.markers(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── saved_places ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_places (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                text NOT NULL,
  type                saved_place_type NOT NULL DEFAULT 'custom',
  latitude            double precision NOT NULL,
  longitude           double precision NOT NULL,
  radius_meters       integer NOT NULL DEFAULT 100,
  notify_on_arrival   boolean NOT NULL DEFAULT true,
  notify_on_leave     boolean NOT NULL DEFAULT true,
  shape_type          text NOT NULL DEFAULT 'circle' CHECK (shape_type IN ('circle', 'polygon')),
  polygon_coords      jsonb NOT NULL DEFAULT '[]',
  applies_to_user_ids jsonb NOT NULL DEFAULT '[]',
  alert_rules         jsonb NOT NULL DEFAULT '{}',
  visibility          text NOT NULL DEFAULT 'crew' CHECK (visibility IN ('crew', 'admins', 'private')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── saved_place_presence ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_place_presence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_place_id  uuid NOT NULL REFERENCES public.saved_places(id) ON DELETE CASCADE,
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_inside       boolean NOT NULL DEFAULT false,
  last_entered_at timestamptz,
  last_left_at    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (saved_place_id, user_id)
);

-- ─── saved_place_photos ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_place_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_place_id  uuid NOT NULL REFERENCES public.saved_places(id) ON DELETE CASCADE,
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  caption         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  session_type          text NOT NULL DEFAULT 'custom',
  is_active             boolean NOT NULL DEFAULT true,
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  invite_code           text UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  destination_name      text,
  destination_latitude  double precision,
  destination_longitude double precision,
  arrived_at            timestamptz,
  auto_end_at           timestamptz,
  watcher_push_tokens   jsonb DEFAULT '[]',
  notify_on_end         boolean DEFAULT true
);

-- Add FK from markers to sessions (now sessions exists)
ALTER TABLE public.markers
  ADD CONSTRAINT markers_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE SET NULL;

-- ─── session_members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       member_role NOT NULL DEFAULT 'member',
  status     location_status NOT NULL DEFAULT 'offline',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- ─── trail_points ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trail_points (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude   double precision NOT NULL,
  longitude  double precision NOT NULL,
  heading    double precision,
  speed      double precision,
  accuracy   double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── group_events ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title      text NOT NULL,
  body       text,
  metadata   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── emergency_contacts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name  text NOT NULL,
  phone_number  text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ─── journey_sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_name    text NOT NULL,
  destination_coords  jsonb NOT NULL,
  status              text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  auto_notify         boolean DEFAULT true,
  emergency_contacts  jsonb DEFAULT '[]',
  created_at          timestamptz DEFAULT now()
);

-- ─── subscriptions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                     subscription_plan NOT NULL DEFAULT 'free',
  status                   subscription_status NOT NULL DEFAULT 'active',
  billing_provider         billing_provider NOT NULL DEFAULT 'apple_iap',
  provider_subscription_id text,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  trial_ends_at            timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─── entitlements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entitlements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan       subscription_plan NOT NULL DEFAULT 'free',
  is_active  boolean NOT NULL DEFAULT true,
  source     billing_provider NOT NULL DEFAULT 'apple_iap',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─── device_push_tokens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  platform   text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── app_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  trail_history_hours           integer NOT NULL DEFAULT 24,
  sharing_mode                  sharing_mode NOT NULL DEFAULT 'sessions_only',
  approximate_location_enabled  boolean NOT NULL DEFAULT false,
  notifications_enabled         boolean NOT NULL DEFAULT true,
  zone_notifications_enabled    boolean NOT NULL DEFAULT true,
  session_notifications_enabled boolean NOT NULL DEFAULT true,
  arrival_notifications_enabled boolean NOT NULL DEFAULT true,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- ─── rally_points ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rally_points (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL DEFAULT 'Rally Point',
  latitude   double precision NOT NULL,
  longitude  double precision NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── check_in_timers ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.check_in_timers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id        uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  label           text,
  check_in_at     timestamptz NOT NULL,
  is_resolved     boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  notify_user_ids jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_group_id ON public.live_locations (group_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_user_id ON public.live_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_markers_group_id ON public.markers (group_id);
CREATE INDEX IF NOT EXISTS idx_trail_points_group_user ON public.trail_points (group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trail_points_created_at ON public.trail_points (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_events_group_id ON public.group_events (group_id);
CREATE INDEX IF NOT EXISTS idx_group_events_created_at ON public.group_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_places_group_id ON public.saved_places (group_id);
CREATE INDEX IF NOT EXISTS idx_saved_place_presence_place_id ON public.saved_place_presence (saved_place_id);
CREATE INDEX IF NOT EXISTS idx_check_in_timers_user_id ON public.check_in_timers (user_id);

-- ─── Updated At Triggers ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_group_members_updated_at
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_live_locations_updated_at
  BEFORE UPDATE ON public.live_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_markers_updated_at
  BEFORE UPDATE ON public.markers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_saved_places_updated_at
  BEFORE UPDATE ON public.saved_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_entitlements_updated_at
  BEFORE UPDATE ON public.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_rally_points_updated_at
  BEFORE UPDATE ON public.rally_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
