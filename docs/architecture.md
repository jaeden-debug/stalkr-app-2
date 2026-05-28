# Stalkr — Architecture Overview

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo React Native (SDK 51) |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based) |
| State | Zustand (split stores) |
| Realtime | Supabase Realtime (postgres_changes) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Location | expo-location |
| Notifications | expo-notifications |
| Maps | react-native-maps |
| Styling | NativeWind (Tailwind-like) |
| Build | EAS Build |

---

## Store Architecture

Zustand is split into focused stores. Each store owns one domain.

| Store | Owns |
|---|---|
| `useAuthStore` | User session, profile, sign in/out |
| `useGroupStore` | Groups, group members, markers, saved places |
| `useLocationStore` | My location, crew locations, broadcasting state |
| `useMapStore` | Map UI state (selected user, satellite toggle, center trigger, trail visibility, placement modes) |
| `useSessionStore` | Active sessions, session members |
| `useBillingStore` | Entitlements, current plan, offerings |

**No giant god store.** Each domain is isolated.

---

## Location Pipeline

```
expo-location.watchPositionAsync()
  → useLocationTracker (hook)
    → filter weak/stale GPS fixes
    → upsert live_locations (Supabase)
    → write trail_points (throttled)
    → check zone presence (useZonePresence)
    → update useLocationStore.myLocation
```

**Single GPS subscription.** One watcher, never duplicated.

---

## Realtime Pipeline

```
Supabase Realtime (postgres_changes)
  → useRealtimeGroup (hook)
    → live_locations → useLocationStore.crewLocations
    → markers → useGroupStore.markers
    → saved_places → useGroupStore.savedPlaces
    → group_events → (event feed)
    → rally_points → useGroupStore.activeRallyPoint
```

**One channel per active group.** Cleaned up on unmount.

---

## Map Render Architecture

The map is deliberately modular and memoized:

```
MapContainer
  ├── TrailLayer (memoized, separate from markers)
  ├── ZoneLayer (memoized per zone ID)
  ├── DestinationMarker (only when destination set)
  ├── RallyPointMarker (feature-flagged)
  ├── MarkerLayer (memoized per marker ID)
  ├── CrewMarkerLayer → CrewMarker (memoized per user)
  ├── SelfMarker (memoized, custom equality check)
  └── MapControls (HUD overlay)
```

**SelfMarker does NOT rerender on every GPS tick.** Custom equality comparator suppresses renders for sub-5µ° moves and <3° heading changes.

---

## Zone System

```
SavedPlace (Supabase)
  ├── shape_type: 'circle' | 'polygon'
  ├── radius_meters (for circles)
  ├── polygon_coords (for polygons)
  ├── notify_on_arrival
  ├── notify_on_leave
  └── alert_rules: {
        stay_too_long_minutes,
        notify_admins,
        notify_user,
        quiet_hours_start,
        quiet_hours_end,
        repeat_cooldown_minutes,
        severity,
        message_template
      }
```

Zone presence is tracked in `saved_place_presence` and checked via `useZonePresence` on every valid GPS tick.

---

## Billing Architecture

Billing is fully abstracted:

```
useBillingStore
  ├── currentPlan: SubscriptionPlan
  ├── loadEntitlements() → reads from Supabase.entitlements
  ├── purchase() → routes to BillingAdapter
  └── restore() → routes to BillingAdapter

BillingAdapter interface:
  ├── DevBillingAdapter (mock, always returns success)
  ├── RevenueCatBillingAdapter (production)
  └── (future) StripeBillingAdapter

Entitlements are server-authoritative.
App reads from Supabase.entitlements, not local store alone.
```

---

## Feature Flags

All optional features are in `src/config/features.ts`:

```typescript
export const FEATURES = {
  CHECKIN_TIMER: true,
  LOW_SIGNAL_MONITOR: true,
  SOS_MODE: true,
  RALLY_POINTS: true,
  OFFLINE_MAPS: false,   // not built yet
  ...
}
```

To remove a feature: set to `false` and it is entirely hidden.

---

## 4 Custom Bonus Features

### 1. Safety Check-In Timer
User sets "check on me in N minutes." Local countdown timer. If not resolved, alerts group members via push. Stored in `check_in_timers` table.

### 2. Low Signal / Stale Risk Monitor
Detects when a user hasn't pinged in 5+ minutes, has poor GPS accuracy, or battery < 15%. Shows risk badge on map marker. Optionally notifies admins.

### 3. Silent SOS / Panic Pin
Hold-to-activate SOS button on map. Drops exact location, creates high-priority group event, sends push notifications to group admins. Designed to be discreet (no confirmation dialog during active hold).

### 4. Rally Point Mode
Group admin sets a rally point (flag marker on map). Every member sees live distance and compass bearing to the rally point. App notifies admin when members arrive within 30m. Stored in `rally_points` table.

---

## Background Location

Currently structured for foreground tracking. Background location is prepared:

- `expo-task-manager` is installed
- Background task skeleton is ready in `useLocationTracker`
- iOS `UIBackgroundModes: ['location']` is configured in `app.config.ts`
- Android `ACCESS_BACKGROUND_LOCATION` permission is declared

To enable background tracking:
1. Request background permission: `Location.requestBackgroundPermissionsAsync()`
2. Define the task with `TaskManager.defineTask`
3. Call `Location.startLocationUpdatesAsync` with the task name

This will be enabled in V1.1 after App Store review validation.
