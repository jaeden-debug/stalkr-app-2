# Map Remediation — Device QA Checklist

These changes fix device-specific defects (compass behaviour, native marker
rasterisation, provider differences). **Static tests cannot certify them.** The
automated suite proves lifecycle and isolation; only hardware proves the map.

Run on a **physical iPhone and a physical Android device**. A simulator will not
exercise the magnetometer and will not reproduce the bitmap-snapshot class of
bug at all.

## Before you start

```bash
npm run assets:markers   # only if marker colours/types changed
npx pod-install ios      # Stage 1 switched iOS to the Google Maps SDK
npm run ios              # or: npm run android
```

Confirm `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` is present in `.env` and the key is
enabled for **Maps SDK for iOS** in Google Cloud. This is new — iOS previously
rendered Apple Maps and never used the key, so an invalid or unrestricted-wrong
key would show up here for the first time as a blank/grey map.

---

## A. Highest risk — the iOS provider switch

This is the change most likely to surface something unexpected, because half the
marker props in the codebase were previously being discarded on iOS and now
execute for the first time.

| # | Check | Expected | Watch for |
|---|---|---|---|
| A1 | Open the map on iOS | Google Maps tiles, not Apple's | Grey/blank map ⇒ API key not enabled for Maps SDK for iOS |
| A2 | Compare pin positions against a known landmark | Field-pin **tips** sit on the coordinate | Pins now shift up ~19pt vs. before — this is the `anchor` fix, not a regression |
| A3 | Tap a field marker | Detail sheet opens and stays open | Sheet flashing shut ⇒ the 350 ms tap-through guard is still needed (kept deliberately) |
| A4 | Tap a zone label, a crew badge, self | Correct drawer each time | Any dead tap target |
| A5 | Toggle satellite | `hybrid` ↔ `standard` | Tile type not changing |
| A6 | Press CENTER, and "go to" from a member card | Smooth `animateToRegion` | No movement ⇒ camera API regression |
| A7 | Long-press empty map | Waypoint placement starts | — |

---

## B. Self puck — heading (the primary objective)

| # | Check | Expected | Watch for |
|---|-------|----------|-----------|
| B1 | Grant location + motion permissions | Puck appears with arrow | — |
| B2 | **Stand still, rotate the phone 360° slowly** | Arrow tracks the phone's facing direction continuously and smoothly | Arrow frozen ⇒ provider/rotation regression. Arrow shivering ⇒ smoothing too weak |
| B3 | Hold still for 30 s | Arrow is genuinely still | Visible drift ⇒ raise `deadbandDeg` in `useLocationTracker` |
| B4 | Turn your body sharply 90° | Arrow follows immediately, no lag | Sluggish ⇒ lower `snapDeg` |
| B5 | Point phone north, then rotate the **map** with two fingers | Arrow keeps pointing at real-world north as the map spins | If the arrow rotates *with* the map, `flat` is not applying — do **not** add `deviceHeading - mapBearing`; find out why `flat` is being dropped |
| B6 | Walk 200 m | Puck moves without teleporting wildly | Steps up to ~12 m are expected (GPS filter); see the interpolation note below |
| B7 | Drive briefly (passenger) | Arrow reflects phone orientation, not travel direction | This is intended — Stalkr shows device facing, not GPS course |
| B8 | Go indoors / near a large metal object | Arrow may wander; must not spin wildly | — |
| B9 | Lay phone flat on a table | Heading may become unreliable | Should degrade gracefully, not crash |
| B10 | Deny motion permission, restart | Puck renders **without** an arrow | An arrow pointing north with no compass is a lie — this is `self-puck-noheading` |

## C. Self puck — accuracy halo

| # | Check | Expected |
|---|-------|----------|
| C1 | Open map outdoors with good GPS | Small subtle halo, or none if accuracy < 8 m |
| C2 | Walk into a building | Halo grows as accuracy degrades |
| C3 | Watch it for a minute while stationary | Halo does **not** visibly pulse/breathe (quantised to 5 m) |
| C4 | Halo always concentric with the puck | Never lags behind or offsets |

## D. Self selection

| # | Check | Expected |
|---|-------|----------|
| D1 | Tap the self puck | Drawer opens **and** an avatar/initials pin appears above the puck |
| D2 | With a profile photo set | Pin shows the photo |
| D3 | With no photo | Pin shows initials |
| D4 | While selected, walk | Puck **and** pin move together, same coordinate |
| D5 | While selected, rotate the phone | Puck arrow still rotates; pin stays upright |
| D6 | Close the drawer | Pin disappears, puck remains and keeps tracking |
| D7 | **Tap self 20× rapidly** | Exactly one pin, ever. No duplicates, no stragglers |
| D8 | Select self, then create/delete a marker | Puck and pin both survive |
| D9 | Go Dark, then tap self | Grey puck, no arrow, pin still appears |

---

## E. Field markers — the disappearance class

**Android is the priority here.** The blank-bitmap bug was Android-specific;
iOS now shares the rasterisation path for the first time, so test both.

| # | Check | Expected |
|---|-------|----------|
| E1 | Open a crew with ≥ 8 existing markers | All render, all icons visible, none blank |
| E2 | Create a marker | New pin drops with its bounce; **every existing pin stays visible** |
| E3 | Create 5 markers rapidly | No blank pins at any point |
| E4 | Delete one marker | Exactly one disappears |
| E5 | Delete several rapidly | Only the intended ones go |
| E6 | Select a marker | It enlarges, title badge appears, neighbours unchanged |
| E7 | Deselect | Returns to resting size, still visible |
| E8 | Move a marker via the sheet's Move action | Drags, drops, persists |
| E9 | Pan and zoom hard for 30 s, then stop | No pin has gone blank |
| E10 | Create a marker **while zoomed right in**, then zoom out | All pins present |
| E11 | Background the app 2 min, return | All pins present |
| E12 | Force quit and relaunch | All pins present |

> The old failure signature was a pin that became a **blank/invisible marker
> permanently** until app restart — the tap target sometimes still worked. If
> you see an invisible-but-tappable pin, the layout gate has a hole; capture the
> marker id and the action that preceded it.

## F. Zones

| # | Check | Expected |
|---|-------|----------|
| F1 | Crew with several circle + polygon zones | All shapes and all labels render |
| F2 | Create a zone | Existing zones unaffected |
| F3 | Delete a zone | Its shape **and** its label go; others remain |
| F4 | Rename a zone | Only that label changes |
| F5 | Tap a circle zone's **label** | Zone drawer opens (labels are the only tap target for circles) |
| F6 | Tap a polygon's fill | Zone drawer opens |
| F7 | Move a zone via Move Zone | Circle centre / whole polygon shifts and persists |
| F8 | Create markers while zones are visible | No zone flickers or vanishes |
| F9 | Draw a polygon, undo a vertex, add another | Correct vertex removed; no ghost dot left behind |

## G. Crew markers

| # | Check | Expected |
|---|-------|----------|
| G1 | With a second device live in the crew | Cone + badge render |
| G2 | Rotate the second device | Its cone rotates on your map |
| G3 | Second device has no compass fix | **No cone**, badge only |
| G4 | Second device goes dark | Greys out, cone disappears |
| G5 | Badge orientation | Always upright, never rotates with the cone or the map |
| G6 | Member with a profile photo | Badge shows photo, not initials |

## H. Crew isolation (security boundary)

| # | Check | Expected |
|---|-------|----------|
| H1 | Switch crew A → B | A's markers/zones clear, then B's appear |
| H2 | Watch carefully during H1 | **Never** any frame where A's pins render under B's context |
| H3 | Switch back and forth rapidly 5× | Ends on the correct crew's data every time |
| H4 | Switch on a slow connection (Network Link Conditioner) | Brief empty map is acceptable; wrong-crew data is a **failure** |
| H5 | Stay on one crew; pull to refresh / let realtime resubscribe | Map does **not** blank — this is the wipe-before-load fix |

## I. Performance

| # | Check | Expected |
|---|-------|----------|
| I1 | Rotate the phone continuously for 30 s with 20+ markers | Smooth; no stutter tied to rotation |
| I2 | Same, watching the Android profiler | Marker layer should not be re-rendering with the compass |
| I3 | Leave the map open 10 min | No creeping memory growth, no frame-rate decay |
| I4 | Background/foreground 10× | Location keeps working; exactly one GPS and one compass watcher |

---

## Known items to confirm rather than fix on sight

1. **Stepped self position (B6).** Position interpolation was deliberately not
   implemented. `newArchEnabled=true`, and `AnimatedRegion` / `MarkerAnimated`
   rely on `setNativeProps`, which is unreliable under Fabric. Correctness and
   lifecycle stability were prioritised per plan. If stepping is too visible in
   the field, that is a follow-up, not a regression.

2. **The 350 ms tap-through guard** (`useMapStore.handleMapTap`) was kept. It
   existed because Apple Maps ignored `stopPropagation`; Google Maps should not
   bubble marker taps at all. If A3/A4 pass consistently across many taps, it
   can be removed in a follow-up — with its own QA pass.

3. **Pin positions shift on iOS (A2).** Expected. `anchor` was silently ignored
   under Apple Maps, so pins were centre-anchored; they are now tip-anchored.

## Reporting a failure

Include: platform + OS version, device model, which check number, whether the
marker was blank vs. absent vs. present-but-wrong, and the exact action
sequence. For blanking, note whether the invisible marker was still tappable —
that distinguishes a rasterisation failure from an unmount.

---

## Responsive / device-fit checklist

Added after the responsive pass. Everything below was reasoned about
arithmetically from the declared styles — **none of it has been rendered on a
real screen**, because this machine has no iOS runtime and no Android SDK
installed. Text metrics in particular are estimates, so treat these as
predictions to confirm, not results.

### Arithmetic already done

Bottom overlay stack, measured from `constants/mapLayers.ts`:

| Overlay | Anchored at | Occupies to |
|---|---|---|
| Check-in badge | 140 | ~184 |
| SOS ring | 148 | 226 (ring is 78 tall) |
| Overdue-journey prompt | 236 + safe-area inset | ~388 |

Top: `TacticalHud` gradient occupies 0–150.

Vertical budget, worst realistic case (iPhone SE, 667pt, no home indicator):
prompt top edge lands ~279pt from the top, clear of the HUD's 150. On a 640dp
Android with a ~24dp gesture inset it lands ~228pt from the top. Both fit.

Horizontal: the prompt's three buttons total ~278pt of content against ~319pt
available on a 375pt-wide screen and ~304pt on a 360dp screen. They fit on one
row; `flexWrap: 'wrap'` covers the case where they do not.

**Known limit:** at large accessibility text sizes the prompt card grows
upward. Around 3x scaling it would reach the HUD. Confirm on a device with
Larger Text turned well up.

### Must confirm on hardware

1. **iPhone SE (or any 375×667)** — map screen with an active journey, an armed
   check-in, and the SOS button visible at once. Nothing overlapping, every
   button pressable.
2. **iPhone Pro Max** — same, plus confirm the prompt clears the home indicator.
3. **Small Android (360dp)** with gesture navigation — confirm the prompt and
   SOS clear the gesture bar.
4. **Rotation / split-screen (Android)** — open the nav drawer and a sheet, then
   change the window size. Both now read `useWindowDimensions`, so they should
   re-snap to the new viewport rather than the launch-time one. This is the
   specific regression the responsive pass fixed and the one most worth
   checking.
5. **Larger Text at maximum** — auth screens, journey sheet, overdue prompt.
   Nothing clipped, nothing unreachable.
6. **Keyboard** — login, register, journey sheet, zone creation. The submit
   control must stay reachable. (Handled via `AuthScaffold` +
   `windowSoftInputMode=adjustResize`; verify rather than assume.)
7. **Long content** — a crew name and a destination name of 40+ characters.
   Confirm truncation, not layout break.

### Host setup required before any of this

This machine has neither an iOS simulator runtime nor the Android SDK:

    xcodebuild -downloadPlatform iOS        # or Xcode > Settings > Components

Android: install Android Studio, then create an AVD.
