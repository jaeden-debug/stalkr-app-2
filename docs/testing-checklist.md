# Stalkr — Testing Checklist

## Auth

- [ ] Register with email + password
- [ ] Login with correct credentials
- [ ] Login fails with wrong password (error shown, not crash)
- [ ] Profile auto-created on first sign-in
- [ ] Profile updates persist (display name, nickname, initials)
- [ ] Logout clears session
- [ ] Deep link auth (magic link) works
- [ ] Protected routes redirect to login when unauthenticated

## Groups

- [ ] Create group → appears in list
- [ ] Join group by invite code → success toast
- [ ] Invalid invite code → error toast, no crash
- [ ] Set active group → map updates, realtime connects
- [ ] Group settings sheet opens for admin/owner
- [ ] Rename group → reflects immediately
- [ ] Toggle invite link → code hidden from group detail
- [ ] Toggle enforced tracking
- [ ] Leave group (non-owner) → removed from list
- [ ] Delete group (owner) → group removed, members lose access
- [ ] Member list loads correctly with profiles
- [ ] RLS: cannot see group you're not a member of

## Live Location

- [ ] Location permission prompt appears first time
- [ ] Map centers on self after permission granted
- [ ] Self marker appears and updates when moving
- [ ] Heading arrow rotates with device
- [ ] Broadcast toggle: off = no updates sent; on = updates resume
- [ ] Per-group broadcast state persists across navigation
- [ ] Stale detection: marker turns amber after 5 min
- [ ] Offline detection: marker turns gray after 15 min
- [ ] Approximate location mode: crew sees blurred position
- [ ] Battery level shows in self marker menu

## Map

- [ ] Map loads in satellite mode by default
- [ ] Switch to standard mode
- [ ] Center map button works
- [ ] Tap self marker → SelfMarkerMenu opens
- [ ] Tap crew marker → CrewMemberMenu opens
- [ ] Tap tactical marker → MarkerDetailSheet opens
- [ ] Tap zone → ZoneDetailSheet opens
- [ ] Long press map → [marker placement trigger]
- [ ] Map does NOT rerender all markers on every GPS tick
- [ ] Panning is smooth with 5 crew members
- [ ] Heading arrows update smoothly

## Markers

- [ ] Start marker placement → banner shows
- [ ] Tap map to place → marker appears
- [ ] Cancel placement → no marker created
- [ ] Danger marker creates a group event
- [ ] Delete marker (creator) → gone from map
- [ ] Cannot delete another user's marker (non-admin)
- [ ] Markers persist after app restart
- [ ] Realtime: crew sees new marker within 2 seconds

## Zones / Saved Places

- [ ] Create circle zone → appears on map
- [ ] Create polygon zone → polygon appears
- [ ] Polygon: 3+ points required to finish
- [ ] Enter circle zone → local notification fires
- [ ] Leave circle zone → local notification fires
- [ ] Enter polygon zone → notification fires
- [ ] Zone alerts respect cooldown (no spam)
- [ ] Delete zone → disappears from map and DB
- [ ] Zone visibility: private zone not visible to other members
- [ ] Zone presence tracked in `saved_place_presence`

## Sessions

- [ ] Create session → appears in list
- [ ] Session shows as active
- [ ] End session → status changes to ended
- [ ] Session trail points stored
- [ ] Watcher notification sent on arrival

## Notifications

- [ ] Push token registered on first launch
- [ ] Local zone notification fires on enter/leave
- [ ] Push notification delivered to watchers when session ends
- [ ] Notification tapped → app routes correctly
- [ ] Permission denied → graceful fallback (no crash)
- [ ] Android notification channels created

## Emergency Contacts

- [ ] Add contact → appears in list
- [ ] Contact shows name + phone
- [ ] Delete contact → removed
- [ ] Used in SOS flow

## Bonus Features

### Check-In Timer
- [ ] Start 30-minute timer
- [ ] Countdown visible
- [ ] Resolve timer → cleared
- [ ] Let timer expire → alert fires to group members
- [ ] Timer persists if app is backgrounded

### Low Signal Monitor
- [ ] Risk badge appears when crew member hasn't pinged in 5+ min
- [ ] Risk badge appears for battery < 15%
- [ ] Badge disappears when signal resumes

### SOS Mode
- [ ] Hold SOS button 1.5 seconds → triggers SOS
- [ ] Group event created with type `sos_triggered`
- [ ] Push notifications sent to group admins
- [ ] SOS marker appears on map
- [ ] Cancel SOS visible

### Rally Point
- [ ] Admin sets rally point → flag appears on map
- [ ] Members see distance + bearing
- [ ] Arrival within 30m → admin notified

## Subscription / Billing

- [ ] Free plan limits enforced (3 zones max)
- [ ] Upgrade prompt appears when trying to create 4th zone
- [ ] Subscription screen shows all plans
- [ ] Mock purchase works in dev
- [ ] Restore purchases button present
- [ ] Entitlements loaded from Supabase on startup

## Error Handling

- [ ] Network offline: map still shows last known positions
- [ ] Supabase error: toast shown, no crash
- [ ] GPS unavailable: fallback shown
- [ ] Error boundary catches render crashes
- [ ] All async operations have try/catch

## Performance

- [ ] Map pans smoothly with 10 crew members
- [ ] No memory leaks after switching groups 5 times
- [ ] Realtime channels cleaned up on unmount
- [ ] GPS subscription stops when app backgrounds
- [ ] Trail points not written when stationary

## App Store Readiness

- [ ] Location permission copy is clear and accurate
- [ ] Background location used only when declared
- [ ] No hardcoded API keys in source
- [ ] Subscription screen mentions "Manage in App Store / Play Store"
- [ ] App icon 1024×1024 with no transparency (iOS)
- [ ] Splash screen fills edge-to-edge
- [ ] Privacy policy URL accessible
