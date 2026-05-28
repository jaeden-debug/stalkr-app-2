# Stalkr — Database Schema

## Enum Types

```sql
member_role: owner | admin | member
sharing_mode: always | sessions_only | paused | private
location_status: live | stale | offline | paused
group_type: hunting | hiking | camping | family | atv | custom
marker_type: waypoint | danger | safe_zone | camp | vehicle | animal_sign | evidence | supply_cache | custom
saved_place_type: camp | parking | access_point | water_source | hazard | boundary | custom
billing_provider: apple_iap | google_play_billing | stripe_web | manual_admin
subscription_plan: free | pro | crew
subscription_status: active | expired | cancelled | grace_period | trial
```

## Core Tables

### profiles
Extends `auth.users`. Auto-created on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users |
| display_name | text | |
| nickname | text | Shown on map |
| initials | text | Max 2 chars |
| avatar_url | text | Supabase Storage URL |
| phone | text | Optional |
| default_sharing_mode | sharing_mode | |
| is_online | boolean | |
| last_seen_at | timestamptz | |
| push_token | text | Expo push token |

### groups

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| type | group_type | |
| created_by | uuid | FK → profiles |
| invite_code | text | Unique, 8 chars |
| invite_enabled | boolean | |
| tracking_mode | text | flexible | enforced |

### group_members
Unique on (group_id, user_id).

### live_locations
Unique on (group_id, user_id). Upserted on every GPS write. Realtime-enabled.

### markers
Created by group members. Never deleted by coordinate. Delete only by ID.

### saved_places
Zones. Supports circle and polygon shapes. `alert_rules` is a JSONB field.

### saved_place_presence
Tracks which users are currently inside each zone. Updated on every GPS tick.

### sessions
Time-bounded group activities. Supports destinations and watchers.

### trail_points
One row per GPS tick where movement threshold is met. Indexed by `(group_id, user_id)` and `created_at DESC`.

### subscriptions
Server-authoritative. Written only by server-side logic or admin.

### entitlements
Current active plan per user. Read by app on startup. Updated server-side after purchase.

### rally_points
Admin-set rally locations per group. One active per group.

### check_in_timers
User-set safety timers. Notify `notify_user_ids` if not resolved by `check_in_at`.

## RLS Summary

| Table | Read | Write |
|---|---|---|
| profiles | Own or shared group member | Own only |
| groups | Member only | Insert: any auth user; Update: admin/owner; Delete: owner |
| group_members | Member of group | Insert: self or admin; Update: admin or self; Delete: admin or self |
| live_locations | Member of group | Own only |
| markers | Member of group | Insert: member; Update/Delete: creator or admin |
| saved_places | Member (filtered by visibility) | Insert: member; Update/Delete: creator or admin |
| subscriptions | Own user only | Server-side only (no client write) |
| entitlements | Own user only | Server-side only |
