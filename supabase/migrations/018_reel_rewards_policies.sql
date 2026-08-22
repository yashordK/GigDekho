-- Reel rewards: make the offer match what was agreed, and let workers actually
-- submit — which 013 forgot.

-- ══════════════════════════════════════════════════════════════════
-- 1. THE NUMBERS
-- ══════════════════════════════════════════════════════════════════
-- Agreed: ₹50 for posting a reel from a public account, plus ₹50 more if it
-- passes 3,000 views. 013 seeded ₹100 at 2,000, from the earlier version.

UPDATE app_settings SET value = '50'   WHERE key = 'reel_views_bonus';
UPDATE app_settings SET value = '3000' WHERE key = 'reel_views_threshold';

-- A reel on a private account can't be checked and can't do the job it is paid
-- for, so the worker confirms the account is public when submitting.
ALTER TABLE reel_submissions
  ADD COLUMN IF NOT EXISTS public_account_confirmed boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════════
-- 2. LET WORKERS SUBMIT
-- ══════════════════════════════════════════════════════════════════
-- 013 gave reel_submissions a SELECT policy for workers and a write policy for
-- admins, and nothing else — so every attempt to submit a reel failed with
-- "new row violates row-level security policy". The feature could not work at
-- all. Workers may now insert their own rows, for their own applications only.

DROP POLICY IF EXISTS "Workers submit own reels" ON reel_submissions;
CREATE POLICY "Workers submit own reels" ON reel_submissions
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = reel_submissions.application_id
        AND a.worker_id = auth.uid()
    )
  );

-- They also need to attach a views claim later. The guard below decides what
-- they are allowed to change.
DROP POLICY IF EXISTS "Workers update own reels" ON reel_submissions;
CREATE POLICY "Workers update own reels" ON reel_submissions
  FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════
-- 3. …BUT NOT APPROVE THEMSELVES
-- ══════════════════════════════════════════════════════════════════
-- An UPDATE policy can't restrict which columns change, and these rows decide
-- who gets paid. This freezes every field that represents a decision or a
-- payment, so a worker can only ever attach a claim and its proof.

CREATE OR REPLACE FUNCTION public.protect_reel_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Decisions and money stay exactly as they were.
  NEW.status            := OLD.status;
  NEW.review_note       := OLD.review_note;
  NEW.reviewed_by       := OLD.reviewed_by;
  NEW.reviewed_at       := OLD.reviewed_at;
  NEW.base_paid_at      := OLD.base_paid_at;
  NEW.views_reviewed_by := OLD.views_reviewed_by;
  NEW.views_reviewed_at := OLD.views_reviewed_at;
  NEW.views_paid_at     := OLD.views_paid_at;
  NEW.worker_id         := OLD.worker_id;
  NEW.gig_id            := OLD.gig_id;
  NEW.application_id    := OLD.application_id;

  -- A worker may move their views claim to 'pending', and nowhere else.
  IF NEW.views_status IS DISTINCT FROM OLD.views_status
     AND NEW.views_status <> 'pending' THEN
    NEW.views_status := OLD.views_status;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reel_submissions_protect_review ON reel_submissions;
CREATE TRIGGER reel_submissions_protect_review
  BEFORE UPDATE ON reel_submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_reel_review_fields();

-- Same idea on insert: nobody arrives pre-approved or pre-paid.
CREATE OR REPLACE FUNCTION public.force_reel_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.status        := 'pending';
  NEW.views_status  := 'none';
  NEW.base_paid_at  := NULL;
  NEW.views_paid_at := NULL;
  NEW.reviewed_by   := NULL;
  NEW.reviewed_at   := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reel_submissions_force_pending ON reel_submissions;
CREATE TRIGGER reel_submissions_force_pending
  BEFORE INSERT ON reel_submissions
  FOR EACH ROW EXECUTE FUNCTION public.force_reel_pending_on_insert();
