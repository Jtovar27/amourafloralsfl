-- Amoura Florals — Migration 004: storage bucket + RLS for product photos
-- Run AFTER 003_addons.sql.
-- Idempotent: safe to re-run; ON CONFLICT updates the bucket settings, and
-- DROP POLICY IF EXISTS guards the policy creates.

-- ── Media bucket ─────────────────────────────────────────────────────────────
-- Public bucket used by the admin product modal to host product photos uploaded
-- straight from the phone gallery. 10 MB ceiling gives slack for raw phone
-- captures before the client recompresses to JPEG. Allowed MIME list is broad
-- so phone-native formats (HEIC/HEIF/AVIF) aren't pre-rejected at upload time.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/avif',
    'image/bmp',
    'image/tiff'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at         = NOW();

-- ── RLS policies on storage.objects (media bucket only) ──────────────────────
-- storage.objects already has RLS enabled by Supabase; we only define the
-- policies that apply to bucket_id = 'media'. DROP IF EXISTS guards re-runs.

-- Public read: anyone (anon + authenticated) can SELECT objects in the bucket
-- so the storefront can render product images via the public URL.
DROP POLICY IF EXISTS "Public read media" ON storage.objects;
CREATE POLICY "Public read media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media');

-- Authenticated insert: any signed-in admin can upload new product photos.
DROP POLICY IF EXISTS "Authenticated insert media" ON storage.objects;
CREATE POLICY "Authenticated insert media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- Authenticated update: re-uploads / metadata edits from the admin Media tab.
DROP POLICY IF EXISTS "Authenticated update media" ON storage.objects;
CREATE POLICY "Authenticated update media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'media')
  WITH CHECK (bucket_id = 'media');

-- Authenticated delete: admin Media tab Delete button.
DROP POLICY IF EXISTS "Authenticated delete media" ON storage.objects;
CREATE POLICY "Authenticated delete media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');
