-- ══════════════════════════════════════════════════════════════════
-- Gig cover images
--
-- Until now every listing showed a stock photo picked from its role type.
-- Hirers can now upload their own, or turn the image off entirely, and
-- change their mind later without reposting.
--
-- Three explicit states rather than "null means default", so "no image"
-- is a real choice and can't be confused with "not set yet":
--   default → the role-based stock photo (what everyone has today)
--   custom  → cover_image_url
--   none    → render no image at all
--
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gigs ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS cover_mode text NOT NULL DEFAULT 'default'
  CHECK (cover_mode = ANY (ARRAY['default','custom','none']));

-- A custom cover must actually have an image behind it
ALTER TABLE gigs DROP CONSTRAINT IF EXISTS gigs_cover_custom_has_url;
ALTER TABLE gigs ADD CONSTRAINT gigs_cover_custom_has_url
  CHECK (cover_mode <> 'custom' OR cover_image_url IS NOT NULL);

-- ── Storage: public bucket for cover images ────────────────────────
-- Public read because covers appear on public gig pages that need to be
-- crawlable. Writes are scoped to the uploading hirer's own folder.
-- Path convention: <organizer_id>/<timestamp>-<filename>
INSERT INTO storage.buckets (id, name, public) VALUES ('gig-covers', 'gig-covers', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public reads gig covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gig-covers');

CREATE POLICY "Hirers upload own gig covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gig-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Hirers replace own gig covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gig-covers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Hirers delete own gig covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gig-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
