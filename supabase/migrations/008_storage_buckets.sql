-- 008_storage_buckets.sql
-- Creates the storage buckets the app uploads to and their access policies.
-- The app references: 'avatars' (auth.ts uploadAvatar), 'zone-photos'
-- (savedPlaces.ts) and 'marker-photos'. All use getPublicUrl → public read.

-- ── Buckets ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values
  ('avatars',       'avatars',       true),
  ('zone-photos',   'zone-photos',   true),
  ('marker-photos', 'marker-photos', true)
on conflict (id) do update set public = excluded.public;

-- ── Policies (public read, authenticated write, owner delete) ────────────────
drop policy if exists "stalkr_storage_public_read"   on storage.objects;
drop policy if exists "stalkr_storage_auth_insert"   on storage.objects;
drop policy if exists "stalkr_storage_auth_update"   on storage.objects;
drop policy if exists "stalkr_storage_owner_delete"  on storage.objects;

create policy "stalkr_storage_public_read" on storage.objects
  for select
  using (bucket_id in ('avatars', 'zone-photos', 'marker-photos'));

create policy "stalkr_storage_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'zone-photos', 'marker-photos'));

create policy "stalkr_storage_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'zone-photos', 'marker-photos'));

create policy "stalkr_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'zone-photos', 'marker-photos') and owner = auth.uid());
