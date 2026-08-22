import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = 'http://localhost:5173';
const REF = env.VITE_SUPABASE_URL.split('//')[1].split('.')[0];

let pass = 0, fail = 0;
const ck = (l, ok, d) => { ok ? pass++ : fail++; console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + l + (d ? '  -> ' + d : '')); };

async function cookieFor(email) {
  const l = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const s = await c.auth.verifyOtp({ token_hash: l.data.properties.hashed_token, type: 'magiclink' });
  const v = 'base64-' + Buffer.from(JSON.stringify(s.data.session)).toString('base64url');
  const ch = v.match(/.{1,3180}/g);
  return { cookie: ch.map((x, i) => 'sb-' + REF + '-auth-token' + (ch.length > 1 ? '.' + i : '') + '=' + x).join('; '), client: c };
}
const postAdmin = async (fields, cookie) => {
  const fd = new FormData();
  for (const k of Object.keys(fields)) fd.append(k, String(fields[k]));
  const r = await fetch(BASE + '/admin/reels', { method: 'POST', body: fd, headers: { cookie } });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch {}
  return { status: r.status, body: j, raw: t.slice(0, 100) };
};

const made = [];
let gigId = null, appId = null, reelId = null;

try {
  // a worker who has actually worked a gig
  const email = 'qa.reel.' + Date.now() + '@gmail.com';
  const cu = await admin.auth.admin.createUser({ email, email_confirm: true });
  const uid = cu.data.user.id;
  made.push(uid);
  await admin.from('profiles').upsert({ id: uid, email, full_name: 'Reel QA', role: 'worker', city: 'Indore' }, { onConflict: 'id' });

  const org = await admin.from('gigs').select('organizer_id').not('organizer_id', 'is', null).limit(1).single();
  const g = await admin.from('gigs').insert({
    organizer_id: org.data.organizer_id, title: 'QA reel gig', description: 'x', role_type: 'Waitstaff',
    pay_rate: 100, duration_hrs: 4, slots_total: 5, slots_filled: 0,
    event_date: new Date(Date.now() + 5 * 864e5).toISOString(), location_text: 'Indore',
    gig_type: 'event', status: 'open',
  }).select('id').single();
  gigId = g.data.id;
  const a = await admin.from('applications').insert({ gig_id: gigId, worker_id: uid, status: 'pending' }).select('id,status').single();
  appId = a.data.id;

  const { cookie: wCookie, client: wClient } = await cookieFor(email);
  const adminRow = await admin.from('profiles').select('email').eq('is_admin', true).limit(1).single();
  const { cookie: aCookie } = await cookieFor(adminRow.data.email);

  const settings = await admin.from('app_settings').select('key,value').like('key', 'reel%');
  const get = (k, d) => Number((settings.data || []).find(s => s.key === k)?.value ?? d);
  const perReel = get('reel_bonus_per_reel', 50), viewsBonus = get('reel_views_bonus', 50);
  console.log(`\nrates: ₹${perReel}/reel, ₹${viewsBonus} views bonus at ${get('reel_views_threshold', 3000)} views\n`);

  // 1. worker submits, exactly as the panel does
  const row = { worker_id: uid, application_id: appId, gig_id: gigId, reel_url: 'https://www.instagram.com/reel/QA' + Date.now(), platform: 'instagram', status: 'pending' };
  let ins = await wClient.from('reel_submissions').insert({ ...row, public_account_confirmed: true }).select('id');
  if (ins.error && /public_account_confirmed/.test(ins.error.message)) ins = await wClient.from('reel_submissions').insert(row).select('id');
  ck('worker can submit a reel', !ins.error, ins.error?.message?.slice(0, 70));
  reelId = ins.data?.[0]?.id;

  const mine = await wClient.from('reel_submissions').select('id,status').eq('worker_id', uid);
  ck('worker sees their own submission', (mine.data || []).length === 1, mine.data?.[0]?.status);

  // 2. another worker must NOT see it
  const e2 = 'qa.reel2.' + Date.now() + '@gmail.com';
  const cu2 = await admin.auth.admin.createUser({ email: e2, email_confirm: true });
  made.push(cu2.data.user.id);
  await admin.from('profiles').upsert({ id: cu2.data.user.id, email: e2, full_name: 'Nosy QA', role: 'worker', city: 'Indore' }, { onConflict: 'id' });
  const { client: nosy } = await cookieFor(e2);
  const leak = await nosy.from('reel_submissions').select('id').eq('id', reelId);
  ck('another worker cannot see it', (leak.data || []).length === 0, `${(leak.data || []).length} rows`);

  // 3. admin approves -> wallet credited exactly once
  const before = await admin.from('wallet_balance').select('balance').eq('worker_id', uid).maybeSingle();
  let r = await postAdmin({ id: reelId, intent: 'approve' }, aCookie);
  ck('admin approves the reel', r.status === 200 && !r.body.error, r.body.error || r.raw);
  let tx = await admin.from('wallet_transactions').select('amount,type').eq('reference_id', reelId).eq('type', 'reel_bonus');
  ck('₹' + perReel + ' credited as reel_bonus', tx.data?.length === 1 && tx.data[0].amount === perReel, JSON.stringify(tx.data));

  r = await postAdmin({ id: reelId, intent: 'approve' }, aCookie);
  tx = await admin.from('wallet_transactions').select('id').eq('reference_id', reelId).eq('type', 'reel_bonus');
  ck('approving twice does not pay twice', tx.data?.length === 1, `${tx.data?.length} transactions`);

  // 4. views claim -> approve -> second credit
  const claim = await wClient.from('reel_submissions').update({ views_claimed: true, views_proof_url: 'https://example.com/shot.png', views_status: 'pending' }).eq('id', reelId).select('id');
  ck('worker can claim the views bonus', !claim.error && claim.data.length === 1, claim.error?.message);

  r = await postAdmin({ id: reelId, intent: 'approve_views' }, aCookie);
  ck('admin approves the views claim', r.status === 200 && !r.body.error, r.body.error || r.raw);
  const vtx = await admin.from('wallet_transactions').select('amount,type').eq('reference_id', reelId).eq('type', 'reel_views_bonus');
  ck('₹' + viewsBonus + ' credited as reel_views_bonus', vtx.data?.length === 1 && vtx.data[0].amount === viewsBonus, JSON.stringify(vtx.data));

  const bal = await admin.from('wallet_balance').select('balance').eq('worker_id', uid).maybeSingle();
  ck('wallet balance is the sum', bal.data?.balance === perReel + viewsBonus, `₹${bal.data?.balance}`);

  // 5. per-gig cap
  const extra = [];
  for (let i = 0; i < 2; i++) {
    const e = await admin.from('reel_submissions').insert({ worker_id: uid, application_id: appId, gig_id: gigId, reel_url: 'https://insta.test/x' + i + Date.now(), platform: 'instagram', status: 'pending' }).select('id').single();
    extra.push(e.data.id);
  }
  r = await postAdmin({ id: extra[0], intent: 'approve' }, aCookie);
  ck('second reel for the gig is allowed', r.status === 200 && !r.body.error, r.body.error || 'approved');
  r = await postAdmin({ id: extra[1], intent: 'approve' }, aCookie);
  ck('third reel refused by the per-gig cap', r.status === 400 && /cap/i.test(r.body.error || ''), r.body.error);

  // 6. views bonus only once per gig
  await admin.from('reel_submissions').update({ views_claimed: true, views_proof_url: 'https://example.com/2.png', views_status: 'pending' }).eq('id', extra[0]);
  r = await postAdmin({ id: extra[0], intent: 'approve_views' }, aCookie);
  ck('views bonus refused a second time for the same gig', r.status === 400 && /already/i.test(r.body.error || ''), r.body.error);

  // 7. non-admin cannot approve
  const nr = await postAdmin({ id: reelId, intent: 'approve' }, wCookie);
  ck('a worker cannot approve reels', nr.status === 404 || nr.status === 403, `${nr.status} ${nr.raw}`);

} catch (e) {
  console.log('\nFATAL: ' + e.message);
} finally {
  for (const id of made) {
    await admin.from('wallet_transactions').delete().eq('worker_id', id);
    await admin.from('reel_submissions').delete().eq('worker_id', id);
    await admin.from('notifications').delete().eq('user_id', id);
    await admin.from('admin_actions').delete().eq('target_user_id', id);
    await admin.from('applications').delete().eq('worker_id', id);
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  if (gigId) { await admin.from('reel_submissions').delete().eq('gig_id', gigId); await admin.from('applications').delete().eq('gig_id', gigId); await admin.from('gigs').delete().eq('id', gigId); }
  console.log('\n  cleaned up. ' + pass + ' passed, ' + fail + ' failed');
}
