-- Paying people: UPI as a first-class payout method.
--
-- What this changes:
--
--   1. Withdrawals demand a bank account with an IFSC. Most of the workers are
--      students who have a UPI ID and would rather not type an account number
--      off a passbook. UPI is how they actually get paid, so it becomes a real
--      option rather than a note in the roadmap.
--
--   2. gig_attendance's write policy names only is_admin(). Verified against the
--      live database: the service role bypasses RLS, so this is not currently
--      blocking anything — unlike 018, where the fault was in a *trigger*, which
--      runs even for a role that bypasses RLS. The policy is widened anyway so
--      it states what is actually allowed instead of implying the server has no
--      access, and so it keeps working if BYPASSRLS is ever revoked.

-- ══════════════════════════════════════════════════════════════════
-- 1. SAY OUT LOUD THAT THE SERVER MAY WRITE ATTENDANCE
-- ══════════════════════════════════════════════════════════════════
-- Check-in and confirmation both run server-side so the two-sided rules live in
-- one place. Naming the service role here is documentation with teeth rather
-- than a fix for a live failure.

DROP POLICY IF EXISTS "Admins write attendance" ON gig_attendance;
CREATE POLICY "Admins or server write attendance" ON gig_attendance
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Organizer or admin writes gig days" ON gig_days;
CREATE POLICY "Organizer, admin or server writes gig days" ON gig_days
  FOR ALL
  USING (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM gigs g WHERE g.id = gig_days.gig_id AND g.organizer_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin()
    OR auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM gigs g WHERE g.id = gig_days.gig_id AND g.organizer_id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════════════
-- 1b. THE COLUMN 013 NEVER ACTUALLY CREATED
-- ══════════════════════════════════════════════════════════════════
-- 013 declared punctuality inside CREATE TABLE IF NOT EXISTS gig_attendance,
-- but that migration aborted partway through its first run and was re-run after
-- editing. By then the table existed, so IF NOT EXISTS skipped it and every
-- column added to that definition afterwards was silently dropped on the floor.
-- Verified against the live database: the table has fourteen of its fifteen
-- columns, and confirming a day with a punctuality value fails outright.
--
-- The lesson for later migrations: CREATE TABLE IF NOT EXISTS is not a way to
-- change a table. Columns need their own ADD COLUMN IF NOT EXISTS.

ALTER TABLE gig_attendance
  ADD COLUMN IF NOT EXISTS punctuality text
    CHECK (punctuality IS NULL OR punctuality = ANY (ARRAY['on_time','late']));

-- ══════════════════════════════════════════════════════════════════
-- 2. UPI PAYOUTS
-- ══════════════════════════════════════════════════════════════════
-- worker_bank_accounts becomes "where this worker gets paid", which may be a
-- bank account or a UPI ID. The table keeps its name so nothing that already
-- reads it breaks; the columns that only apply to bank transfers become
-- nullable, guarded by a CHECK so a row can never be half-filled.

ALTER TABLE worker_bank_accounts
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'bank'
    CHECK (method = ANY (ARRAY['bank','upi'])),
  ADD COLUMN IF NOT EXISTS upi_id text;

ALTER TABLE worker_bank_accounts ALTER COLUMN account_number DROP NOT NULL;
ALTER TABLE worker_bank_accounts ALTER COLUMN ifsc DROP NOT NULL;

-- Whichever method is chosen, its own fields must be present.
ALTER TABLE worker_bank_accounts DROP CONSTRAINT IF EXISTS payout_method_complete;
ALTER TABLE worker_bank_accounts ADD CONSTRAINT payout_method_complete CHECK (
  (method = 'bank' AND account_number IS NOT NULL AND ifsc IS NOT NULL)
  OR (method = 'upi' AND upi_id IS NOT NULL)
);

-- The worker owns this row and may change where their money goes. Writes still
-- go through /api/bank, which is what validates the format, but the policy no
-- longer silently blocks a legitimate update.
DROP POLICY IF EXISTS "Workers write own payout method" ON worker_bank_accounts;
CREATE POLICY "Workers write own payout method" ON worker_bank_accounts
  FOR ALL
  USING (auth.uid() = worker_id OR public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = worker_id OR public.is_admin() OR auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════
-- 3. WITHDRAWAL REQUESTS CARRY THE DESTINATION AND THE PROOF
-- ══════════════════════════════════════════════════════════════════
-- bank_account was a formatted string built at request time. Keeping the method
-- and a display-safe destination separately means the payouts screen can show
-- "UPI: name@bank" without re-deriving it, and payment_reference records the
-- UTR / UPI transaction ID so a "did you pay me?" question has an answer.

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'bank'
    CHECK (method = ANY (ARRAY['bank','upi'])),
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- ══════════════════════════════════════════════════════════════════
-- 4. SETTINGS
-- ══════════════════════════════════════════════════════════════════
INSERT INTO app_settings (key, value) VALUES
  -- How long after a gig day ends the worker can still check in, for the case
  -- where they were working and could not stop to open the app.
  ('attendance_late_checkin_hrs', '12')
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = '150' WHERE key = 'min_withdrawal_amount';
