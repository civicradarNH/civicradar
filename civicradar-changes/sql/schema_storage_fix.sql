-- =====================================================================
-- CivicRadar — S-01 Storage hardening migration
-- Run once in: Supabase Dashboard → SQL Editor (STAGING first, then prod)
-- Additive and idempotent.
--
-- IMPORTANT CONTEXT (read before running):
-- Your app CODE already routes photos to Storage correctly — reportToRow()
-- uploads both the report image and the resolution image to the
-- 'report-photos' bucket and stores the returned public URL in the row
-- (not base64). So the "base64 in DB" problem is mostly ALREADY SOLVED in
-- code. What's missing is that the bucket + its access policies were never
-- defined in schema — they only exist because someone created them by hand
-- in the dashboard. That makes the setup:
--   • not reproducible on your staging project (bucket won't exist there),
--   • undocumented (nobody can see the access rules in version control),
--   • potentially insecure (hand-made policies are easy to get too-open).
--
-- This migration makes the Storage layer EXPLICIT, REPRODUCIBLE, and SECURE,
-- and cleans up the base64 ambiguity in column comments. It does NOT change
-- your app code — the code already does the right thing.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Create the report-photos bucket (public read, as the code expects)
--    Hazard photos are shown on a public map, so public READ is intentional.
--    WRITE is locked down separately below.
--    (storage.buckets / storage.objects are managed by the Storage extension;
--     these statements are the SQL equivalent of the dashboard bucket UI.)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,                                   -- public read (map photos are public)
  1048576,                                -- 1 MB hard cap per file (photos are ~30-160KB after the app's 320px/0.52 compression, so this is generous but blocks abuse)
  array['image/jpeg', 'image/png', 'image/webp']  -- images only
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------
-- 2. Storage access policies (the security part)
--    Default Supabase Storage denies everything under RLS. We open exactly
--    what's needed and no more.
-- ---------------------------------------------------------------------

-- READ: anyone may read objects in report-photos (public map photos).
drop policy if exists "report_photos_public_read" on storage.objects;
create policy "report_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'report-photos');

-- WRITE (insert): an authenticated user may upload ONLY into their own
-- folder — the app uploads to `${ownerId}/${reportId}.jpg`, so we require the
-- first path segment to equal the caller's uid. This stops one user from
-- writing objects under another user's prefix, or spraying junk files into
-- the bucket root.
drop policy if exists "report_photos_owner_insert" on storage.objects;
create policy "report_photos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE (upsert): the code uses upsert:true, so allow owners to overwrite
-- their own objects (same folder rule). No cross-user overwrite.
drop policy if exists "report_photos_owner_update" on storage.objects;
create policy "report_photos_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: deliberately NOT granted to authenticated. Photos tied to civic
-- reports shouldn't be user-deletable at will (audit/integrity); deletion,
-- if ever needed, goes through a privileged/definer path or the dashboard.


-- ---------------------------------------------------------------------
-- 3. Fix the misleading column comments (base64 → Storage URL)
--    The code stores a Storage URL in these columns; the old comments said
--    "data URL", which is stale and the source of the S-01 confusion.
--    Comments only — no data change.
-- ---------------------------------------------------------------------
comment on column public.reports.image is
  'Supabase Storage public URL (report-photos bucket). Never base64 in a synced row.';
comment on column public.reports.resolution_image is
  'Supabase Storage public URL (report-photos bucket) — the "after / fixed" photo. Never base64 in a synced row.';


-- ---------------------------------------------------------------------
-- 4. proof_url (coordinator / NGO ID proofs) — tighten intent
--    schema comment currently says "data URL or Storage path" (ambiguous).
--    These are sensitive (ID documents) and should NOT sit as base64 in a
--    row, and should NOT be world-readable like map photos. If/when you wire
--    proof uploads, route them to a SEPARATE, PRIVATE bucket (below) and
--    store a path, using signed URLs for access — never getPublicUrl.
--    Bucket is created here so it's ready and documented; policies restrict
--    it to the owner only.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'id-proofs',
  'id-proofs',
  false,                                  -- PRIVATE (ID docs are not public)
  2097152,                                -- 2 MB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Private bucket: owner-only read AND write. No public read.
drop policy if exists "id_proofs_owner_all" on storage.objects;
create policy "id_proofs_owner_all"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'id-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'id-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on column public.access_requests.proof_url is
  'Path in the PRIVATE id-proofs bucket. Access via signed URL only — never public, never base64.';


-- =====================================================================
-- Verification (run and eyeball):
--   select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id in ('report-photos','id-proofs');
--   -- report-photos: public = true;  id-proofs: public = false
--
--   select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--   order by policyname;
-- =====================================================================
