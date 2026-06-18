-- ══════════════════════════════════════════════════════
-- GigDekho RLS Hardening — all 14 tables
-- Run via: supabase db push
-- ══════════════════════════════════════════════════════

-- Enable RLS on every table
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_skills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_samples      ENABLE ROW LEVEL SECURITY;
ALTER TABLE certifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_payouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_categories  ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────
CREATE POLICY "Public read profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── worker_skills ──────────────────────────────────────────────
CREATE POLICY "Public read worker skills"
  ON worker_skills FOR SELECT USING (true);

CREATE POLICY "Workers manage own skills"
  ON worker_skills FOR ALL
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- ── worker_documents ──────────────────────────────────────────
-- Documents are private — only the owner and no one else
CREATE POLICY "Workers read own documents"
  ON worker_documents FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Workers insert own documents"
  ON worker_documents FOR INSERT
  WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Workers delete own documents"
  ON worker_documents FOR DELETE
  USING (auth.uid() = worker_id);

-- ── gigs ──────────────────────────────────────────────────────
-- Unauthenticated users can read open gigs (needed for SEO / public pages)
CREATE POLICY "Public read open gigs"
  ON gigs FOR SELECT
  USING (status = 'open');

-- Organizers can read all their own gigs regardless of status
CREATE POLICY "Organizers read own gigs"
  ON gigs FOR SELECT
  USING (auth.uid() = organizer_id);

-- Only organizers can post gigs
CREATE POLICY "Organizers insert gigs"
  ON gigs FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'organizer'
    )
  );

CREATE POLICY "Organizers update own gigs"
  ON gigs FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers delete own gigs"
  ON gigs FOR DELETE
  USING (auth.uid() = organizer_id);

-- ── applications ──────────────────────────────────────────────
CREATE POLICY "Workers read own applications"
  ON applications FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Organizers read applications to their gigs"
  ON applications FOR SELECT
  USING (
    auth.uid() = (
      SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1
    )
  );

CREATE POLICY "Workers apply to gigs"
  ON applications FOR INSERT
  WITH CHECK (
    auth.uid() = worker_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'worker'
    )
    AND NOT EXISTS (
      SELECT 1 FROM applications a2
      WHERE a2.gig_id = applications.gig_id
        AND a2.worker_id = auth.uid()
    )
  );

-- Organizers update status (accept/reject); workers update for no_show/completed
CREATE POLICY "Organizers update application status"
  ON applications FOR UPDATE
  USING (
    auth.uid() = (
      SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1
    )
  );

-- ── attendance ────────────────────────────────────────────────
-- Workers read their own attendance record
CREATE POLICY "Workers read own attendance"
  ON attendance FOR SELECT
  USING (
    auth.uid() = (
      SELECT worker_id FROM applications WHERE id = application_id LIMIT 1
    )
  );

-- Organizers read attendance for their gigs
CREATE POLICY "Organizers read attendance for their gigs"
  ON attendance FOR SELECT
  USING (
    auth.uid() = (
      SELECT g.organizer_id FROM applications a
      JOIN gigs g ON g.id = a.gig_id
      WHERE a.id = application_id LIMIT 1
    )
  );

-- Attendance can be inserted by the system/organizer (QR/GPS check-in)
CREATE POLICY "Organizers manage attendance"
  ON attendance FOR ALL
  USING (
    auth.uid() = (
      SELECT g.organizer_id FROM applications a
      JOIN gigs g ON g.id = a.gig_id
      WHERE a.id = application_id LIMIT 1
    )
  );

-- ── transactions ──────────────────────────────────────────────
CREATE POLICY "Workers read own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = (
      SELECT worker_id FROM applications WHERE id = application_id LIMIT 1
    )
  );

CREATE POLICY "Organizers read transactions for their gigs"
  ON transactions FOR SELECT
  USING (
    auth.uid() = (
      SELECT g.organizer_id FROM applications a
      JOIN gigs g ON g.id = a.gig_id
      WHERE a.id = application_id LIMIT 1
    )
  );

-- Transactions are inserted server-side via Razorpay webhook only
-- No direct client INSERT policy — use service role in Edge Function

-- ── ratings ───────────────────────────────────────────────────
CREATE POLICY "Public read ratings"
  ON ratings FOR SELECT USING (true);

CREATE POLICY "Authenticated users insert ratings"
  ON ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id
    AND rater_id <> ratee_id
    AND EXISTS (
      SELECT 1 FROM applications
      WHERE id = ratings.application_id
        AND (worker_id = auth.uid() OR
             (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1) = auth.uid())
        AND status = 'completed'
    )
  );

-- ── artist_profiles ───────────────────────────────────────────
CREATE POLICY "Public read visible artist profiles"
  ON artist_profiles FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Artists read own profile"
  ON artist_profiles FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Artists manage own artist profile"
  ON artist_profiles FOR ALL
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- ── work_samples ──────────────────────────────────────────────
CREATE POLICY "Public read work samples"
  ON work_samples FOR SELECT USING (true);

CREATE POLICY "Artists manage own work samples"
  ON work_samples FOR ALL
  USING (
    auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  );

-- ── certifications ────────────────────────────────────────────
CREATE POLICY "Public read certifications"
  ON certifications FOR SELECT USING (true);

CREATE POLICY "Artists manage own certifications"
  ON certifications FOR ALL
  USING (
    auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  );

-- ── direct_bookings ───────────────────────────────────────────
CREATE POLICY "Bookers read own bookings"
  ON direct_bookings FOR SELECT
  USING (auth.uid() = booker_id);

CREATE POLICY "Artists read bookings for them"
  ON direct_bookings FOR SELECT
  USING (
    auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  );

CREATE POLICY "Authenticated users create bookings"
  ON direct_bookings FOR INSERT
  WITH CHECK (auth.uid() = booker_id);

CREATE POLICY "Bookers and artists update booking status"
  ON direct_bookings FOR UPDATE
  USING (
    auth.uid() = booker_id
    OR auth.uid() = (
      SELECT worker_id FROM artist_profiles WHERE id = artist_id LIMIT 1
    )
  );

-- ── gig_payments ──────────────────────────────────────────────
CREATE POLICY "Organizers read own gig payments"
  ON gig_payments FOR SELECT
  USING (auth.uid() = organizer_id);

-- Inserted server-side via Razorpay webhook / Edge Function only
-- No direct client INSERT policy

-- ── worker_payouts ────────────────────────────────────────────
CREATE POLICY "Workers read own payouts"
  ON worker_payouts FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Organizers read payouts for their gigs"
  ON worker_payouts FOR SELECT
  USING (
    auth.uid() = (
      SELECT organizer_id FROM gig_payments WHERE id = gig_payment_id LIMIT 1
    )
  );

-- Inserted/updated server-side only — no client INSERT policy

-- ── skill_categories ──────────────────────────────────────────
-- Fully public read-only lookup table
CREATE POLICY "Public read skill categories"
  ON skill_categories FOR SELECT USING (true);

-- Only admins should insert/update — done via Supabase dashboard or service role
-- No client-facing write policy
