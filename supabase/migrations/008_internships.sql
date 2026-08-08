-- ══════════════════════════════════════════════════════════════════
-- Internships & Jobs
--
-- Hirers can now post two kinds of listings:
--   'event'      — temporary/event staffing (existing FCFS + waitlist flow)
--   'internship' — internships & jobs (hirer reviews full applications)
--
-- Internship applications deliberately live in their OWN table rather than
-- reusing `applications`: they have a different lifecycle (submitted →
-- shortlisted → interviewing → hired/rejected, decided by the hirer) and
-- must NOT touch the FCFS auto-accept trigger, waitlist promotion,
-- attendance, reliability scoring, or wallet crediting that `applications`
-- drives. Keeping them separate leaves the live event flow untouched.
--
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Gig type + internship fields ────────────────────────────────
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS gig_type text NOT NULL DEFAULT 'event'
  CHECK (gig_type = ANY (ARRAY['event','internship']));

ALTER TABLE gigs ADD COLUMN IF NOT EXISTS work_mode text
  CHECK (work_mode = ANY (ARRAY['onsite','hybrid','remote']));
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS commitment text
  CHECK (commitment = ANY (ARRAY['full_time','part_time']));
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS duration_months smallint;   -- minimum commitment
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS stipend_min integer;        -- ₹ per month
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS stipend_max integer;        -- ₹ per month (optional range)
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_unpaid boolean DEFAULT false;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS jd_url text;                -- optional link to a full JD
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS preferences text;           -- who they're looking for
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS application_deadline timestamptz;

-- Event-only numerics get defaults so internship inserts can omit them.
-- (For internships: event_date doubles as the expected start date.)
ALTER TABLE gigs ALTER COLUMN pay_rate     SET DEFAULT 0;
ALTER TABLE gigs ALTER COLUMN duration_hrs SET DEFAULT 0;
ALTER TABLE gigs ALTER COLUMN slots_total  SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS gigs_type_status_idx ON gigs (gig_type, status, event_date);

-- ── 2. Internship applications ─────────────────────────────────────
CREATE TABLE internship_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES gigs(id),
  applicant_id uuid NOT NULL REFERENCES profiles(id),

  -- Contact (prefilled from profile, editable at apply time)
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,

  -- Education
  qualification text,        -- e.g. 'Pursuing Bachelor's'
  institution text,
  degree_domain text,        -- e.g. 'B.Tech, Computer Science'
  graduation_year smallint,

  -- Pitch
  about text,                -- short brief / note to the hirer
  why_you text,

  -- Proof of work
  resume_url text,
  portfolio_url text,

  status text NOT NULL DEFAULT 'submitted'
    CHECK (status = ANY (ARRAY['submitted','shortlisted','interviewing','hired','rejected'])),
  hirer_note text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (gig_id, applicant_id)
);
CREATE INDEX internship_applications_gig_idx ON internship_applications (gig_id, created_at DESC);
CREATE INDEX internship_applications_applicant_idx ON internship_applications (applicant_id);
ALTER TABLE internship_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants read own internship applications"
  ON internship_applications FOR SELECT
  USING (auth.uid() = applicant_id);

CREATE POLICY "Organizers read applications to their listings"
  ON internship_applications FOR SELECT
  USING (auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1));

CREATE POLICY "Applicants submit own application"
  ON internship_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

-- Hirers move candidates through the pipeline; applicants never edit after submit.
CREATE POLICY "Organizers update applicant status"
  ON internship_applications FOR UPDATE
  USING (auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1))
  WITH CHECK (auth.uid() = (SELECT organizer_id FROM gigs WHERE id = gig_id LIMIT 1));

-- ── 3. Google Sheet registry (one live sheet per internship listing) ──
CREATE TABLE gig_sheets (
  gig_id uuid PRIMARY KEY REFERENCES gigs(id),
  organizer_id uuid NOT NULL REFERENCES profiles(id),
  spreadsheet_id text NOT NULL,
  spreadsheet_url text NOT NULL,
  shared_with text,
  rows_synced integer DEFAULT 0,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gig_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers read own gig sheets"
  ON gig_sheets FOR SELECT
  USING (auth.uid() = organizer_id);
-- Created/updated server-side only (service role).
