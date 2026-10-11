-- ══════════════════════════════════════════════════════════════════
-- 028. A gig knows how many days it runs, so total pay is just arithmetic
-- ══════════════════════════════════════════════════════════════════
-- Total pay should be the two things a hirer actually agreed:
--
--   priced by the hour  ->  pay_rate x duration_hrs
--   priced by the day   ->  day_rate x number of days
--
-- The second was not computed that way. day_rate was folded into an hourly
-- pay_rate at the moment of saving (day_rate x days / hours) and every screen
-- multiplied that back out. So the stored price depended on a day count held
-- in React state, and when that count had not loaded yet the gig was written
-- with days = 1. "DeTaali Garba Mahotsav" went live advertising Rs 650 for
-- three days of work priced at Rs 650 a day — Rs 1,950.
--
-- The count now lives on the row, maintained by a trigger from the day rows
-- that define it, so the total can be read from the gig alone and no screen
-- has to know how to reconstruct it.

ALTER TABLE gigs
  ADD COLUMN IF NOT EXISTS day_count int NOT NULL DEFAULT 1
    CHECK (day_count >= 1);

-- ── Keep it true, from the rows that are the authority ────────────
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
  SET day_count = GREATEST((SELECT COUNT(*) FROM gig_days d WHERE d.gig_id = target), 1)
  WHERE g.id = target;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS gig_days_sync_count ON gig_days;
CREATE TRIGGER gig_days_sync_count
  AFTER INSERT OR DELETE ON gig_days
  FOR EACH ROW EXECUTE FUNCTION public.sync_gig_day_count();

-- ── Backfill every gig from its day rows ──────────────────────────
UPDATE gigs g
SET day_count = GREATEST(sub.n, 1)
FROM (SELECT gig_id, COUNT(*)::int AS n FROM gig_days GROUP BY gig_id) sub
WHERE g.id = sub.gig_id AND g.day_count <> GREATEST(sub.n, 1);

-- ── Repair the hourly mirror on day-priced gigs ───────────────────
-- pay_rate x duration_hrs is still read in places that have no idea a day
-- rate exists, so it has to agree with day_rate x day_count rather than
-- contradict it. Recomputed from the numbers that are actually true.
UPDATE gigs g
SET pay_rate = ROUND((g.day_rate * g.day_count / g.duration_hrs)::numeric, 2)
WHERE g.day_rate IS NOT NULL
  AND g.duration_hrs IS NOT NULL
  AND g.duration_hrs > 0
  AND ROUND((g.pay_rate * g.duration_hrs)::numeric) <> ROUND((g.day_rate * g.day_count)::numeric);
