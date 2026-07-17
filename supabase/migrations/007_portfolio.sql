-- ══════════════════════════════════════════════════════════════════
-- Worker portfolio/resume: shareable links + uploaded files
-- (resume, proof of work, portfolio PDFs/images).
-- Also aligns min withdrawal with product copy (₹200).
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES profiles(id),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['link','file'])),
  url text NOT NULL,               -- external link, or public storage URL for files
  label text NOT NULL,             -- display name ("My design portfolio", "Resume")
  created_at timestamptz DEFAULT now()
);
CREATE INDEX portfolio_items_worker_idx ON portfolio_items (worker_id);
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Portfolios are meant to be seen by hirers — public read
CREATE POLICY "Public read portfolio items"
  ON portfolio_items FOR SELECT USING (true);
CREATE POLICY "Workers add own portfolio items"
  ON portfolio_items FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Workers delete own portfolio items"
  ON portfolio_items FOR DELETE USING (auth.uid() = worker_id);

-- Public bucket for portfolio files (path convention: <user_id>/<name>)
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolios', 'portfolios', true)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public reads portfolios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolios');
CREATE POLICY "Users upload own portfolio files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own portfolio files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Product copy says minimum withdrawal is ₹200
UPDATE app_settings SET value = '200', updated_at = now() WHERE key = 'min_withdrawal_amount';
