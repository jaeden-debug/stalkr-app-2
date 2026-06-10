/**
 * Database row types matching the Supabase schema exactly.
 * Generated from the schema — update if migrations add columns.
 */

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member' | 'viewer';
export type SharingMode = 'always' | 'sessions_only' | 'paused' | 'private';
export type LocationStatus = 'live' | 'stale' | 'offline' | 'paused';
export type GroupType = 'hunting' | 'hiking' | 'camping' | 'family' | 'atv' | 'custom';
export type MarkerType =
  | 'waypoint'
  | 'danger'
  | 'safe_zone'
  | 'camp'
  | 'vehicle'
  | 'animal_sign'
  | 'evidence'
  | 'supply_cache'
  | 'custom';
export type SavedPlaceType =
  | 'camp'
  | 'parking'
  | 'access_point'
  | 'water_source'
  | 'hazard'
  | 'boundary'
  | 'custom';
export type ShapeType = 'circle' | 'polygon';
export type ZoneVisibility = 'crew' | 'admins' | 'private';
export type BillingProvider = 'apple_iap' | 'google_play_billing' | 'stripe_web' | 'manual_admin';
export type SubscriptionPlan = 'free' | 'pro' | 'crew';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'grace_period' | 'trial';

// ─── Coordinate helper ────────────────────────────────────────────────────────
export interface LatLng {
  latitude: number;
  longitude: number;
}

// ─── Zone alert rules ─────────────────────────────────────────────────────────
export interface AlertRules {
  stay_too_long_minutes?: number;
  notify_admins?: boolean;
  notify_user?: boolean;
  quiet_hours_start?: string; // "22:00"
  quiet_hours_end?: string;   // "06:00"
  repeat_cooldown_minutes?: number;
  severity?: 'low' | 'medium' | 'high';
  message_template?: string;
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
export interface DbProfile {
  id: string;
  display_name: string | null;
  nickname: string | null;
  initials: string | null;
  avatar_url: string | null;
  phone: string | null;
  default_sharing_mode: SharingMode;
  is_online: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  push_token: string | null;
}

export interface DbProfileInsert {
  id: string;
  display_name?: string | null;
  nickname?: string | null;
  initials?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  default_sharing_mode?: SharingMode;
}

export interface DbProfileUpdate {
  display_name?: string | null;
  nickname?: string | null;
  initials?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  default_sharing_mode?: SharingMode;
  is_online?: boolean;
  last_seen_at?: string | null;
  push_token?: string | null;
  updated_at?: string;
}

// ─── Groups ───────────────────────────────────────────────────────────────────
export interface DbGroup {
  id: string;
  name: string;
  type: GroupType;
  created_by: string;
  invite_code: string;
  invite_enabled: boolean;
  tracking_mode: 'flexible' | 'enforced';
  created_at: string;
  updated_at: string;
}

export interface DbGroupInsert {
  name: string;
  type?: GroupType;
  created_by: string;
  tracking_mode?: 'flexible' | 'enforced';
  invite_enabled?: boolean;
}

export interface DbGroupUpdate {
  name?: string;
  type?: GroupType;
  invite_enabled?: boolean;
  tracking_mode?: 'flexible' | 'enforced';
  updated_at?: string;
}

// ─── Group Members ────────────────────────────────────────────────────────────
export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  nickname_override: string | null;
  initials_override: string | null;
  avatar_url_override: string | null;
  sharing_mode: SharingMode;
  status: LocationStatus;
  joined_at: string;
  updated_at: string;
}

export interface DbGroupMemberInsert {
  group_id: string;
  user_id: string;
  role?: MemberRole;
  sharing_mode?: SharingMode;
}

export interface DbGroupMemberUpdate {
  role?: MemberRole;
  nickname_override?: string | null;
  initials_override?: string | null;
  avatar_url_override?: string | null;
  sharing_mode?: SharingMode;
  status?: LocationStatus;
  updated_at?: string;
}

// ─── Live Locations ───────────────────────────────────────────────────────────
export interface DbLiveLocation {
  id: string;
  group_id: string;
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  approximate_latitude: number | null;
  approximate_longitude: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  battery_level: number | null;
  status: LocationStatus;
  sharing_mode: SharingMode;
  is_approximate: boolean;
  last_ping_at: string;
  updated_at: string;
}

export interface DbLiveLocationUpsert {
  group_id: string;
  user_id: string;
  latitude?: number | null;
  longitude?: number | null;
  approximate_latitude?: number | null;
  approximate_longitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  battery_level?: number | null;
  status: LocationStatus;
  sharing_mode: SharingMode;
  is_approximate?: boolean;
  last_ping_at: string;
  updated_at: string;
}

// ─── Markers ──────────────────────────────────────────────────────────────────
export interface DbMarker {
  id: string;
  group_id: string;
  session_id: string | null;
  created_by: string;
  type: MarkerType;
  title: string;
  notes: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  visible_to_group: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMarkerInsert {
  group_id: string;
  session_id?: string | null;
  created_by: string;
  type: MarkerType;
  title: string;
  notes?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  visible_to_group?: boolean;
}

export interface DbMarkerUpdate {
  type?: MarkerType;
  title?: string;
  notes?: string | null;
  description?: string | null;
  visible_to_group?: boolean;
  updated_at?: string;
}

// ─── Marker Photos ────────────────────────────────────────────────────────────
export interface DbMarkerPhoto {
  id: string;
  marker_id: string;
  group_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

// ─── Saved Places ─────────────────────────────────────────────────────────────
export interface DbSavedPlace {
  id: string;
  group_id: string;
  created_by: string;
  name: string;
  type: SavedPlaceType;
  latitude: number;
  longitude: number;
  radius_meters: number;
  notify_on_arrival: boolean;
  notify_on_leave: boolean;
  shape_type: ShapeType;
  polygon_coords: LatLng[];
  applies_to_user_ids: string[];
  alert_rules: AlertRules;
  visibility: ZoneVisibility;
  created_at: string;
  updated_at: string;
}

export interface DbSavedPlaceInsert {
  group_id: string;
  created_by: string;
  name: string;
  type?: SavedPlaceType;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  notify_on_arrival?: boolean;
  notify_on_leave?: boolean;
  shape_type?: ShapeType;
  polygon_coords?: LatLng[];
  applies_to_user_ids?: string[];
  alert_rules?: AlertRules;
  visibility?: ZoneVisibility;
}

export interface DbSavedPlaceUpdate {
  name?: string;
  type?: SavedPlaceType;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  notify_on_arrival?: boolean;
  notify_on_leave?: boolean;
  shape_type?: ShapeType;
  polygon_coords?: LatLng[];
  applies_to_user_ids?: string[];
  alert_rules?: AlertRules;
  visibility?: ZoneVisibility;
  updated_at?: string;
}

// ─── Saved Place Presence ─────────────────────────────────────────────────────
export interface DbSavedPlacePresence {
  id: string;
  saved_place_id: string;
  group_id: string;
  user_id: string;
  is_inside: boolean;
  last_entered_at: string | null;
  last_left_at: string | null;
  updated_at: string;
}

// ─── Saved Place Photos ───────────────────────────────────────────────────────
export interface DbSavedPlacePhoto {
  id: string;
  saved_place_id: string;
  group_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export interface DbSession {
  id: string;
  group_id: string | null;
  created_by: string;
  name: string;
  session_type: string;
  is_active: boolean;
  status: 'active' | 'arrived' | 'cancelled';
  started_at: string;
  ended_at: string | null;
  invite_code: string | null;
  watch_token: string;
  traveler_name: string | null;
  destination_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  arrived_at: string | null;
  auto_end_at: string | null;
  watcher_push_tokens: string[];
  notify_on_end: boolean;
}

export interface DbSessionInsert {
  group_id?: string | null;
  created_by: string;
  name: string;
  session_type?: string;
  traveler_name?: string | null;
  destination_name?: string | null;
  destination_latitude?: number | null;
  destination_longitude?: number | null;
  auto_end_at?: string | null;
  notify_on_end?: boolean;
}

export interface DbSessionUpdate {
  name?: string;
  is_active?: boolean;
  status?: 'active' | 'arrived' | 'cancelled';
  ended_at?: string | null;
  arrived_at?: string | null;
  auto_end_at?: string | null;
  watcher_push_tokens?: string[];
  notify_on_end?: boolean;
}

export interface DbSessionWatcher {
  id: string;
  session_id: string;
  user_id: string | null;
  email: string | null;
  push_token: string | null;
  is_notified: boolean;
  created_at: string;
}

export interface DbSessionWatcherInsert {
  session_id: string;
  user_id?: string | null;
  email?: string | null;
  push_token?: string | null;
}

// ─── Session Members ──────────────────────────────────────────────────────────
export interface DbSessionMember {
  id: string;
  session_id: string;
  user_id: string;
  role: MemberRole;
  status: LocationStatus;
  joined_at: string;
  updated_at: string;
}

// ─── Trail Points ─────────────────────────────────────────────────────────────
export interface DbTrailPoint {
  id: string;
  session_id: string | null;
  group_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  created_at: string;
}

export interface DbTrailPointInsert {
  session_id?: string | null;
  group_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
}

// ─── Group Events ─────────────────────────────────────────────────────────────
export type GroupEventType =
  | 'member_joined'
  | 'member_left'
  | 'member_kicked'
  | 'role_changed'
  | 'marker_created'
  | 'marker_deleted'
  | 'danger_marker_added'
  | 'zone_entered'
  | 'zone_left'
  | 'zone_created'
  | 'zone_deleted'
  | 'session_started'
  | 'session_ended'
  | 'settings_changed'
  | 'sos_triggered'
  | 'sos_cancelled'
  | 'rally_point_set'
  | 'checkin_timer_missed'
  | 'checkin_timer_completed'
  | 'deadman_triggered'
  | 'deadman_cancelled'
  | 'arrival'
  | 'member_offline'
  | 'member_online'
  | 'journey_started'
  | 'journey_invite_sent'
  | 'journey_watcher_added'
  | 'journey_arrived'
  | 'journey_completed'
  | 'journey_cancelled'
  | 'journey_failed_to_notify'
  | 'journey_viewed'
  | 'low_signal_alert';

export interface DbGroupEvent {
  id: string;
  group_id: string;
  user_id: string;
  event_type: GroupEventType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbGroupEventInsert {
  group_id: string;
  user_id: string;
  event_type: GroupEventType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
}

// ─── Emergency Contacts ───────────────────────────────────────────────────────
export interface DbEmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  phone_number: string;
  created_at: string;
}

export interface DbEmergencyContactInsert {
  user_id: string;
  contact_name: string;
  phone_number: string;
}

// ─── Journey Sessions ─────────────────────────────────────────────────────────
export interface DbJourneySession {
  id: string;
  user_id: string;
  destination_name: string;
  destination_coords: LatLng;
  status: 'active' | 'completed' | 'cancelled';
  auto_notify: boolean;
  emergency_contacts: string[]; // IDs of emergency_contacts rows
  created_at: string;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export interface DbSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_provider: BillingProvider;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEntitlement {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  is_active: boolean;
  source: BillingProvider;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Device Push Tokens ───────────────────────────────────────────────────────
export interface DbDevicePushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  created_at: string;
  updated_at: string;
}

// ─── App Settings ─────────────────────────────────────────────────────────────
export interface DbAppSetting {
  id: string;
  user_id: string;
  trail_history_hours: number;
  sharing_mode: SharingMode;
  approximate_location_enabled: boolean;
  notifications_enabled: boolean;
  zone_notifications_enabled: boolean;
  session_notifications_enabled: boolean;
  arrival_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Feature Flags (server-side) ──────────────────────────────────────────────
export interface DbFeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Rally Points ─────────────────────────────────────────────────────────────
export interface DbRallyPoint {
  id: string;
  group_id: string;
  created_by: string;
  name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Check-In Timers ─────────────────────────────────────────────────────────
export interface DbCheckInTimer {
  id: string;
  user_id: string;
  group_id: string | null;
  label: string | null;
  check_in_at: string; // ISO timestamp when they must check in
  is_resolved: boolean;
  resolved_at: string | null;
  notify_user_ids: string[]; // who to alert if missed
  created_at: string;
}
