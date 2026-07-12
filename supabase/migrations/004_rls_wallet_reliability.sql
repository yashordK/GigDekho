-- ══════════════════════════════════════════════════════
-- RLS for tables added after 002_rls_hardening:
--   reliability_events, wallet_transactions, withdrawal_requests
-- Plus: tighten the applications UPDATE policy with WITH CHECK.
-- Run via: supabase db push
-- ══════════════════════════════════════════════════════

ALTER TABLE reliability_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- ── reliability_events ────────────────────────────────────────
-- Written server-side only (service role); workers may read their own history.
CREATE POLICY "Workers read own reliability events"
  ON reliability_events FOR SELECT
  USING (auth.uid() = worker_id);

-- ── wallet_transactions ───────────────────────────────────────
-- Written server-side only; workers may read their own ledger.
CREATE POLICY "Workers read own wallet transactions"
  ON wallet_transactions FOR SELECT
  USING (auth.uid() = worker_id);

-- ── withdrawal_requests ───────────────────────────────────────
CREATE POLICY "Workers read own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (auth.uid() = worker_id);

CREATE POLICY "Workers create own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = worker_id AND amount > 0);

-- Status transitions (processing/completed/rejected) are server-side only.

-- ── applications: add WITH CHECK to the organizer UPDATE policy ──
-- Without WITH CHECK an organizer could rewrite worker_id/gig_id on rows
-- they can see. Restrict updated rows to still belong to their own gigs.
DROP POLICY IF EXISTS "Organizers update application status" ON applications;
CREATE POLICY "Organizers update application status"
  ON applications FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1)
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1)
  );
