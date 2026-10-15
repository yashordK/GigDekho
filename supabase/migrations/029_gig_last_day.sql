-- ══════════════════════════════════════════════════════════════════
-- 029. A gig knows when it finishes, not just when it starts
-- ══════════════════════════════════════════════════════════════════
-- The worker feed hides anything whose event_date has passed. event_date is
-- the FIRST day, so a multi-day gig disappeared from the feed the morning
-- after it began — while it was still running and still short of people.
-- "Dholi Taara 5.0" runs the 9th to the 20th with twenty of its thirty seats
-- unfilled, and has been invisible since the 10th.
--
-- The last day is derived from the day rows, by the same trigger that keeps
-- day_count true, so the feed can ask the only question that matters: has
-- this finished yet?

ALTER TABLE gigs
  ADD COLUMN IF NOT EXISTS last_day_date date;

CREATE OR REPLACE FUNCTION public.sync_gig_day_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target uuid := COALESCE(NEW.gig_id, OLD.gig_id);
BEGIN
  UPDATE gigs g
  SET day_count    = GREATEST((SELECT COUNT(*) FROM gig_days d WHERE d.gig_id = target), 1),
      last_day_date = (SELECT MAX(d.day_date) FROM gig_days d WHERE d.gig_id = target)
  WHERE g.id = target;
  RETURN NULL;
END $$;

-- 028 created this to fire on INSERT and DELETE only, which was enough for a
-- count. A date can also be edited, and that moves the end of the gig without
-- changing how many days it has, so the trigger has to watch it too.
DROP TRIGGER IF EXISTS gig_days_sync_count ON gig_days;
CREATE TRIGGER gig_days_sync_count
  AFTER INSERT OR DELETE OR UPDATE OF day_date ON gig_days
  FOR EACH ROW EXECUTE FUNCTION public.sync_gig_day_count();

-- Backfill from the day rows where they exist, and fall back to the start
-- date for anything without them (internships, which have no day rows).
UPDATE gigs g
SET last_day_date = COALESCE(
  (SELECT MAX(d.day_date) FROM gig_days d WHERE d.gig_id = g.id),
  (g.event_date AT TIME ZONE 'Asia/Kolkata')::date
)
WHERE g.last_day_date IS DISTINCT FROM COALESCE(
  (SELECT MAX(d.day_date) FROM gig_days d WHERE d.gig_id = g.id),
  (g.event_date AT TIME ZONE 'Asia/Kolkata')::date
);
