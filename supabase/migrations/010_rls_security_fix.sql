-- ══════════════════════════════════════════════════════════════════
-- 🔴 SECURITY FIX — run this before anything else.
--
-- A live audit (authenticating as a real user and attempting writes)
-- found that the write policies on several tables had become permissive
-- enough to allow impersonation and privilege escalation:
--
--   • any signed-in user could INSERT a gig attributed to another hirer
--   • any signed-in user could UPDATE another hirer's listing
--   • any signed-in user could UPDATE another user's profile
--   • any signed-in user could set is_admin = true on any profile
--     → full takeover of the admin portal
--   • any signed-in user could forge rows in gig_payments
--
-- It also found that the applications INSERT policy self-references the
-- applications table, which Postgres rejects with 42P17 (infinite
-- recursion) — client-side applying was broken; only the service-role
-- API route worked.
--
-- This migration drops every INSERT/UPDATE policy on the affected tables
-- (by name lookup, so policies added ad-hoc are caught too) and rebuilds
-- them correctly, then adds a trigger that freezes privileged columns as
-- defence in depth even if a policy is ever loosened again.
--
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

-- ── 0. Drop every existing INSERT/UPDATE policy on the affected tables ──
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'gigs', 'applications', 'gig_payments', 'worker_payouts')
      AND cmd IN ('INSERT', 'UPDATE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'dropped policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- Make sure RLS is actually on (a disabled table ignores policies entirely)
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_payouts ENABLE ROW LEVEL SECURITY;

-- ── 1. profiles ────────────────────────────────────────────────────
CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins update any profile"
  ON profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 2. gigs ────────────────────────────────────────────────────────
CREATE POLICY "Organizers insert own gigs"
  ON gigs FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

-- Lets the team post on behalf of a managed account (audited in admin_actions)
CREATE POLICY "Admins insert gigs on behalf"
  ON gigs FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Organizers update own gigs"
  ON gigs FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Admins update any gig"
  ON gigs FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 3. applications ────────────────────────────────────────────────
-- The old policy did `NOT EXISTS (SELECT 1 FROM applications …)` inside a
-- policy ON applications, which Postgres rejects as infinite recursion.
-- Duplicate protection belongs in the application layer / a unique index,
-- not in RLS. /api/apply already checks for an existing application.
CREATE POLICY "Workers apply to gigs"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Organizers update applications to their gigs"
  ON applications FOR UPDATE
  USING (auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1))
  WITH CHECK (auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1));

-- Workers may cancel their own application (status changes are validated
-- server-side in /api/cancel, which uses the service role)
CREATE POLICY "Workers update own applications"
  ON applications FOR UPDATE
  USING (auth.uid() = worker_id)
  WITH CHECK (auth.uid() = worker_id);

-- ── 4. Money tables: server-side writes only ───────────────────────
-- No INSERT/UPDATE policies at all. /api/pay and /api/withdraw use the
-- service role, which bypasses RLS, so nothing legitimate breaks — but a
-- browser can no longer forge a payment or a payout.
-- (SELECT policies from migration 002 are left untouched.)

-- ── 5. Defence in depth: freeze privileged profile columns ─────────
-- Even if a policy is ever loosened again, a normal user cannot grant
-- themselves admin, un-suspend themselves, or self-award trust badges.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side code (service role) and admins may change anything
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.is_admin          := OLD.is_admin;
  NEW.is_suspended      := OLD.is_suspended;
  NEW.id_verified       := OLD.id_verified;
  NEW.business_verified := OLD.business_verified;
  NEW.basics_certified  := OLD.basics_certified;
  NEW.campus_ambassador := OLD.campus_ambassador;
  NEW.is_managed        := OLD.is_managed;
  NEW.managed_by        := OLD.managed_by;

  -- Users may declare themselves a student, but only a reviewer can mark
  -- them verified.
  IF NEW.student_status = 'student_verified'
     AND OLD.student_status IS DISTINCT FROM 'student_verified' THEN
    NEW.student_status := OLD.student_status;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_privileged_profile_fields ON profiles;
CREATE TRIGGER protect_privileged_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_privileged_profile_fields();

-- ── 6. Internships with a custom domain ────────────────────────────
-- role_type holds a known category; custom_role holds free text. When a
-- hirer types their own domain, role_type is legitimately NULL — but the
-- column was still NOT NULL, so "Publish Listing" failed with a 23502.
ALTER TABLE gigs ALTER COLUMN role_type DROP NOT NULL;

-- Guarantee one of the two is always present
ALTER TABLE gigs DROP CONSTRAINT IF EXISTS gigs_role_present;
ALTER TABLE gigs ADD CONSTRAINT gigs_role_present
  CHECK (role_type IS NOT NULL OR custom_role IS NOT NULL);
