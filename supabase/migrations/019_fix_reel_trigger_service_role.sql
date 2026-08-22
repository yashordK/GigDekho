-- The reel protection triggers blocked our own server.
--
-- 018 froze the review and payment fields for anyone who isn't an admin, but
-- checked only public.is_admin() — which reads auth.uid(), and auth.uid() is
-- NULL for the service role. So every server-side approval was silently
-- reverted: the wallet was credited, the notification sent, the audit line
-- written, and the submission stayed 'pending' with base_paid_at NULL. From
-- the reviewer's side the reel simply never left the queue, while the worker
-- had already been paid.
--
-- 010 already had this right for profiles: allow the service role explicitly.
-- These two were written without that clause.

CREATE OR REPLACE FUNCTION public.protect_reel_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Server-side code (service role) and admins may change anything.
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.force_reel_pending_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin() THEN
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
