-- ══════════════════════════════════════════════════════════════════
-- Admin portal: analytics, issue reports, managed (agency-created)
-- accounts, and platform settings.
--
-- Run this whole file in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Analytics events ────────────────────────────────────────────
-- Deliberately privacy-light: no IP addresses, no full user agents, no
-- cross-site identifiers. A random per-tab session id is enough to
-- separate "views" from "visitors" without profiling anyone.
CREATE TABLE analytics_events (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL DEFAULT 'pageview',
  path text,
  referrer_host text,
  session_id text,
  user_id uuid REFERENCES profiles(id),
  device text CHECK (device = ANY (ARRAY['mobile','tablet','desktop'])),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX analytics_events_created_idx ON analytics_events (created_at DESC);
CREATE INDEX analytics_events_name_created_idx ON analytics_events (event_name, created_at DESC);
CREATE INDEX analytics_events_session_idx ON analytics_events (session_id);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Written server-side (service role) only; readable by admins only.
CREATE POLICY "Admins read analytics"
  ON analytics_events FOR SELECT USING (public.is_admin());

-- ── 2. Issue reports ───────────────────────────────────────────────
CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES profiles(id),
  target_type text NOT NULL CHECK (target_type = ANY (ARRAY['user','gig','application','message','other'])),
  target_id uuid,
  category text NOT NULL CHECK (category = ANY (ARRAY['safety','fraud','payment','behaviour','spam','no_show','other'])),
  subject text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open','investigating','resolved','dismissed'])),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority = ANY (ARRAY['low','normal','high','urgent'])),
  admin_note text,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters read own reports"
  ON reports FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin());
CREATE POLICY "Users file reports"
  ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins triage reports"
  ON reports FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 3. Managed accounts ────────────────────────────────────────────
-- Accounts the GigDekho team creates on a business's behalf so listings can
-- go live before the business has signed up. The owner claims the account by
-- signing in with the same email; `claimed_at` records when they took over.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_managed boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS managed_by uuid REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS internal_note text;

-- Admins need to see every profile for support; the existing
-- "Public read profiles" policy already allows SELECT, so nothing to add.

-- ── 3b. Admin authority over listings ──────────────────────────────
-- Lets the team post on behalf of a managed account and moderate/take down
-- any listing. Both are audited in admin_actions.
CREATE POLICY "Admins insert gigs on behalf"
  ON gigs FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update any gig"
  ON gigs FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 4. Platform settings ───────────────────────────────────────────
INSERT INTO app_settings (key, value) VALUES
  ('platform_fee_pct', '9.0'),
  ('advance_pct', '30'),
  ('support_email', 'foundersyc@gmail.com'),
  ('new_signups_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Admin action log: widen the allowed action vocabulary ───────
-- (admin_actions.action is free text, so nothing to alter — documented here:
--  approve_document, reject_document, grant_badge, revoke_badge,
--  suspend_user, unsuspend_user, create_managed_account, post_on_behalf,
--  resolve_report, approve_withdrawal, reject_withdrawal, wallet_adjustment,
--  moderate_gig, update_setting)
