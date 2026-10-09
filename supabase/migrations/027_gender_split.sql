-- ══════════════════════════════════════════════════════════════════
-- 027. Who applied, and — when the hirer asks for it — a split by gender
-- ══════════════════════════════════════════════════════════════════
-- Events are often staffed to a mix: so many men on security and setup, so
-- many women on registration and hosting. Today a hirer cannot express that,
-- and because applying is first-come-first-served and accepts automatically,
-- a gig needing ten men and five women fills with whoever applies first.
--
-- Two separate things are added, and the second is optional:
--
--   * gender on the profile, so applicants can be counted.
--   * a per-day split on gig_days. Leave it null and the day behaves exactly
--     as it does now — one pool, no restriction, counts shown for interest
--     only. Set it and that day's seats are reserved per gender.

-- ── 1. Gender on the profile ───────────────────────────────────────
-- Nullable: the 60 existing workers have not been asked yet, and a worker who
-- would rather not say is recorded as 'undisclosed' rather than being forced
-- into a bucket. Null means "never asked", which is a different thing and is
-- what the prompts key off.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'undisclosed'));

-- ── 2. The optional split, per day ─────────────────────────────────
-- Per day rather than per gig because capacity already lives per day, and a
-- multi-day event genuinely varies: the setup day wants four men, the show
-- day wants six women on the front desk.
ALTER TABLE gig_days
  ADD COLUMN IF NOT EXISTS slots_male int CHECK (slots_male IS NULL OR slots_male >= 0),
  ADD COLUMN IF NOT EXISTS slots_female int CHECK (slots_female IS NULL OR slots_female >= 0);

COMMENT ON COLUMN gig_days.slots_male IS
  'Seats reserved for male applicants on this day. NULL means no split: the day is one pool of slots_needed.';
COMMENT ON COLUMN gig_days.slots_female IS
  'Seats reserved for female applicants on this day. NULL means no split.';

-- ── 3. Fill counts, now broken out by gender ───────────────────────
-- Still derived by counting rows, never stored, for the reason 022 gives: a
-- stored counter drifts the moment any path changes a status without updating
-- it. The per-gender columns follow the same rule.
-- Dropped rather than replaced: CREATE OR REPLACE VIEW can only append columns
-- at the end, and the gender columns belong beside the ones they qualify.
DROP VIEW IF EXISTS public.gig_day_fill;

CREATE VIEW public.gig_day_fill AS
SELECT
  d.id                AS gig_day_id,
  d.gig_id,
  d.day_number,
  d.day_date,
  d.slots_needed,
  d.slots_male,
  d.slots_female,
  COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int AS slots_filled,
  GREATEST(d.slots_needed - COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int, 0) AS slots_left,
  COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed') AND p.gender = 'male')::int   AS filled_male,
  COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed') AND p.gender = 'female')::int AS filled_female,
  -- Anyone accepted who declined to say, or was never asked. They occupy a
  -- seat in the overall count but cannot be placed in either reserved bucket,
  -- so they are surfaced rather than hidden in a total that would not add up.
  COUNT(ad.id) FILTER (
    WHERE a.status IN ('accepted','completed')
      AND (p.gender IS NULL OR p.gender = 'undisclosed')
  )::int AS filled_unstated
FROM gig_days d
LEFT JOIN application_days ad ON ad.gig_day_id = d.id
LEFT JOIN applications a ON a.id = ad.application_id
LEFT JOIN profiles p ON p.id = a.worker_id
GROUP BY d.id, d.gig_id, d.day_number, d.day_date, d.slots_needed, d.slots_male, d.slots_female;

-- ── 4. Everyone who applied, split by gender, for the hirer and admin ──
-- Counts every live application, not just the accepted ones, because the
-- question being asked is "who have I got to choose from".
CREATE OR REPLACE VIEW public.gig_applicant_gender AS
SELECT
  g.id AS gig_id,
  COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled','rejected'))::int AS applicants,
  COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled','rejected') AND p.gender = 'male')::int   AS applicants_male,
  COUNT(a.id) FILTER (WHERE a.status NOT IN ('cancelled','rejected') AND p.gender = 'female')::int AS applicants_female,
  COUNT(a.id) FILTER (
    WHERE a.status NOT IN ('cancelled','rejected')
      AND (p.gender IS NULL OR p.gender = 'undisclosed')
  )::int AS applicants_unstated,
  COUNT(a.id) FILTER (WHERE a.status IN ('accepted','completed') AND p.gender = 'male')::int   AS accepted_male,
  COUNT(a.id) FILTER (WHERE a.status IN ('accepted','completed') AND p.gender = 'female')::int AS accepted_female
FROM gigs g
LEFT JOIN applications a ON a.gig_id = g.id
LEFT JOIN profiles p ON p.id = a.worker_id
GROUP BY g.id;

GRANT SELECT ON public.gig_applicant_gender TO anon, authenticated;

-- ── 5. Applying, with the split enforced only where it is set ──────
-- The OUT parameters keep their out_ prefix for the reason 024 spells out:
-- every result column of a RETURNS TABLE function is also a variable inside
-- it, and this function has been taken down twice by a name that was also a
-- column. Nothing in the schema begins with out_.
DROP FUNCTION IF EXISTS public.apply_to_gig(uuid, uuid, uuid[]);

CREATE FUNCTION public.apply_to_gig(
  p_gig_id uuid,
  p_worker_id uuid,
  p_day_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  out_application_id uuid,
  out_status text,
  out_waitlist_position int,
  out_full_days int[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig_status text;
  v_mode text;
  v_min_days int;
  v_days uuid[];
  v_full int[];
  v_app_id uuid;
  v_status text;
  v_pos int;
  v_gender text;
BEGIN
  SELECT g.status, g.commitment_mode, g.min_days
  INTO v_gig_status, v_mode, v_min_days
  FROM gigs g
  WHERE g.id = p_gig_id;

  IF v_gig_status IS NULL THEN
    RAISE EXCEPTION 'gig_not_found';
  END IF;
  IF v_gig_status NOT IN ('open','filled') THEN
    RAISE EXCEPTION 'gig_closed';
  END IF;

  SELECT p.gender INTO v_gender FROM profiles p WHERE p.id = p_worker_id;

  -- Lock the gig row so two people applying in the same moment cannot both
  -- read the last free slot as available.
  PERFORM 1 FROM gigs g WHERE g.id = p_gig_id FOR UPDATE;

  IF v_mode = 'all_days' OR p_day_ids IS NULL OR array_length(p_day_ids, 1) IS NULL THEN
    SELECT array_agg(d.id ORDER BY d.day_number) INTO v_days
    FROM gig_days d WHERE d.gig_id = p_gig_id;
  ELSE
    SELECT array_agg(d.id ORDER BY d.day_number) INTO v_days
    FROM gig_days d WHERE d.gig_id = p_gig_id AND d.id = ANY(p_day_ids);
  END IF;

  IF v_days IS NULL OR array_length(v_days, 1) IS NULL THEN
    RAISE EXCEPTION 'no_days_selected';
  END IF;

  IF v_mode = 'pick_days'
     AND v_min_days IS NOT NULL
     AND array_length(v_days, 1) < v_min_days THEN
    RAISE EXCEPTION 'below_min_days:%', v_min_days;
  END IF;

  -- A day blocks the application when it is out of room. "Room" means the
  -- overall count when the day has no split, and this applicant's own bucket
  -- when it has one — so a gig still short of women does not turn a woman away
  -- because the men's seats are gone.
  SELECT array_agg(f.day_number ORDER BY f.day_number)
  INTO v_full
  FROM gig_day_fill f
  WHERE f.gig_day_id = ANY(v_days)
    AND (
      f.slots_left <= 0
      OR (v_gender = 'male'   AND f.slots_male   IS NOT NULL AND f.filled_male   >= f.slots_male)
      OR (v_gender = 'female' AND f.slots_female IS NOT NULL AND f.filled_female >= f.slots_female)
      -- Someone who has not said, applying to a day that is split: there is no
      -- bucket to put them in, so they wait for the hirer rather than silently
      -- consuming a seat reserved for one gender or the other.
      OR ((v_gender IS NULL OR v_gender = 'undisclosed')
          AND (f.slots_male IS NOT NULL OR f.slots_female IS NOT NULL))
    );

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
  ON CONFLICT (application_id, gig_day_id) DO NOTHING;

  RETURN QUERY SELECT v_app_id, v_status, v_pos, COALESCE(v_full, ARRAY[]::int[]);
END $$;

REVOKE ALL ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) TO service_role;
