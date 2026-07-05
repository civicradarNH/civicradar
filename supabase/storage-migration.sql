-- CivicRadar — move report photos from base64 text into Supabase Storage.
-- Run once in the Supabase SQL Editor. See ARCHITECTURE.md Stage 1 for context.
--
-- The app code (js/app.js Backend.uploadReportImage/reportToRow/
-- updateReportResolution) already uploads new photos to the `report-photos`
-- bucket and stores the resulting public URL in the existing `reports.image`
-- / `reports.resolution_image` text columns — no schema/column rename
-- needed, since those columns already accept arbitrary text and existing
-- rows (test data) are disposable. Old rows just keep their base64 value
-- until re-synced; nothing reads/writes them differently based on which
-- form they're in (a data: URL and an https:// URL are both valid <img src>).

-- ---------------------------------------------------------------------
-- Storage bucket (adjust size/MIME limits if compression settings change)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,
  524288,  -- 512 KB per object after client compression (320px, q=0.52 JPEG)
  array['image/jpeg']
)
on conflict (id) do nothing;

-- Anyone can view hazard photos (public map).
drop policy if exists "report_photos_select" on storage.objects;
create policy "report_photos_select"
  on storage.objects for select
  using (bucket_id = 'report-photos');

-- Authenticated (including anonymous-auth) users upload only into their own
-- folder: {auth.uid()}/{report_id}[-resolved].jpg. Every CivicRadar session —
-- citizen or admin — has a real auth.uid() via signInAnonymously(), so this
-- applies uniformly. Object names must end in .jpg (client compresses to JPEG;
-- see Backend.uploadReportImage). MIME is also restricted at bucket level below.
-- For stronger validation (magic-byte check, max dimensions), add a Storage
-- Edge Function on upload — not required for the SQL/policy baseline here.
drop policy if exists "report_photos_insert_own" on storage.objects;
create policy "report_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) ~ '\.jpe?g$'
  );

drop policy if exists "report_photos_update_own" on storage.objects;
create policy "report_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "report_photos_delete_own" on storage.objects;
create policy "report_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
