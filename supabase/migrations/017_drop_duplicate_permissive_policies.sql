-- ─────────────────────────────────────────────────────────────────────────────
-- P1: the 'viewer' role's read-only restriction is not enforced in production.
--
-- NOT APPLIED — this changes who can write in a live database, which is a
-- product decision. Review before running.
--
-- ── What was found ──────────────────────────────────────────────────────────
-- The live database contains TWO parallel policy sets. One matches this repo
-- (ll_*, markers_*, sp_*, tp_*). The other does not appear in any migration
-- file here:
--
--   live_locations_insert_own          markers_insert_group_members
--   live_locations_update_own          saved_places_insert_group_members
--   live_locations_delete_own          trail_points_insert_own
--   ...and equivalents on groups, group_members, profiles, group_events,
--      sessions, saved_place_photos
--
-- Postgres RLS policies are PERMISSIVE by default, meaning they are OR'd. So
-- for every one of these, the weaker duplicate re-grants what the stricter one
-- was written to deny:
--
--   ll_insert                   WITH CHECK (... AND is_group_contributor(gid))
--   live_locations_insert_own   WITH CHECK (... AND is_group_member(gid))
--                                                    ^ includes 'viewer'
--
-- is_group_contributor excludes 'viewer'; is_group_member does not. Migration
-- 011 is titled "Enforce read-only viewers + moderator content removal", and
-- that intent currently does not hold: a viewer can broadcast live location,
-- write trail points, and create markers and zones.
--
-- 011 dropped only the names it knew about (`drop policy if exists
-- "markers_insert"`), so the parallel set survived untouched.
--
-- ── The wider issue ─────────────────────────────────────────────────────────
-- These migrations are not the source of truth for this database. Something
-- applied policies out of band — the dashboard, or a migration that never made
-- it into the repo. Worth reconciling before relying on migration review as a
-- security control.
--
-- ── Effect of applying this ─────────────────────────────────────────────────
-- Only 'viewer' loses write access, which is the documented intent. Owner,
-- admin, moderator and member are all contributors and are unaffected.
-- Verify first:
--   select role, count(*) from public.group_members group by role;
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "live_locations_insert_own"          on public.live_locations;
drop policy if exists "live_locations_update_own"          on public.live_locations;
drop policy if exists "live_locations_delete_own"          on public.live_locations;
drop policy if exists "markers_insert_group_members"       on public.markers;
drop policy if exists "markers_delete_creator_or_admin"    on public.markers;
drop policy if exists "saved_places_insert_group_members"  on public.saved_places;
drop policy if exists "trail_points_insert_own"            on public.trail_points;

-- The remaining duplicates below are equivalent-or-stricter rather than weaker,
-- so they are listed for reconciliation but NOT dropped here without review:
--   groups: "Users can view groups they created" OR groups_select_member
--     -> lets a creator read a crew they are no longer a member of. Arguably
--        intended, arguably a leak. Decide explicitly.
--   profiles: three UPDATE policies, all self-scoped -> harmless duplication.
--   group_members: "Users can join groups as themselves" OR
--     group_members_insert_admin_or_self_invite -> the former allows joining
--     ANY crew whose id you can guess, with no invite check. Review closely.
