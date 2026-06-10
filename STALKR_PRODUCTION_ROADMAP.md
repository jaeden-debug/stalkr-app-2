# Stalkr — Production Roadmap

_Last updated: 2026-06-10. Effort key: **S** = quick, **M** = a focused session, **L** = a big build (often needs DB/server work)._

The plan: we go phase by phase. You review the current TestFlight build, give feedback, and we bank each phase (plus any fixes from your feedback) until it's production-ready.

---

## ✅ Where we are (already shipped, phases 1–5)

**Map & markers**
- Clean single-icon satellite/map toggle; reliable auto-center on load.
- Long-press to drag markers & zones (haptic + enlarge); render-robustness fix (no more blank/vanishing markers).
- Circle-zone draft flow (drop center → drag center/edge handles → confirm); polygon finish toolbar moved off the HUD.
- Granular realtime (no full-refetch churn).

**Navigation & HUD**
- Bottom tab bar removed; everything routes through the map drawer.
- One glass header (STALKR · crew · compass); circular center button stacked under the sat toggle.
- Drawer peek = flashing LIVE/DARK + a search bar.

**Crews**
- CREWS switcher sheet (switch / new / join).
- Multi-crew isolation; initial crew presence loads on open/switch; members appear live on join.
- Broadcast to **all** crews you're live in at once; go dark in one crew → greyed "last known" marker there, still live elsewhere.

**Journeys & search**
- Maps-style place search → place card (Start Journey / Save Zone / Drop Marker).
- Journey ETA in the HUD (distance left, ETA, arrival time, live speed).
- Journey watch link + arrival auto-detect.

**Settings & identity**
- Glass restyle across all sheets (killed the off-theme purple).
- Profile photo upload; display name, default call sign, initials, phone.
- Per-crew settings: your call sign/initials in this crew, crew mute, crew zone activity, **per-member** enter/leave/overstay/mute toggles.
- Emergency contacts wired: SOS texts them your location, journey "Text Contacts," crew member call/text.

**Member detail cards** (self + crew): name, avatar, distance, heading, speed, battery, accuracy, status, last-updated, live coords, Set Waypoint, Go To Location; offline = greyed skull + frozen coords.

**App Store basics**: Delete Account (double-confirm + RPC), Terms/Privacy links, social link previews wired to your OG images.

---

## ⚠️ Phase 6 — Pre-flight blockers (do these to actually ship)

_These gate App Store approval / correct behavior. Mostly small but non-negotiable._

- [ ] **Run DB migrations** `006_crew_notification_prefs.sql` + `007_delete_account.sql` on Supabase. **(S)** _Without 007, Delete Account fails — Apple rejects._
- [ ] **Host real Terms of Service + Privacy Policy** at `stalkr.app/terms` and `/privacy` (links exist; pages must resolve). **(S/M)** _Apple requires a working privacy policy URL._
- [ ] **Replace placeholder App Store / TestFlight IDs** in `app/invite/[code]+web.tsx` (`id0000000000`, `XXXXXXXXXX`). **(S)**
- [ ] **Confirm the `avatars` storage bucket exists** + is public-read (photo upload assumes it). **(S)**
- [ ] **Verify account deletion end-to-end** on a throwaway account after migration. **(S)**
- [ ] **Confirm push notifications** work on a real device build (EAS projectId, APNs key). **(M)**
- [ ] App icon, splash, store screenshots, App Privacy "nutrition label," support URL. **(M)**

---

## 🛟 Phase 7 — Core safety features (Stalkr's reason to exist)

_This is the differentiator. Hunters/outdoors users buy this for safety._

- [ ] **Check-In Timer** — "check in every X min"; a missed check-in alerts the crew (push + activity event). **(L)**
- [ ] **Dead-Man Switch** — if you don't respond within X min, auto-send last known location + battery + timestamp to crew. **(L)**
- [ ] **Emergency Medical Profile** — blood type, allergies, medical notes, primary emergency contact; surfaced on your member card / SOS. **(M)** _New profile columns or table._
- [ ] **Arrival Notifications polish** — "Jaeden arrived at camp," journey completed, into the activity feed + push, consistently. **(M)** _(Auto-arrival detection already exists; wire it everywhere.)_
- [ ] **Offline-detection alerts** — when the crew is actively live and someone drops to offline mid-trip, optionally alert (the "someone went dark in the bush" case). **(M)**

---

## 🔔 Phase 8 — Awareness & communication

- [ ] **Activity Feed** — a screen over `group_events`: entered zone, went offline, placed waypoint, arrived, SOS, session started/ended. **(M)**
- [ ] **Push Notification Center** — a dedicated, persistent in-app inbox storing all alerts/activity/zone/crew/journey/SOS events (not just OS notifications). **(L)**
- [ ] **Server-side notification-pref consumption** — make the `send-push` edge function read `crew_notification_prefs` / `member_notification_prefs` so per-member muting suppresses *background* pushes (today only foreground is gated). **(M)**

---

## 🗺️ Phase 9 — Map power tools

- [ ] **Measure Tool** — drop A, drop B → distance + bearing (hunters will use constantly); multi-segment optional. **(M)**
- [ ] **Marker Comments + Photos** — crew can comment on a marker ("fresh tracks here") and attach images. **(L)** _Needs a comments table + photo storage._
- [ ] **Marker types / icons polish** — ensure all marker types render cleanly and are filterable. **(S/M)**

---

## 👥 Phase 10 — Crew management depth

- [ ] **Crew Roles & Permissions** — Owner / Admin / Moderator / Member / Viewer with enforced capabilities. **(L)**
- [ ] **Invite Management** — see pending/expired invites, revoke, regenerate, set expiry. **(M)**
- [ ] **Per-crew avatar override** (per-crew profile photo, not just call sign/initials). **(S)**

---

## 📈 Phase 11 — Growth & sharing

- [ ] **Dynamic social previews (server-rendered)** — crawler-visible OG images that bake in traveler + destination + ETA (needs an SSR/edge function; current dynamic title only renders client-side). **(L)**
- [ ] **Referral System** — invite 3 → unlock a premium month. **(M)**
- [ ] **Public journey link polish** — richer watch page, "no app required" framing, email/SMS opt-in flows. **(M)**

---

## ✨ Phase 12 — Polish & hardening (production quality)

- [ ] **Cleanup** — remove the dormant in-drawer "New Journey" modal and the orphaned `(tabs)/groups.tsx`; prune dead styles. **(S)**
- [ ] **Empty / loading / error states** everywhere (no crew, no journeys, GPS acquiring, offline, failed loads). **(M)**
- [ ] **Onboarding** — first-run permission priming (location, notifications, contacts), create/join first crew. **(M)**
- [ ] **Consistent haptics, transitions, and copy** across all sheets; final brand pass. **(M)**
- [ ] **Performance** — marker/realtime load with large crews; battery profiling of multi-crew broadcast + tracking interval. **(M)**
- [ ] **Accessibility** — labels, hit targets, dynamic type, contrast. **(M)**
- [ ] **Resilience** — network drop handling, token refresh, background-location reliability, crash/Sentry coverage. **(M)**
- [ ] **QA matrix** — iOS (and Android if shipping) device pass on each core flow. **(M)**

---

## How to read this
- Tell me which phase to start (I'd recommend **Phase 6 blockers first**, then **Phase 7 safety** since that's the product's core).
- Add notes/▢ checks inline, or just tell me "do Phase 7" and any feedback from the TestFlight build.
- Anything you want reprioritized, cut, or added — say the word and I'll restructure.
