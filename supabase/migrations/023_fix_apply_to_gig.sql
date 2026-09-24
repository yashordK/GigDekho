-- Fixes apply_to_gig, which 022 shipped broken, and finishes 022's backfill.
--
-- The function raised `column reference "status" is ambiguous` on every call,
-- so nobody could apply to anything. RETURNS TABLE declares `status` as an OUT
-- parameter, and the function's first statement was
--
--     SELECT id, status, ... INTO v_gig FROM gigs WHERE id = p_gig_id;
--
-- where `status` matches both that OUT parameter and gigs.status. Postgres
-- refuses to guess. Every column reference below is qualified with its table
-- alias, which removes the ambiguity without renaming the output columns that
-- /api/apply reads.
--
-- 022 is also safe to re-run after this: its CREATE POLICY statements aborted a
-- second run because the policies already existed. Those are dropped first here.

-- ══════════════════════════════════════════════════════════════════
-- 1. MAKE 022's POLICIES RE-RUNNABLE
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Read own or own-gig application days" ON application_days;
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

DROP POLICY IF EXISTS "Admins or server write application days" ON application_days;
CREATE POLICY "Admins or server write application days" ON application_days
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════
-- 2. FINISH THE BACKFILL
-- ══════════════════════════════════════════════════════════════════
-- 022 inserted 13 of the 14 rows it should have; one application applied after
-- the migration ran and never got its day rows. Idempotent, so it simply does
-- nothing if it has already caught up.

INSERT INTO application_days (application_id, gig_day_id)
SELECT a.id, d.id
FROM applications a
JOIN gig_days d ON d.gig_id = a.gig_id
WHERE a.status <> 'cancelled'
ON CONFLICT (application_id, gig_day_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- 3. THE FUNCTION, WITH EVERY REFERENCE QUALIFIED
-- ══════════════════════════════════════════════════════════════════

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
  v_gig_status text;
  v_mode text;
  v_min_days int;
  v_days uuid[];
  v_full int[];
  v_app_id uuid;
  v_status text;
  v_pos int;
BEGIN
  -- Read into plain scalars rather than a record: a record field named `status`
  -- is exactly what collided with the OUT parameter before.
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

  INSERT INTO applications AS a (gig_id, worker_id, status, waitlist_position, days_committed)
  VALUES (p_gig_id, p_worker_id, v_status, v_pos, array_length(v_days, 1))
  RETURNING a.id INTO v_app_id;

  PERFORM set_config('gigdekho.skip_fcfs', 'off', true);

  INSERT INTO application_days (application_id, gig_day_id)
  SELECT v_app_id, unnest(v_days)
  ON CONFLICT (application_id, gig_day_id) DO NOTHING;

  RETURN QUERY SELECT v_app_id, v_status, v_pos, COALESCE(v_full, ARRAY[]::int[]);
END $$;

REVOKE ALL ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_to_gig(uuid, uuid, uuid[]) TO service_role;
