-- ════════════════════════════════════════════════════════════════
-- GigDekho — Verification tiers, Admin panel, Announcements,
-- Gig Q&A, Wallet, Taxonomy, Storage buckets.
-- Run this whole file in the Supabase SQL editor (or supabase db push).
-- ════════════════════════════════════════════════════════════════

-- ── 0. Profiles: verification tiers, admin, suspension ──────────────
-- (Columns must exist before we define is_admin() below — SQL-language
-- functions are validated against the schema at CREATE FUNCTION time.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_suspended boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS id_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_verified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS basics_certified boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS campus_ambassador boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_status text DEFAULT 'unknown'
  CHECK (student_status = ANY (ARRAY['unknown','not_student','student_unverified','student_verified']));

-- ── 1. Admin helper (SECURITY DEFINER avoids recursive RLS on profiles) ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
$$;

-- Level tiers: beginner/intermediate/pro/elite → bronze/silver/gold/platinum
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_worker_level_check;
UPDATE profiles SET worker_level = CASE worker_level
  WHEN 'beginner' THEN 'bronze'
  WHEN 'intermediate' THEN 'silver'
  WHEN 'pro' THEN 'gold'
  WHEN 'elite' THEN 'platinum'
  ELSE 'bronze' END;
ALTER TABLE profiles ALTER COLUMN worker_level SET DEFAULT 'bronze';
ALTER TABLE profiles ADD CONSTRAINT profiles_worker_level_check
  CHECK (worker_level = ANY (ARRAY['bronze','silver','gold','platinum']));

-- Bootstrap first admin
UPDATE profiles SET is_admin = true WHERE email = 'yashgopal2005@gmail.com';

-- Admins may update any profile (badges, suspension, verification flags)
CREATE POLICY "Admins update any profile"
  ON profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 2. Verification documents ──────────────────────────────────────
CREATE TABLE verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['aadhaar','student_id','gst','shop_license'])),
  file_path text NOT NULL,              -- storage object path, never a public URL
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  rejection_reason text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own documents or admin"
  ON verification_documents FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users submit own documents"
  ON verification_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins review documents"
  ON verification_documents FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 3. Admin audit log ──────────────────────────────────────────────
CREATE TABLE admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL,                 -- e.g. 'approve_document','reject_document','grant_badge','revoke_badge','suspend_user','unsuspend_user'
  target_user_id uuid REFERENCES profiles(id),
  target_document_id uuid REFERENCES verification_documents(id),
  detail text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON admin_actions FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins write audit log" ON admin_actions FOR INSERT WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- ── 4. In-app notifications ─────────────────────────────────────────
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL,                   -- 'announcement' | 'qa_question' | 'qa_reply' | 'system'
  title text NOT NULL,
  body text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, is_read, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Inserts are server-side only (service role)

-- ── 5. Gig announcements ────────────────────────────────────────────
CREATE TABLE gig_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id),
  organizer_id uuid NOT NULL REFERENCES profiles(id),
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'confirmed' CHECK (audience = ANY (ARRAY['confirmed','all_applicants'])),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gig_announcements ENABLE ROW LEVEL SECURITY;
-- Organizer + anyone who applied to the gig can read (visible in-thread)
CREATE POLICY "Gig participants read announcements"
  ON gig_announcements FOR SELECT
  USING (
    auth.uid() = organizer_id
    OR EXISTS (SELECT 1 FROM applications a WHERE a.gig_id = gig_announcements.gig_id AND a.worker_id = auth.uid())
  );
-- Inserts are server-side only (validated in /api/announce)

-- ── 6. Gig Q&A thread ───────────────────────────────────────────────
CREATE TABLE gig_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id),
  author_id uuid NOT NULL REFERENCES profiles(id),
  parent_id uuid REFERENCES gig_questions(id),  -- null = question, set = reply
  body text NOT NULL CHECK (
    char_length(body) BETWEEN 1 AND 1000
    -- Defense-in-depth: block obvious contact info at the DB layer too
    AND body !~* '[0-9][0-9 \-\.]{8,}[0-9]'          -- 10+ digit phone-like sequences
    AND body !~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'  -- emails
  ),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX gig_questions_gig_idx ON gig_questions (gig_id, created_at);
ALTER TABLE gig_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gig participants read QA"
  ON gig_questions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM gigs g WHERE g.id = gig_id AND g.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM applications a WHERE a.gig_id = gig_questions.gig_id AND a.worker_id = auth.uid())
  );
-- Inserts are server-side only (validated + contact-filtered in /api/qa)

-- ── 7. Wallet: bank accounts + settings; extend transactions ───────
CREATE TABLE worker_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL UNIQUE REFERENCES profiles(id),
  account_number text NOT NULL,
  ifsc text NOT NULL,
  account_holder text,
  penny_drop_status text NOT NULL DEFAULT 'unverified'
    CHECK (penny_drop_status = ANY (ARRAY['unverified','pending','verified','failed'])),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE worker_bank_accounts ENABLE ROW LEVEL SECURITY;
-- Owner-only read. Writes happen server-side only so account numbers are validated.
CREATE POLICY "Workers read own bank account"
  ON worker_bank_accounts FOR SELECT
  USING (auth.uid() = worker_id);

-- Configurable settings (min withdrawal etc.) — readable by all, admin-writable
CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON app_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins insert settings" ON app_settings FOR INSERT WITH CHECK (public.is_admin());
INSERT INTO app_settings (key, value) VALUES ('min_withdrawal_amount', '100')
  ON CONFLICT (key) DO NOTHING;

-- Allow future in-platform spending without a schema rebuild
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY['gig_earning','withdrawal','bonus','refund','penalty_deduction','platform_spend']));

-- ── 8. Storage buckets ──────────────────────────────────────────────
-- Private bucket for verification documents (path convention: <user_id>/<doc_type>-<ts>.<ext>)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Users upload own verification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner or admin reads verification docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification-docs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- Public bucket for avatars (path convention: <user_id>/avatar.<ext>)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public reads avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users replace own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 9. Skill / category taxonomy ────────────────────────────────────
-- Deactivate everything, then upsert the new structured taxonomy.
UPDATE skill_categories SET is_active = false;

INSERT INTO skill_categories (name, emoji, category_group, is_active) VALUES
  -- Events & Celebrations Staffing
  ('Waitstaff', '🍽️', 'Events & Celebrations Staffing', true),
  ('Event Helper/Coordinator', '📋', 'Events & Celebrations Staffing', true),
  ('Usher/Host', '🙋', 'Events & Celebrations Staffing', true),
  ('Security', '🛡️', 'Events & Celebrations Staffing', true),
  ('Bartender', '🍸', 'Events & Celebrations Staffing', true),
  ('Setup Crew', '🔧', 'Events & Celebrations Staffing', true),
  ('Cleanup Crew', '🧹', 'Events & Celebrations Staffing', true),
  -- Celebrations Content & Add-ons
  ('Event Photographer', '📸', 'Celebrations Content & Add-ons', true),
  ('Reel Shooter/Videographer', '🎥', 'Celebrations Content & Add-ons', true),
  ('Surprise Setup Specialist', '🎈', 'Celebrations Content & Add-ons', true),
  ('Gifting Coordinator', '🎁', 'Celebrations Content & Add-ons', true),
  -- Promotions & Sales
  ('Brand Promoter', '📣', 'Promotions & Sales', true),
  ('Sales Person', '🤝', 'Promotions & Sales', true),
  ('Product Sampling Staff', '🛒', 'Promotions & Sales', true),
  ('Leaflet Distributor', '📄', 'Promotions & Sales', true),
  ('Field Verification Agent', '🕵️', 'Promotions & Sales', true),
  ('Data Collection Agent', '📊', 'Promotions & Sales', true),
  ('Telecaller', '📞', 'Promotions & Sales', true),
  -- Service & Hospitality
  ('Cooking/Kitchen Help', '🍳', 'Service & Hospitality', true),
  ('Catering Staff', '🥘', 'Service & Hospitality', true),
  ('Cleaning/Housekeeping', '🧼', 'Service & Hospitality', true),
  ('Customer Service', '💬', 'Service & Hospitality', true),
  ('Retail/Cashier', '🏪', 'Service & Hospitality', true),
  ('Salon/Beauty Assistant', '💇', 'Service & Hospitality', true),
  ('Laundry/Ironing', '👔', 'Service & Hospitality', true),
  ('Food Service', '🍛', 'Service & Hospitality', true),
  -- Office & Administrative
  ('Data Entry', '⌨️', 'Office & Administrative', true),
  ('Accounting Assistance', '🧾', 'Office & Administrative', true),
  ('Computer Skills/IT Support', '💻', 'Office & Administrative', true),
  ('Reception/Front Desk', '🛎️', 'Office & Administrative', true),
  -- Teaching & Tutoring
  ('Home Tutoring', '📚', 'Teaching & Tutoring', true),
  ('Subject-Specific Tutoring', '🎓', 'Teaching & Tutoring', true),
  ('Exam Invigilation', '📝', 'Teaching & Tutoring', true),
  -- Delivery & Driving
  ('Bike Rider', '🏍️', 'Delivery & Driving', true),
  ('Local Delivery', '📦', 'Delivery & Driving', true),
  ('Auto Driver', '🛺', 'Delivery & Driving', true),
  ('Part-Time Driver', '🚗', 'Delivery & Driving', true),
  ('Packing/Sorting/Loading', '🏗️', 'Delivery & Driving', true),
  -- Care & Household
  ('Babysitting/Childcare', '🧸', 'Care & Household', true),
  ('Personal Helper', '🤲', 'Care & Household', true),
  -- Volunteering
  ('Volunteer', '🙌', 'Volunteering', true),
  -- GigDekho Projects (own vertical)
  ('Web Development', '🌐', 'GigDekho Projects', true),
  ('Graphic Design', '🎨', 'GigDekho Projects', true),
  ('Video Editing', '🎬', 'GigDekho Projects', true),
  ('Content Writing', '✍️', 'GigDekho Projects', true),
  ('Social Media Management', '📱', 'GigDekho Projects', true),
  ('Professional Photography', '📷', 'GigDekho Projects', true),
  -- Artist Booking (own vertical)
  ('Singer', '🎤', 'Artist Booking', true),
  ('DJ', '🎧', 'Artist Booking', true),
  ('Live Band', '🎸', 'Artist Booking', true),
  ('Anchor/MC', '🎙️', 'Artist Booking', true),
  ('Dancer', '💃', 'Artist Booking', true),
  ('Magician', '🪄', 'Artist Booking', true),
  ('Comedian', '😂', 'Artist Booking', true)
ON CONFLICT (name) DO UPDATE
  SET emoji = EXCLUDED.emoji, category_group = EXCLUDED.category_group, is_active = true;
