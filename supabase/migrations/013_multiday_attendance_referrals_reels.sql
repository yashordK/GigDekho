-- Multi-day gigs, two-sided attendance, referrals, and reel incentives.
--
-- Everything here exists because payouts have to be able to answer "did this
-- person actually turn up, on which days". Referral and reel money both hang
-- off that answer, so the attendance tables come first and the money tables
-- reference them.

-- ══════════════════════════════════════════════════════════════════
-- 1. MULTI-DAY GIGS
-- ══════════════════════════════════════════════════════════════════
-- A gig used to be a single event_date plus a flat duration_hrs, so a
-- three-day job was stored as one date and 20 hours with nowhere to record
-- day 2. Days live in their own table; single-day gigs simply get one row,
-- which keeps one code path for both.

ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_multi_day boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS gig_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  day_number int NOT NULL CHECK (day_number >= 1),
  day_date date NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  -- Denormalised so payout maths never has to re-derive it from times that
  -- may cross midnight.
  duration_hrs numeric(5,2) NOT NULL CHECK (duration_hrs > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE (gig_id, day_number)
);
CREATE INDEX IF NOT EXISTS gig_days_gig_idx ON gig_days(gig_id);
CREATE INDEX IF NOT EXISTS gig_days_date_idx ON gig_days(day_date);

ALTER TABLE gig_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads gig days" ON gig_days
  FOR SELECT USING (true);
CREATE POLICY "Organizer or admin writes gig days" ON gig_days
  FOR ALL
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM gigs g WHERE g.id = gig_days.gig_id AND g.organizer_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM gigs g WHERE g.id = gig_days.gig_id AND g.organizer_id = auth.uid())
  );

-- Backfill: every existing gig becomes a one-day gig so nothing is orphaned.
INSERT INTO gig_days (gig_id, day_number, day_date, starts_at, ends_at, duration_hrs)
SELECT g.id, 1, (g.event_date AT TIME ZONE 'Asia/Kolkata')::date,
       (g.event_date AT TIME ZONE 'Asia/Kolkata')::time,
       -- minutes, not hours: make_interval's hours argument is an integer and
       -- duration_hrs is fractional, so half-hour gigs would have been
       -- rejected outright.
       ((g.event_date AT TIME ZONE 'Asia/Kolkata')
         + make_interval(mins => (COALESCE(g.duration_hrs, 0) * 60)::int))::time,
       GREATEST(COALESCE(g.duration_hrs, 0), 0.5)
FROM gigs g
WHERE g.gig_type = 'event'
  AND NOT EXISTS (SELECT 1 FROM gig_days d WHERE d.gig_id = g.id);

-- ══════════════════════════════════════════════════════════════════
-- 2. TWO-SIDED, PER-DAY ATTENDANCE
-- ══════════════════════════════════════════════════════════════════
-- The old `attendance` table was never written to by any code path. This
-- replaces it with one row per worker per day, recording both sides: the
-- worker says they are at the venue, then the hirer (or an admin) confirms.
-- Nothing pays out on the worker's word alone.

DROP TABLE IF EXISTS attendance;

CREATE TABLE IF NOT EXISTS gig_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gig_day_id uuid NOT NULL REFERENCES gig_days(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- worker side
  worker_marked_at timestamptz,
  worker_selfie_url text,

  -- hirer/admin side
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  checked_out_at timestamptz,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','worker_marked','confirmed','disputed','absent','excused'])),

  -- raised when the worker marked in but nobody confirmed
  dispute_note text,
  dispute_raised_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,

  created_at timestamptz DEFAULT now(),
  UNIQUE (application_id, gig_day_id)
);
CREATE INDEX IF NOT EXISTS gig_attendance_app_idx ON gig_attendance(application_id);
CREATE INDEX IF NOT EXISTS gig_attendance_worker_idx ON gig_attendance(worker_id);
CREATE INDEX IF NOT EXISTS gig_attendance_status_idx ON gig_attendance(status);

ALTER TABLE gig_attendance ENABLE ROW LEVEL SECURITY;

-- The worker sees their own; the gig's organizer sees their gig's; admins see all.
CREATE POLICY "Read own or own-gig attendance" ON gig_attendance
  FOR SELECT USING (
    public.is_admin()
    OR worker_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM gig_days d JOIN gigs g ON g.id = d.gig_id
      WHERE d.id = gig_attendance.gig_day_id AND g.organizer_id = auth.uid()
    )
  );

-- Writes go through the server (service role) so the two-sided rules and the
-- 1-hour check-in window are enforced in one place, not re-implemented in RLS.
CREATE POLICY "Admins write attendance" ON gig_attendance
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Selfie proof lives in a private bucket — it is a photo of a person.
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-proof', 'attendance-proof', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Workers upload own attendance proof"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attendance-proof' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner or admin reads attendance proof"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attendance-proof'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- ══════════════════════════════════════════════════════════════════
-- 3. LATE-CANCELLATION PENALTY
-- ══════════════════════════════════════════════════════════════════
-- Dropping a day with less than two days' notice costs ₹100, taken out of
-- what they earned on the days they did work.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS days_committed int;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS days_attended int NOT NULL DEFAULT 0;

INSERT INTO app_settings (key, value) VALUES
  ('late_cancel_notice_days', '2'),
  ('late_cancel_penalty', '100'),
  ('attendance_checkin_window_mins', '60')
ON CONFLICT (key) DO NOTHING;

-- Agreed floor is ₹150; the seeded value was 100 and the FAQ said 200.
UPDATE app_settings SET value = '150' WHERE key = 'min_withdrawal_amount';

-- ══════════════════════════════════════════════════════════════════
-- 4. REFERRALS
-- ══════════════════════════════════════════════════════════════════
-- ₹50 to each side, paid when the referred person completes their first gig.
-- Capped at 4 successful referrals per referrer per calendar month.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Short, unambiguous codes — no O/0/I/1 to survive being read aloud.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END $$;

UPDATE profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON profiles;
CREATE TRIGGER profiles_set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_used text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','qualified','paid','rejected'])),
  -- the gig that earned it, so a payout can always be traced back
  qualifying_application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  qualified_at timestamptz,
  paid_at timestamptz,
  -- which month this counts against, for the cap of 4
  counted_month date,
  created_at timestamptz DEFAULT now(),
  UNIQUE (referred_id)          -- a person can only ever be referred once
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referrals(status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See referrals you are part of" ON referrals
  FOR SELECT USING (public.is_admin() OR referrer_id = auth.uid() OR referred_id = auth.uid());
CREATE POLICY "Admins write referrals" ON referrals
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO app_settings (key, value) VALUES
  ('referral_bonus_amount', '50'),
  ('referral_monthly_cap', '4')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- 5. REEL INCENTIVES
-- ══════════════════════════════════════════════════════════════════
-- ₹50 per approved reel, at most two per gig, plus ₹100 once per gig if a
-- reel passes 2k views. View counts are checked by a human against an
-- uploaded screenshot — there is no lawful way to read a public reel's view
-- count automatically.

CREATE TABLE IF NOT EXISTS reel_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,

  reel_url text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram'
    CHECK (platform = ANY (ARRAY['instagram','youtube','facebook','other'])),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  review_note text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  base_paid_at timestamptz,

  -- the 2k-views claim, reviewed separately from the reel itself
  views_claimed boolean NOT NULL DEFAULT false,
  views_proof_url text,
  views_status text NOT NULL DEFAULT 'none'
    CHECK (views_status = ANY (ARRAY['none','pending','approved','rejected'])),
  views_reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  views_reviewed_at timestamptz,
  views_paid_at timestamptz,

  created_at timestamptz DEFAULT now(),
  UNIQUE (application_id, reel_url)
);
CREATE INDEX IF NOT EXISTS reel_worker_idx ON reel_submissions(worker_id);
CREATE INDEX IF NOT EXISTS reel_status_idx ON reel_submissions(status);
CREATE INDEX IF NOT EXISTS reel_views_status_idx ON reel_submissions(views_status);

ALTER TABLE reel_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workers see own reels" ON reel_submissions
  FOR SELECT USING (public.is_admin() OR worker_id = auth.uid());
CREATE POLICY "Admins write reels" ON reel_submissions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('reel-proof', 'reel-proof', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Workers upload own reel proof"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reel-proof' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner or admin reads reel proof"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reel-proof'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

INSERT INTO app_settings (key, value) VALUES
  ('reel_bonus_per_reel', '50'),
  ('reel_bonus_max_per_gig', '100'),
  ('reel_views_bonus', '100'),
  ('reel_views_threshold', '2000')
ON CONFLICT (key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- 6. WALLET TRANSACTION TYPES
-- ══════════════════════════════════════════════════════════════════
-- Referral and reel money needs to be separable from gig earnings in
-- reporting, so they get their own types rather than riding on 'bonus'.

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'gig_earning','withdrawal','bonus','refund','penalty_deduction','platform_spend',
    'referral_bonus','reel_bonus','reel_views_bonus'
  ]));
