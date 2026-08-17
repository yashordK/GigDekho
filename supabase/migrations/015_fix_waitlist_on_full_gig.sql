-- The waitlist could never be reached.
--
-- handle_new_application starts by rejecting any application to a gig whose
-- status isn't 'open'. But the same function sets a gig to 'filled' the moment
-- its last slot goes — so from the first full slot onward, every applicant hit
-- that guard and was written as 'rejected'. The waitlist branch below it was
-- unreachable in exactly the situation a waitlist exists for.
--
-- Observed directly: on a 1-slot gig, applicant #2 came back as
-- status='rejected', waitlist_position=null, while the API told them they
-- were waitlisted.
--
-- 'filled' now falls through to the waitlist. Genuinely closed gigs
-- (cancelled, completed) are still refused.

CREATE OR REPLACE FUNCTION public.handle_new_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  gig_record RECORD;
  waitlist_pos integer;
BEGIN
  SELECT slots_total, slots_filled, status
  INTO gig_record
  FROM gigs
  WHERE id = NEW.gig_id;

  -- Only genuinely closed gigs refuse applications. A full gig still takes
  -- people onto the waitlist.
  IF gig_record.status NOT IN ('open', 'filled') THEN
    NEW.status := 'rejected';
    RETURN NEW;
  END IF;

  IF gig_record.slots_filled < gig_record.slots_total THEN
    NEW.status := 'accepted';

    UPDATE gigs
    SET slots_filled = slots_filled + 1,
        status = CASE
          WHEN slots_filled + 1 >= slots_total THEN 'filled'
          ELSE 'open'
        END
    WHERE id = NEW.gig_id;

  ELSE
    -- Position among everyone already queued on this gig.
    SELECT COALESCE(MAX(waitlist_position), 0) + 1
    INTO waitlist_pos
    FROM applications
    WHERE gig_id = NEW.gig_id
      AND status = 'pending';

    NEW.status := 'pending';
    NEW.waitlist_position := waitlist_pos;
  END IF;

  RETURN NEW;
END;
$function$;

-- Anyone already turned away by the old guard is put back in the queue, in
-- the order they applied. Only rows that were never actually reviewed —
-- rejected with no waitlist position — are touched.
WITH restored AS (
  SELECT a.id,
         row_number() OVER (PARTITION BY a.gig_id ORDER BY a.applied_at) AS pos
  FROM applications a
  JOIN gigs g ON g.id = a.gig_id
  WHERE a.status = 'rejected'
    AND a.waitlist_position IS NULL
    AND g.status IN ('open', 'filled')
)
UPDATE applications a
SET status = 'pending',
    waitlist_position = r.pos
FROM restored r
WHERE a.id = r.id;
