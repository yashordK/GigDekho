-- ══════════════════════════════════════════════════════════════════
-- 026. Every event gig owns a day row, with the right capacity on it
-- ══════════════════════════════════════════════════════════════════
-- Capacity moved onto gig_days in 022, but only multi-day gigs were given
-- day rows when they were posted. A single-day gig got its row later and by
-- accident, from ensureGigDays() in the attendance code, which exists to make
-- a check-in possible and knows nothing about headcount. Two faults followed
-- from that, both live:
--
--   * No row at all until someone opened attendance. apply_to_gig reads the
--     gig's days to decide capacity and raises no_days_selected when there are
--     none, and /api/apply treats that as the applicant's fault — so a
--     single-day gig told people "Pick at least one day to work" when it had
--     no days to pick. Two open gigs were in this state.
--
--   * A row created with slots_needed defaulting to 1, whatever the gig
--     advertised. A gig calling for six people accepted one and waitlisted
--     the rest. 022's backfill had corrected the rows existing at the time,
--     which is why only gigs touched afterwards were wrong.
--
-- The fix is for the row to exist from the moment the gig does, so there is
-- one notion of capacity rather than one per code path.

-- ── 1. Give every event gig that is missing one a day row ──────────
-- event_date is stored UTC; the date and clock time that matter are Indore's,
-- so both are derived in IST — the same conversion ensureGigDays does.
INSERT INTO gig_days (gig_id, day_number, day_date, starts_at, ends_at, duration_hrs, slots_needed)
SELECT
  g.id,
  1,
  (g.event_date AT TIME ZONE 'Asia/Kolkata')::date,
  (g.event_date AT TIME ZONE 'Asia/Kolkata')::time,
  ((g.event_date AT TIME ZONE 'Asia/Kolkata')
     + make_interval(mins => (GREATEST(COALESCE(g.duration_hrs, 0), 0.5) * 60)::int))::time,
  GREATEST(COALESCE(g.duration_hrs, 0), 0.5),
  GREATEST(COALESCE(g.slots_total, 1), 1)
FROM gigs g
WHERE g.gig_type = 'event'
  AND g.event_date IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gig_days d WHERE d.gig_id = g.id);

-- ── 2. Repair capacity on single-day rows that defaulted to 1 ──────
-- Only single-day gigs: on a multi-day gig slots_needed is per day and is
-- meant to differ from the gig total, so it must not be touched.
UPDATE gig_days d
SET slots_needed = GREATEST(g.slots_total, 1)
FROM gigs g
WHERE d.gig_id = g.id
  AND g.gig_type = 'event'
  AND COALESCE(g.is_multi_day, false) = false
  AND d.slots_needed <> GREATEST(g.slots_total, 1)
  AND (SELECT COUNT(*) FROM gig_days x WHERE x.gig_id = g.id) = 1;

-- ── 3. Keep a single-day gig's day in step with its headcount ──────
-- Editing a single-day gig's openings has to move the capacity that is now
-- actually enforced, otherwise the two drift apart again the first time a
-- hirer changes the number.
CREATE OR REPLACE FUNCTION public.sync_single_day_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.gig_type <> 'event' OR COALESCE(NEW.is_multi_day, false) THEN
    RETURN NULL;
  END IF;
  UPDATE gig_days d
  SET slots_needed = GREATEST(NEW.slots_total, 1)
  WHERE d.gig_id = NEW.id
    AND (SELECT COUNT(*) FROM gig_days x WHERE x.gig_id = NEW.id) = 1;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS gigs_sync_single_day_slots ON gigs;
CREATE TRIGGER gigs_sync_single_day_slots
  AFTER UPDATE OF slots_total ON gigs
  FOR EACH ROW EXECUTE FUNCTION public.sync_single_day_slots();
