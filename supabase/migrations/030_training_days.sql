-- ══════════════════════════════════════════════════════════════════
-- 030. Tell a training session apart from a day of work
-- ══════════════════════════════════════════════════════════════════
-- "Dholi Taara 5.0" is listed as twelve days, but two of those were a
-- one-hour briefing to walk people through the setup, not a shift. Calling
-- the run twelve days overstates what a volunteer is signing up for.
--
-- The flag lives on the day, so the count is derived rather than typed. Two
-- separate numbers come out of it, and they are deliberately not the same:
--
--   day_count          every day the gig occupies. Pay is still day_rate x
--                      this, because the agreed total does not change just
--                      because one of the days is a briefing.
--   training_day_count  how many of those are training. Subtracted only for
--                      display, so a listing can say "10 days" honestly while
--                      still paying what was promised for the whole run.

ALTER TABLE gig_days
  ADD COLUMN IF NOT EXISTS is_training boolean NOT NULL DEFAULT false;

ALTER TABLE gigs
  ADD COLUMN IF NOT EXISTS training_day_count int NOT NULL DEFAULT 0
    CHECK (training_day_count >= 0);

COMMENT ON COLUMN gig_days.is_training IS
  'A briefing or walkthrough rather than a working shift. Counted in day_count (and so in pay) but shown separately.';

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
  SET day_count          = GREATEST((SELECT COUNT(*) FROM gig_days d WHERE d.gig_id = target), 1),
      training_day_count = (SELECT COUNT(*) FROM gig_days d WHERE d.gig_id = target AND d.is_training),
      last_day_date      = (SELECT MAX(d.day_date) FROM gig_days d WHERE d.gig_id = target)
  WHERE g.id = target;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS gig_days_sync_count ON gig_days;
CREATE TRIGGER gig_days_sync_count
  AFTER INSERT OR DELETE OR UPDATE OF day_date, is_training ON gig_days
  FOR EACH ROW EXECUTE FUNCTION public.sync_gig_day_count();

-- Refresh all three from the day rows, so this migration leaves the gigs
-- correct on its own rather than relying on an earlier one having run.
UPDATE gigs g
SET day_count          = GREATEST(sub.total, 1),
    training_day_count = sub.training,
    last_day_date      = sub.last_day
FROM (
  SELECT gig_id,
         COUNT(*)::int                                AS total,
         COUNT(*) FILTER (WHERE is_training)::int     AS training,
         MAX(day_date)                                AS last_day
  FROM gig_days GROUP BY gig_id
) sub
WHERE g.id = sub.gig_id
  AND (g.day_count <> GREATEST(sub.total, 1)
    OR g.training_day_count <> sub.training
    OR g.last_day_date IS DISTINCT FROM sub.last_day);
