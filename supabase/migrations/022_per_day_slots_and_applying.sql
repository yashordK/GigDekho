-- Multi-day gigs people can apply to a day at a time.
--
-- Today a gig is all-or-nothing, so someone free on days 1, 2 and 4 of a
-- five-day job does not apply at all and the hirer gets none of them. Days
-- become the unit that has slots and that a worker commits to, which grows the
-- pool rather than shrinking it — the same person now covers three days instead
-- of zero.
--
-- Two rules keep that from turning into patchy coverage, and both belong to the
-- hirer rather than to us: a gig defaults to requiring every day, and a gig that
-- allows picking can demand a minimum number of days.

-- ══════════════════════════════════════════════════════════════════
-- 1. HOW A GIG WANTS TO BE STAFFED
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gigs
  ADD COLUMN IF NOT EXISTS commitment_mode text NOT NULL DEFAULT 'all_days'
    CHECK (commitment_mode = ANY (ARRAY['all_days','pick_days'])),
  -- Only meaningful when commitment_mode = 'pick_days'. NULL means any subset.
  ADD COLUMN IF NOT EXISTS min_days int
    CHECK (min_days IS NULL OR min_days >= 1),
  -- Per person, per day. Multi-day pay has to compose: once two workers commit
  -- to different day-sets, one lump sum for "the gig" means different things to
  -- each of them and the arithmetic stops being explainable.
  ADD COLUMN IF NOT EXISTS day_rate numeric(10,2)
    CHECK (day_rate IS NULL OR day_rate >= 0);

-- ══════════════════════════════════════════════════════════════════
-- 2. SLOTS BELONG TO THE DAY
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE gig_days
  ADD COLUMN IF NOT EXISTS slots_needed int NOT NULL DEFAULT 1
    CHECK (slots_needed >= 1);

-- Existing gigs wanted the same headcount every day.
UPDATE gig_days d
SET slots_needed = GREATEST(g.slots_total, 1)
FROM gigs g
WHERE g.id = d.gig_id
  AND d.slots_needed = 1
  AND g.slots_total > 1;

-- ══════════════════════════════════════════════════════════════════
-- 3. WHICH DAYS A WORKER SIGNED UP FOR
-- ══════════════════════════════════════════════════════════════════
-- Separate from gig_attendance on purpose. This is the promise; attendance is
-- what actually happened. Keeping them apart is what lets the payout tell
-- "never signed up for that day" apart from "signed up and did not turn up",
-- which is the difference between owing nothing and owing a penalty.

CREATE TABLE IF NOT EXISTS application_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  gig_day_id uuid NOT NULL REFERENCES gig_days(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (application_id, gig_day_id)
);
CREATE INDEX IF NOT EXISTS application_days_app_idx ON application_days(application_id);
CREATE INDEX IF NOT EXISTS application_days_day_idx ON application_days(gig_day_id);

ALTER TABLE application_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or own-gig application days" ON application_days
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = application_days.application_id AND a.worker_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM gig_days d JOIN gigs g ON g.id = d.gig_id
      WHERE d.id = application_days.gig_day_id AND g.organizer_id = auth.uid()
    )
  );

-- Writes go through apply_to_gig() so capacity is checked in one place.
CREATE POLICY "Admins or server write application days" ON application_days
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Everyone who already applied committed to the whole gig, because that was
-- the only thing they could have meant.
INSERT INTO application_days (application_id, gig_day_id)
SELECT a.id, d.id
FROM applications a
JOIN gig_days d ON d.gig_id = a.gig_id
WHERE a.status <> 'cancelled'
ON CONFLICT (application_id, gig_day_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- 4. CAPACITY IS DERIVED, NEVER STORED
-- ══════════════════════════════════════════════════════════════════
-- gigs.slots_filled is a stored counter and it has already drifted: measured
-- against the live database, three of nine gigs disagreed with their own
-- applications, including one showing a filled slot for a gig with no accepted
-- applicants at all. It drifts because several code paths change an
-- application's status and only some of them remember to adjust the counter —
-- and the FCFS trigger then reads that number to decide accept vs waitlist, so
-- a phantom count can waitlist someone who should have been accepted.
--
-- Counting the rows cannot drift.

CREATE OR REPLACE VIEW public.gig_day_fill AS
SELECT
  d.id                AS gig_day_id,
  d.gig_id,
  d.day_number,
  d.day_date,
  d.slots_needed,
  COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int AS slots_filled,
  GREATEST(d.slots_needed - COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int, 0) AS slots_left
FROM gig_days d
LEFT JOIN application_days ad ON ad.gig_day_id = d.id
LEFT JOIN applications a ON a.id = ad.application_id
GROUP BY d.id, d.gig_id, d.day_number, d.day_date, d.slots_needed;

-- Bring the legacy counter back in line with reality, so the screens that still
-- read it stop lying while they are migrated.
UPDATE gigs g
SET slots_filled = sub.n
FROM (
  SELECT gig_id, COUNT(*)::int AS n
  FROM applications
  WHERE status IN ('accepted','completed')
  GROUP BY gig_id
) sub
WHERE g.id = sub.gig_id AND g.slots_filled <> sub.n;

UPDATE gigs g
SET slots_filled = 0
WHERE g.slots_filled <> 0
  AND NOT EXISTS (
    SELECT 1 FROM applications a
    WHERE a.gig_id = g.id AND a.status IN ('accepted','completed')
  );

-- And keep it in line from now on, whatever changes a status.
CREATE OR REPLACE FUNCTION public.sync_gig_slots_filled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target uuid := COALESCE(NEW.gig_id, OLD.gig_id);
BEGIN
  UPDATE gigs g
  SET slots_filled = (
        SELECT COUNT(*) FROM applications a
        WHERE a.gig_id = target AND a.status IN ('accepted','completed')
      )
  WHERE g.id = target;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS applications_sync_slots ON applications;
CREATE TRIGGER applications_sync_slots
  AFTER INSERT OR UPDATE OF status OR DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_gig_slots_filled();

-- ══════════════════════════════════════════════════════════════════
-- 5. APPLYING, ATOMICALLY, WITH DAYS
-- ══════════════════════════════════════════════════════════════════
-- The old BEFORE INSERT trigger decided accept-vs-waitlist from a gig-level
-- counter, before any day selection could exist. It cannot be made day-aware,
-- because the days arrive in a second statement. So the decision moves here,
-- into one function that sees the selection and the capacity together and runs
-- inside a single transaction.

-- Let the RPC opt out of the legacy trigger without dropping it, so any
-- straggler insert path still behaves the way it always did.
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
  IF COALESCE(current_setting('gigdekho.skip_fcfs', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT slots_total, slots_filled, status
  INTO gig_record
  FROM gigs
  WHERE id = NEW.gig_id;

  IF gig_record.status NOT IN ('open', 'filled') THEN
    NEW.status := 'rejected';
    RETURN NEW;
  END IF;

  IF gig_record.slots_filled < gig_record.slots_total THEN
    NEW.status := 'accepted';
  ELSE
    SELECT COALESCE(MAX(waitlist_position), 0) + 1
    INTO waitlist_pos
    FROM applications
    WHERE gig_id = NEW.gig_id AND status = 'pending';
    NEW.status := 'pending';
    NEW.waitlist_position := waitlist_pos;
  END IF;

  RETURN NEW;
END;
$function$;

/**
 * Apply to a gig for a specific set of days.
 *
 * Returns a row: (application_id, status, waitlist_position, full_days).
 * `full_days` names the day numbers that had no room, so the caller can tell
 * someone exactly which days to re-pick instead of a bare failure.
 *
 * A selection is accepted only when every chosen day has room. Partial
 * acceptance was rejected on purpose: it would quietly enrol someone for days
 * they did not agree to work, and the whole point of picking days is that the
 * commitment is explicit.
 */
CREATE OR REPLACE FUNCTION public.apply_to_gig(
  p_gig_id uuid,
  p_worker_id uuid,
  p_day_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (application_id uuid, status text, waitlist_position int, full_days int[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig RECORD;
  v_days uuid[];
  v_full int[];
  v_app_id uuid;
  v_status text;
  v_pos int;
BEGIN
  SELECT id, status, commitment_mode, min_days, event_date
  INTO v_gig
  FROM gigs WHERE id = p_gig_id;

  IF v_gig.id IS NULL THEN
    RAISE EXCEPTION 'gig_not_found';
  END IF;
  IF v_gig.status NOT IN ('open','filled') THEN
    RAISE EXCEPTION 'gig_closed';
  END IF;

  -- Lock the gig row so two people applying at the same moment cannot both
  -- read the last free slot as available.
  PERFORM 1 FROM gigs WHERE id = p_gig_id FOR UPDATE;

  -- Which days are being committed to.
  IF v_gig.commitment_mode = 'all_days' OR p_day_ids IS NULL OR array_length(p_day_ids, 1) IS NULL THEN
    SELECT array_agg(id ORDER BY day_number) INTO v_days FROM gig_days WHERE gig_id = p_gig_id;
  ELSE
    SELECT array_agg(id ORDER BY day_number) INTO v_days
    FROM gig_days WHERE gig_id = p_gig_id AND id = ANY(p_day_ids);
  END IF;

  IF v_days IS NULL OR array_length(v_days, 1) IS NULL THEN
    RAISE EXCEPTION 'no_days_selected';
  END IF;

  IF v_gig.commitment_mode = 'pick_days'
     AND v_gig.min_days IS NOT NULL
     AND array_length(v_days, 1) < v_gig.min_days THEN
    RAISE EXCEPTION 'below_min_days:%', v_gig.min_days;
  END IF;

  -- Any chosen day with no room left.
  SELECT array_agg(f.day_number ORDER BY f.day_number)
  INTO v_full
  FROM gig_day_fill f
  WHERE f.gig_day_id = ANY(v_days) AND f.slots_left <= 0;

  IF v_full IS NULL OR array_length(v_full, 1) IS NULL THEN
    v_status := 'accepted';
    v_pos := NULL;
  ELSE
    v_status := 'pending';
    SELECT COALESCE(MAX(a.waitlist_position), 0) + 1 INTO v_pos
    FROM applications a WHERE a.gig_id = p_gig_id AND a.status = 'pending';
  END IF;

  PERFORM set_config('gigdekho.skip_fcfs', 'on', true);

  INSERT INTO applications (gig_id, worker_id, status, waitlist_position, days_committed)
  VALUES (p_gig_id, p_worker_id, v_status, v_pos, array_length(v_days, 1))
  RETURNING id INTO v_app_id;

  PERFORM set_config('gigdekho.skip_fcfs', 'off', true);

  INSERT INTO application_days (application_id, gig_day_id)
  SELECT v_app_id, unnest(v_days)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_app_id, v_status, v_pos, COALESCE(v_full, ARRAY[]::int[]);
END $$;

REVOKE ALL ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) TO service_role;
