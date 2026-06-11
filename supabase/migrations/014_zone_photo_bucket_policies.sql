-- 014_zone_photo_bucket_policies.sql
-- The zone-photos and saved-place-photos buckets had 0 RLS policies, so uploads
-- (and in some clients, reads) were blocked. This adds the same public-read +
-- authenticated-write policies the avatars/marker-photos buckets already use.
-- Idempotent: safe to run multiple times.

-- Ensure the buckets exist and are public (no-op if already present).
insert into storage.buckets (id, name, public)
values
  ('zone-photos',        'zone-photos',        true),
  ('saved-place-photos', 'saved-place-photos', true)
on conflict (id) do update set public = excluded.public;

-- Clean slate for these specific policies so re-running stays consistent.
drop policy if exists "zonephotos_public_read"   on storage.objects;
drop policy if exists "zonephotos_auth_insert"   on storage.objects;
drop policy if exists "zonephotos_auth_update"   on storage.objects;
drop policy if exists "zonephotos_owner_delete"  on storage.objects;

-- Public read (buckets are public; needed for getPublicUrl to serve images).
create policy "zonephotos_public_read" on storage.objects
  for select
  using (bucket_id in ('zone-photos', 'saved-place-photos'));

-- Any authenticated user may upload.
create policy "zonephotos_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('zone-photos', 'saved-place-photos'));

-- Any authenticated user may overwrite (upsert).
create policy "zonephotos_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('zone-photos', 'saved-place-photos'));

-- Only the uploader may delete their own object.
create policy "zonephotos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('zone-photos', 'saved-place-photos') and owner = auth.uid());
