/**
 * Runs a migration's apply_to_gig against a real Postgres (compiled to WASM)
 * and exercises it, before it ever touches the live database.
 *
 * This exists because apply_to_gig shipped broken twice in a row for the same
 * reason — RETURNS TABLE makes every result column a variable inside the
 * function, and names that match real columns make references ambiguous. Both
 * times it was caught only after applying was already down in production.
 * Reading SQL is not a substitute for running it.
 *
 *   npm run test:sql
 *   node supabase/test/apply-to-gig.test.mjs supabase/migrations/<file>.sql
 *
 * The schema below is a minimal stand-in, not the real one: enough for this
 * function to plan and execute. RLS is deliberately not modelled — the service
 * role bypasses it anyway, and what is under test is the function body.
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const MIGRATION = process.argv[2];
let fails = 0;
const ck = (l, c, x='') => { if (!c) fails++; console.log(`  [${c?'PASS':'FAIL'}] ${l}${x ? ' — ' + x : ''}`); };

const db = await PGlite.create();

// ── Just enough of the real schema for apply_to_gig to run against ──
await db.exec(`
  CREATE TABLE gigs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid,
    title text,
    status text NOT NULL DEFAULT 'open',
    gig_type text DEFAULT 'event',
    slots_total int DEFAULT 1,
    slots_filled int DEFAULT 0,
    event_date timestamptz,
    pay_rate numeric, duration_hrs numeric,
    commitment_mode text NOT NULL DEFAULT 'all_days',
    min_days int,
    day_rate numeric
  );
  CREATE TABLE gig_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    day_number int NOT NULL,
    day_date date NOT NULL,
    starts_at time NOT NULL, ends_at time NOT NULL,
    duration_hrs numeric NOT NULL,
    slots_needed int NOT NULL DEFAULT 1,
    UNIQUE (gig_id, day_number)
  );
  CREATE TABLE applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gig_id uuid NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    worker_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    waitlist_position int,
    days_committed int,
    applied_at timestamptz DEFAULT now()
  );
  CREATE TABLE application_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    gig_day_id uuid NOT NULL REFERENCES gig_days(id) ON DELETE CASCADE,
    UNIQUE (application_id, gig_day_id)
  );
  ALTER TABLE application_days ENABLE ROW LEVEL SECURITY;
  CREATE VIEW gig_day_fill AS
  SELECT d.id AS gig_day_id, d.gig_id, d.day_number, d.day_date, d.slots_needed,
    COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int AS slots_filled,
    GREATEST(d.slots_needed - COUNT(ad.id) FILTER (WHERE a.status IN ('accepted','completed'))::int, 0) AS slots_left
  FROM gig_days d
  LEFT JOIN application_days ad ON ad.gig_day_id = d.id
  LEFT JOIN applications a ON a.id = ad.application_id
  GROUP BY d.id, d.gig_id, d.day_number, d.day_date, d.slots_needed;
`);

// Supabase-only helpers the migrations lean on. RLS is not what is under test
// here; the function body is.
await db.exec(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $f$ SELECT NULL::uuid $f$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $f$ SELECT 'service_role'::text $f$;
  CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $f$ SELECT false $f$;
`);

// The real FCFS trigger, so the skip_fcfs handshake is exercised for real.
await db.exec(`
  CREATE OR REPLACE FUNCTION handle_new_application() RETURNS trigger
  LANGUAGE plpgsql AS $f$
  DECLARE g RECORD; wp int;
  BEGIN
    IF COALESCE(current_setting('gigdekho.skip_fcfs', true), '') = 'on' THEN RETURN NEW; END IF;
    SELECT slots_total, slots_filled, status INTO g FROM gigs WHERE id = NEW.gig_id;
    IF g.status NOT IN ('open','filled') THEN NEW.status := 'rejected'; RETURN NEW; END IF;
    IF g.slots_filled < g.slots_total THEN NEW.status := 'accepted';
    ELSE
      SELECT COALESCE(MAX(waitlist_position),0)+1 INTO wp FROM applications WHERE gig_id = NEW.gig_id AND status='pending';
      NEW.status := 'pending'; NEW.waitlist_position := wp;
    END IF;
    RETURN NEW;
  END $f$;
  CREATE TRIGGER app_fcfs BEFORE INSERT ON applications
    FOR EACH ROW EXECUTE FUNCTION handle_new_application();
`);

// ── The migration under test, minus the bits that need Supabase ─────
let sql = fs.readFileSync(MIGRATION, 'utf8');
sql = sql
  .replace(/REVOKE ALL ON FUNCTION[\s\S]*?;/g, '')
  .replace(/GRANT EXECUTE ON FUNCTION[\s\S]*?;/g, '')
  .replace(/SET search_path = public, pg_temp/g, '')
  .replace(/SECURITY DEFINER/g, '');
try {
  await db.exec(sql);
  console.log(`loaded ${MIGRATION.split(/[\\/]/).pop()}\n`);
} catch (e) {
  console.log(`MIGRATION FAILED TO LOAD: ${e.message}\n`);
  process.exit(1);
}

const call = async (gigId, workerId, dayIds) => {
  try {
    const r = await db.query('SELECT * FROM apply_to_gig($1,$2,$3)', [gigId, workerId, dayIds]);
    return { ok: true, row: r.rows[0] };
  } catch (e) { return { ok: false, error: e.message }; }
};
const W = n => `00000000-0000-0000-0000-00000000000${n}`;

// ── Fixture: 5 days, 2 slots each, day 3 scarce, pick_days min 2 ────
const { rows: [gig] } = await db.query(`
  INSERT INTO gigs (title, status, slots_total, commitment_mode, min_days, day_rate, event_date)
  VALUES ('test', 'open', 2, 'pick_days', 2, 300, now() + interval '14 days') RETURNING id`);
const dayIds = {};
for (let i = 1; i <= 5; i++) {
  const { rows: [d] } = await db.query(
    `INSERT INTO gig_days (gig_id, day_number, day_date, starts_at, ends_at, duration_hrs, slots_needed)
     VALUES ($1,$2,$3,'10:00','14:00', 4, $4) RETURNING id`,
    [gig.id, i, new Date(Date.now() + i*86400000).toISOString().slice(0,10), i === 3 ? 1 : 2]);
  dayIds[i] = d.id;
}

console.log('1. The failures that shipped twice');
{
  const r = await call(gig.id, W(1), [dayIds[1], dayIds[2]]);
  ck('no ambiguous column error', r.ok, r.error);
  if (r.ok) {
    ck('returns an application id', !!r.row.out_application_id, JSON.stringify(r.row));
    ck('accepted', r.row.out_status === 'accepted', r.row.out_status);
    const { rows } = await db.query(
      `SELECT d.day_number FROM application_days ad JOIN gig_days d ON d.id = ad.gig_day_id
       WHERE ad.application_id = $1 ORDER BY d.day_number`, [r.row.out_application_id]);
    ck('day rows written for exactly days 1,2', JSON.stringify(rows.map(x=>x.day_number)) === '[1,2]',
       JSON.stringify(rows.map(x=>x.day_number)));
    const { rows: [a] } = await db.query('SELECT days_committed FROM applications WHERE id=$1', [r.row.out_application_id]);
    ck('days_committed recorded', a.days_committed === 2, String(a.days_committed));
  }
}

console.log('\n2. The hirer minimum');
{
  const r = await call(gig.id, W(2), [dayIds[1]]);
  ck('one day refused when two required', !r.ok && /below_min_days:2/.test(r.error), r.error);
}

console.log('\n3. Per-day capacity');
{
  const a = await call(gig.id, W(3), [dayIds[3], dayIds[5]]);
  ck('first taker of the single day-3 slot is accepted', a.ok && a.row.out_status === 'accepted', a.error ?? a.row?.out_status);
  const { rows: [f] } = await db.query('SELECT slots_filled, slots_left FROM gig_day_fill WHERE gig_day_id=$1', [dayIds[3]]);
  ck('day 3 now full', f.slots_filled === 1 && f.slots_left === 0, `filled ${f.slots_filled}, left ${f.slots_left}`);

  const b = await call(gig.id, W(4), [dayIds[3], dayIds[4]]);
  ck('next person waitlisted', b.ok && b.row.out_status === 'pending', b.error ?? b.row?.out_status);
  ck('and told day 3 is the blocker', JSON.stringify(b.row?.out_full_days) === '[3]', JSON.stringify(b.row?.out_full_days));

  const c = await call(gig.id, W(5), [dayIds[4], dayIds[5]]);
  ck('someone avoiding day 3 is accepted', c.ok && c.row.out_status === 'accepted', c.error ?? c.row?.out_status);
}

console.log('\n4. all_days mode ignores a day selection');
{
  const { rows: [g2] } = await db.query(`
    INSERT INTO gigs (title, status, slots_total, commitment_mode, event_date)
    VALUES ('all days','open',5,'all_days', now() + interval '14 days') RETURNING id`);
  for (let i = 1; i <= 3; i++)
    await db.query(`INSERT INTO gig_days (gig_id, day_number, day_date, starts_at, ends_at, duration_hrs, slots_needed)
                    VALUES ($1,$2,$3,'10:00','14:00',4,5)`,
                   [g2.id, i, new Date(Date.now() + i*86400000).toISOString().slice(0,10)]);
  const r = await call(g2.id, W(6), [/* asks for one day only */]);
  ck('accepted', r.ok && r.row.out_status === 'accepted', r.error ?? '');
  const { rows } = await db.query('SELECT count(*)::int n FROM application_days WHERE application_id=$1', [r.row?.out_application_id]);
  ck('committed to all three days regardless', rows[0].n === 3, String(rows[0].n));
}

console.log('\n5. Closed gigs and unknown gigs');
{
  const { rows: [g3] } = await db.query(`INSERT INTO gigs (title,status,event_date) VALUES ('done','completed', now()) RETURNING id`);
  const r = await call(g3.id, W(7), null);
  ck('completed gig refused', !r.ok && /gig_closed/.test(r.error), r.error);
  const r2 = await call('00000000-0000-0000-0000-0000000000ff', W(7), null);
  ck('unknown gig refused', !r2.ok && /gig_not_found/.test(r2.error), r2.error);
}

console.log(`\n${fails === 0 ? 'ALL PASSED' : fails + ' FAILURE(S)'}`);
process.exit(fails === 0 ? 0 : 1);
