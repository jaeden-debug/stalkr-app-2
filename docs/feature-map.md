# Stalkr — Feature Map

## Free Tier

| Feature | Limit |
|---|---|
| Groups | 2 |
| Members per group | 5 |
| Saved zones | 3 |
| Trail history | 4 hours |
| Marker types | All |
| Sessions | 1 per group |

## Pro Tier

| Feature | Limit |
|---|---|
| Groups | 10 |
| Members per group | 25 |
| Saved zones | 50 |
| Trail history | 48 hours |
| Polygon zones | ✓ |
| Zone alerts (enter/leave/stay) | ✓ |
| Marker photos | ✓ |
| Emergency contacts | ✓ |
| Journey mode | ✓ |
| Watcher notifications | ✓ |
| Export coordinates | ✓ |

## Crew Tier

| Feature | Limit |
|---|---|
| Groups | 50 |
| Members per group | 100 |
| Saved zones | 500 |
| Trail history | 7 days |
| All Pro features | ✓ |
| Admin controls | ✓ |
| Enforced tracking | ✓ |
| Member permissions | ✓ |
| Group event timeline | ✓ |
| Priority safety features | ✓ |

## Custom / Bonus Features

### Safety Check-In Timer (FEATURES.CHECKIN_TIMER)
- User sets countdown (15, 30, 60, 90 min)
- Must resolve before timer expires
- If missed: push notification sent to group members
- Stored in `check_in_timers`

### Low Signal / Stale Risk Monitor (FEATURES.LOW_SIGNAL_MONITOR)
- Triggers on: >5 min since last ping, accuracy > 50m, battery < 15%
- Risk badge shown on crew marker
- Optional admin notification

### Silent SOS / Panic Pin (FEATURES.SOS_MODE)
- Hold button 1.5 seconds to activate
- Creates `sos_triggered` group event
- Sends push to group admins
- Drops SOS marker at exact location
- Cancel button available after activation

### Rally Point Mode (FEATURES.RALLY_POINTS)
- Admin/owner sets rally point (flag on map)
- All members see bearing + distance in real time
- Arrival notification sent to admin when member within 30m
- Stored in `rally_points` (one active per group)

## Screens

| Screen | Route |
|---|---|
| Login | `/(auth)/login` |
| Register | `/(auth)/register` |
| Map | `/(tabs)/map` |
| Groups | `/(tabs)/groups` |
| Sessions | `/(tabs)/sessions` |
| Settings | `/(tabs)/settings` |
| Group Detail | `/groups/[id]` |
| Session Detail | `/sessions/[id]` |
| Profile Edit | `/profile` |
| Subscription | `/subscription` |
| Emergency Contacts | `/emergency-contacts` |
| Privacy Settings | `/privacy` |
| Notification Settings | `/notifications-settings` |
| Trail Settings | `/trail-settings` |
