/**
 * App-layer models — derived from DB rows but with computed/enriched fields.
 * Use these in stores and components, not raw DB types.
 */
import type {
  AlertRules,
  BillingProvider,
  GroupEventType,
  GroupType,
  LatLng,
  LocationStatus,
  MarkerType,
  MemberRole,
  SavedPlaceType,
  SharingMode,
  ShapeType,
  SubscriptionPlan,
  SubscriptionStatus,
  ZoneVisibility,
} from './database';

// Re-export for convenience
export type {
  AlertRules,
  BillingProvider,
  GroupType,
  LatLng,
  LocationStatus,
  MarkerType,
  MemberRole,
  SavedPlaceType,
  SharingMode,
  ShapeType,
  SubscriptionPlan,
  SubscriptionStatus,
  ZoneVisibility,
};

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  display_name: string | null;
  nickname: string | null;
  initials: string | null;
  avatar_url: string | null;
  phone: string | null;
  default_sharing_mode: SharingMode;
  is_online: boolean;
  last_seen_at: string | null;
  push_token: string | null;
  // Emergency medical profile
  blood_type: string | null;
  allergies: string | null;
  medications: string | null;
  medical_notes: string | null;
  medical_share_with_crew: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Group ────────────────────────────────────────────────────────────────────
export interface Group {
  id: string;
  name: string;
  type: GroupType;
  created_by: string;
  invite_code: string;
  invite_enabled: boolean;
  tracking_mode: 'flexible' | 'enforced';
  created_at: string;
  updated_at: string;
  // Enriched
  member_role?: MemberRole;
  member_count?: number;
}

// ─── Group Member ─────────────────────────────────────────────────────────────
export interface GroupMember {
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
  // Enriched
  profile?: Profile | null;
  /** Resolved display name (override > profile.nickname > profile.display_name) */
  displayName?: string;
  /** Resolved initials */
  displayInitials?: string;
  /** Resolved avatar URL */
  displayAvatar?: string | null;
}

// ─── Live Location (enriched) ─────────────────────────────────────────────────
export interface LiveLocation {
  id: string;
  group_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  battery_level: number | null;
  status: LocationStatus;
  sharing_mode: SharingMode;
  is_approximate: boolean;
  last_ping_at: string;
  updated_at: string;
  // Enriched
  distanceFromMe?: number;
  isStale?: boolean;
}

// ─── Marker ───────────────────────────────────────────────────────────────────
export interface Marker {
  /**
   * Radius in metres for arrival detection, or null when off.
   * Small by design — a marker is a point of interest, not an area.
   */
  arrival_radius_m?: number | null;
  /** Notify the crew when someone arrives within arrival_radius_m. */
  notify_on_arrival?: boolean;
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
  // Enriched
  photos?: MarkerPhoto[];
}

export interface MarkerPhoto {
  id: string;
  marker_id: string;
  group_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  // Enriched
  url?: string;
}

// ─── Saved Place / Zone ───────────────────────────────────────────────────────
export interface SavedPlace {
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
  // Enriched
  photos?: SavedPlacePhoto[];
}

export interface SavedPlacePresence {
  id: string;
  saved_place_id: string;
  group_id: string;
  user_id: string;
  is_inside: boolean;
  last_entered_at: string | null;
  last_left_at: string | null;
  updated_at: string;
}

export interface SavedPlacePhoto {
  id: string;
  saved_place_id: string;
  group_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  url?: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────
export interface Session {
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
  // Enriched
  members?: SessionMember[];
  destination?: LatLng | null;
  watchers?: SessionWatcher[];
}

export interface SessionWatcher {
  id: string;
  session_id: string;
  user_id: string | null;
  email: string | null;
  push_token: string | null;
  is_notified: boolean;
  created_at: string;
  // Enriched
  profile?: Profile | null;
}

export interface SessionMember {
  id: string;
  session_id: string;
  user_id: string;
  role: MemberRole;
  status: LocationStatus;
  joined_at: string;
  updated_at: string;
  profile?: Profile | null;
}

// ─── Trail Point ──────────────────────────────────────────────────────────────
export interface TrailPoint {
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

// ─── Group Event ──────────────────────────────────────────────────────────────
export interface GroupEvent {
  id: string;
  group_id: string;
  user_id: string;
  event_type: GroupEventType;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Enriched
  profile?: Profile | null;
}

// ─── Emergency Contact ────────────────────────────────────────────────────────
export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  phone_number: string;
  created_at: string;
}

// ─── Journey ──────────────────────────────────────────────────────────────────
export interface Journey {
  id: string;
  user_id: string;
  destination_name: string;
  destination: LatLng;
  status: 'active' | 'completed' | 'cancelled';
  auto_notify: boolean;
  emergency_contact_ids: string[];
  created_at: string;
  // Enriched
  breadcrumbs?: LatLng[];
  watcher_count?: number;
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export interface Subscription {
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

export interface Entitlement {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  is_active: boolean;
  source: BillingProvider;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Rally Point ──────────────────────────────────────────────────────────────
export interface RallyPoint {
  id: string;
  group_id: string;
  created_by: string;
  name: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Enriched
  distanceFromMe?: number;
  bearingFromMe?: number;
}

// ─── Check-In Timer ───────────────────────────────────────────────────────────
export interface CheckInTimer {
  id: string;
  user_id: string;
  group_id: string | null;
  label: string | null;
  check_in_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  notify_user_ids: string[];
  created_at: string;
  mode?: 'checkin' | 'deadman';
  interval_minutes?: number | null;
  reminder_sent?: boolean;
  escalated?: boolean;
  escalated_at?: string | null;
  acknowledged_at?: string | null;
  // Enriched
  minutesRemaining?: number;
  isOverdue?: boolean;
}

// ─── Map / UI helpers ─────────────────────────────────────────────────────────
export interface MapCrewMember {
  user_id: string;
  group_id: string;
  latitude: number;
  longitude: number;
  /**
   * Device-facing direction in degrees, or null when the member's device has
   * no compass fix. Null must be preserved rather than coerced to 0 — a cone
   * pointing north is a claim about where someone is facing.
   */
  heading: number | null;
  speed: number;
  accuracy: number;
  battery_level: number | null;
  status: LocationStatus;
  sharing_mode: SharingMode;
  updated_at: string;
  last_ping_at: string;
  is_approximate: boolean;
  // Enriched display
  displayName: string;
  displayInitials: string;
  displayAvatar: string | null;
  color: string;
  distanceFromMe?: number;
}

export interface SelectedMapUser {
  userId: string;
  type: 'self' | 'crew';
}
