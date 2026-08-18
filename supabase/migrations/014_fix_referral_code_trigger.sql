-- URGENT: 013 broke signup.
--
-- The referral-code trigger fires BEFORE INSERT on profiles, and the row that
-- creates a profile during signup is inserted by the auth service running as
-- `supabase_auth_admin`. generate_referral_code() reads public.profiles to
-- check the code is unique, and that role has no rights there — so the
-- function raised, the profile insert failed, and the whole signup returned
-- a bare 500. Calling the same function as the service role worked fine,
-- which is what made it look healthy.
--
-- SECURITY DEFINER runs it as the owner regardless of who fired the trigger.
-- search_path is pinned because a definer function that resolves names
-- through the caller's search_path is how privilege escalation happens.

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END $$;

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    -- Never let a decorative field block someone signing up. If the code
    -- can't be generated the profile still gets created; a code can be
    -- backfilled later.
    BEGIN
      NEW.referral_code := public.generate_referral_code();
    EXCEPTION WHEN OTHERS THEN
      NEW.referral_code := NULL;
    END;
  END IF;
  RETURN NEW;
END $$;

-- Backfill anyone who slipped through without one.
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;
