-- Third time on the same fault, so this time it is made impossible.
--
-- apply_to_gig declares its result columns with RETURNS TABLE, which makes each
-- of those names a PL/pgSQL variable inside the function body. Every one of them
-- was also a real column name, so any unqualified reference was ambiguous:
--
--   022  `status`          collided with gigs.status          in the opening SELECT
--   023  `application_id`  collided with application_days.application_id
--                          in `ON CONFLICT (application_id, gig_day_id)`
--
-- 023 fixed the first by qualifying that one reference, which left the second
-- alive — and ON CONFLICT targets cannot be table-qualified at all, so there was
-- no way to qualify out of it.
--
-- Renaming the OUT parameters removes the whole class: none of out_* is a column
-- anywhere, so no reference in this function can be ambiguous again no matter
-- what gets added to it later. /api/apply reads the new names.

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

  -- Every chosen day has to have room; a partial acceptance would enrol
  -- someone for days they did not agree to work.
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
  ON CONFLICT (application_id, gig_day_id) DO NOTHING;

  RETURN QUERY SELECT v_app_id, v_status, v_pos, COALESCE(v_full, ARRAY[]::int[]);
END $$;

REVOKE ALL ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) TO service_role;
