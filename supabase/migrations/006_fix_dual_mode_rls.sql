-- ══════════════════════════════════════════════════════════════════
-- Fix: "New row violates row-level security policy for table gigs"
--
-- Root cause: every "Switch to Hirer Mode" / "Switch to Worker Mode"
-- control in the app (TopNav, BottomNav, worker profile) only flips a
-- localStorage flag — it never updates profiles.role. But the INSERT
-- policies below required role = 'organizer' / 'worker' to match, so
-- posting a gig (or a direct client-side application insert) failed
-- for any account whose stored role differed from the view they
-- switched into. Since GigDekho is a dual-sided product where any
-- user can freely act as both a hirer and a worker, gating writes on
-- a single stored "role" is the wrong model — ownership checks
-- (auth.uid() = organizer_id / worker_id) are already the real
-- security boundary. Drop the role membership requirement.
--
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Organizers insert gigs" ON gigs;
CREATE POLICY "Organizers insert gigs"
  ON gigs FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Workers apply to gigs" ON applications;
CREATE POLICY "Workers apply to gigs"
  ON applications FOR INSERT
  WITH CHECK (
    auth.uid() = worker_id
    AND NOT EXISTS (
      SELECT 1 FROM applications a2
      WHERE a2.gig_id = applications.gig_id
        AND a2.worker_id = auth.uid()
    )
  );
