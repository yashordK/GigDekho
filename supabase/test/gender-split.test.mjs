import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let fails = 0;
const ck = (l, c, x = '') => { if (!c) fails++; console.log(`  [${c ? 'PASS' : 'FAIL'}] ${l}${x ? ' -- ' + x : ''}`); };
const db = await PGlite.create();

await db.exec(`
  CREATE TABLE profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text, role text);
  CREATE TABLE gigs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organizer_id uuid, title text,
    status text NOT NULL DEFAULT 'open', gig_type text DEFAULT 'event',
    slots_total int DEFAULT 1, slots_filled int DEFAULT 0, event_date timestamptz,
    pay_rate numeric, duration_hrs numeric, is_multi_day boolean DEFAULT false,
    commitment_mode text NOT NULL DEFAULT 'all_days', min_days int, day_rate numeric);
  CREATE TABLE gig_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    day_number int NOT NULL, day_date date NOT NULL, starts_at time NOT NULL, ends_at time NOT NULL,
    duration_hrs numeric NOT NULL, slots_needed int NOT NULL DEFAULT 1, UNIQUE (gig_id, day_number));
  CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    worker_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending', waitlist_position int,
    days_committed int, applied_at timestamptz DEFAULT now());
  CREATE TABLE application_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    gig_day_id uuid NOT NULL REFERENCES gig_days(id) ON DELETE CASCADE,
    UNIQUE (application_id, gig_day_id));
  CREATE VIEW gig_day_fill AS
  SELECT d.id AS gig_day_id, d.gig_id, d.day_number, d.day_date, d.slots_needed,
    COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int AS slots_filled,
    GREATEST(d.slots_needed - COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int,0) AS slots_left
  FROM gig_days d LEFT JOIN application_days ad ON ad.gig_day_id=d.id
  LEFT JOIN applications a ON a.id=ad.application_id
  GROUP BY d.id,d.gig_id,d.day_number,d.day_date,d.slots_needed;
  CREATE SCHEMA IF NOT EXISTS auth;
`);

await db.exec(`
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT ''service_role''::text';
  CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS 'SELECT false';
`);

// The real FCFS trigger, so the skip_fcfs handshake is exercised for real.
await db.exec([
  'CREATE OR REPLACE FUNCTION handle_new_application() RETURNS trigger LANGUAGE plpgsql AS $f$',
  'DECLARE g RECORD; wp int; BEGIN',
  "  IF COALESCE(current_setting('gigdekho.skip_fcfs',true),'')='on' THEN RETURN NEW; END IF;",
  '  SELECT slots_total,slots_filled,status INTO g FROM gigs WHERE id=NEW.gig_id;',
  "  IF g.status NOT IN ('open','filled') THEN NEW.status:='rejected'; RETURN NEW; END IF;",
  "  IF g.slots_filled<g.slots_total THEN NEW.status:='accepted';",
  "  ELSE SELECT COALESCE(MAX(waitlist_position),0)+1 INTO wp FROM applications WHERE gig_id=NEW.gig_id AND status='pending';",
  "    NEW.status:='pending'; NEW.waitlist_position:=wp; END IF;",
  '  RETURN NEW; END $f$;',
  'CREATE TRIGGER app_fcfs BEFORE INSERT ON applications FOR EACH ROW EXECUTE FUNCTION handle_new_application();',
].join('\n'));

let sql = fs.readFileSync('supabase/migrations/027_gender_split.sql', 'utf8')
  .replace(/REVOKE ALL ON FUNCTION[\s\S]*?;/g, '')
  .replace(/GRANT EXECUTE ON FUNCTION[\s\S]*?;/g, '')
  .replace(/GRANT SELECT ON[\s\S]*?;/g, '')
  .replace(/SET search_path = public, pg_temp/g, '')
  .replace(/SECURITY DEFINER/g, '');
try { await db.exec(sql); console.log('loaded 027_gender_split.sql\n'); }
catch (e) { console.log('MIGRATION FAILED TO LOAD:', e.message); process.exit(1); }

const mk = async (gender) => (await db.query(
  "INSERT INTO profiles (full_name, role, gender) VALUES ('w','worker',$1) RETURNING id", [gender])).rows[0].id;
const apply = async (gig, worker, days = null) => {
  try { return (await db.query('SELECT * FROM apply_to_gig($1,$2,$3)', [gig, worker, days])).rows[0]; }
  catch (e) { return { error: e.message }; }
};

const g = (await db.query("INSERT INTO gigs (title,slots_total) VALUES ('split',3) RETURNING id")).rows[0].id;
const d = (await db.query(`INSERT INTO gig_days (gig_id,day_number,day_date,starts_at,ends_at,duration_hrs,slots_needed,slots_male,slots_female)
  VALUES ($1,1,'2026-12-01','10:00','16:00',6,3,2,1) RETURNING id`, [g])).rows[0].id;

console.log('A gig reserving 2 male / 1 female seats:');
const m1 = await apply(g, await mk('male'));
ck('1st man accepted', m1.out_status === 'accepted', m1.out_status || m1.error);
const m2 = await apply(g, await mk('male'));
ck('2nd man accepted', m2.out_status === 'accepted', m2.out_status || m2.error);
const m3 = await apply(g, await mk('male'));
ck('3rd man waitlisted (male seats gone)', m3.out_status === 'pending', m3.out_status || m3.error);
const f1 = await apply(g, await mk('female'));
ck('woman still accepted though men are full', f1.out_status === 'accepted', f1.out_status || f1.error);
const f2 = await apply(g, await mk('female'));
ck('2nd woman waitlisted', f2.out_status === 'pending', f2.out_status || f2.error);
const u1 = await apply(g, await mk('undisclosed'));
ck('undisclosed waitlisted on a split day', u1.out_status === 'pending', u1.out_status || u1.error);
const n1 = await apply(g, await mk(null));
ck('never-asked waitlisted on a split day', n1.out_status === 'pending', n1.out_status || n1.error);

const fill = (await db.query('SELECT * FROM gig_day_fill WHERE gig_day_id=$1', [d])).rows[0];
ck('filled_male counted', fill.filled_male === 2, String(fill.filled_male));
ck('filled_female counted', fill.filled_female === 1, String(fill.filled_female));
ck('slots_filled is the overall total', fill.slots_filled === 3, String(fill.slots_filled));

console.log('\nAn unsplit gig (the default) is unchanged:');
const g2 = (await db.query("INSERT INTO gigs (title,slots_total) VALUES ('neutral',2) RETURNING id")).rows[0].id;
await db.query(`INSERT INTO gig_days (gig_id,day_number,day_date,starts_at,ends_at,duration_hrs,slots_needed)
  VALUES ($1,1,'2026-12-01','10:00','16:00',6,2)`, [g2]);
const a1 = await apply(g2, await mk('male'));
ck('man accepted', a1.out_status === 'accepted', a1.out_status || a1.error);
const a2 = await apply(g2, await mk(null));
ck('never-asked accepted -- no split, no restriction', a2.out_status === 'accepted', a2.out_status || a2.error);
const a3 = await apply(g2, await mk('female'));
ck('3rd waitlisted on overall capacity', a3.out_status === 'pending', a3.out_status || a3.error);

console.log('\nOnly the female side reserved (male side left open):');
const g3 = (await db.query("INSERT INTO gigs (title,slots_total) VALUES ('half',4) RETURNING id")).rows[0].id;
await db.query(`INSERT INTO gig_days (gig_id,day_number,day_date,starts_at,ends_at,duration_hrs,slots_needed,slots_female)
  VALUES ($1,1,'2026-12-01','10:00','16:00',6,4,1)`, [g3]);
const h1 = await apply(g3, await mk('female'));
ck('1st woman accepted', h1.out_status === 'accepted', h1.out_status || h1.error);
const h2 = await apply(g3, await mk('female'));
ck('2nd woman waitlisted', h2.out_status === 'pending', h2.out_status || h2.error);
const h3 = await apply(g3, await mk('male'));
ck('man accepted -- male side unrestricted', h3.out_status === 'accepted', h3.out_status || h3.error);

console.log('\nApplicant split view:');
const v = (await db.query('SELECT * FROM gig_applicant_gender WHERE gig_id=$1', [g])).rows[0];
ck('applicants_male = 3', v.applicants_male === 3, String(v.applicants_male));
ck('applicants_female = 2', v.applicants_female === 2, String(v.applicants_female));
ck('applicants_unstated = 2', v.applicants_unstated === 2, String(v.applicants_unstated));
ck('accepted_male = 2', v.accepted_male === 2, String(v.accepted_male));

console.log('\nPre-existing behaviour:');
const closed = (await db.query("INSERT INTO gigs (title,status) VALUES ('shut','cancelled') RETURNING id")).rows[0].id;
ck('closed gig rejected', String((await apply(closed, await mk('male'))).error).includes('gig_closed'));
ck('unknown gig rejected', String((await apply('00000000-0000-0000-0000-000000000000', await mk('male'))).error).includes('gig_not_found'));
ck('no ambiguous column anywhere', !JSON.stringify([m1, f1, a1, h1]).includes('ambiguous'));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
await db.close();
