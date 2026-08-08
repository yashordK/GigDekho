/**
 * RLS security audit.
 *
 * Signs in as an ordinary user and attempts writes that should be impossible,
 * so policy regressions get caught instead of sitting silently in production.
 *
 *   node scripts/audit-rls.mjs
 *   AUDIT_EMAIL=someone@example.com node scripts/audit-rls.mjs
 *
 * Two rules this script follows, learned the hard way:
 *
 *  1. It NEVER runs as an admin. Admins legitimately can edit other profiles
 *     and grant badges, so the results would be meaningless — and worse, the
 *     escalation test would look like a failure when it's correct behaviour.
 *  2. It snapshots every row it touches and restores the exact original
 *     values, rather than assuming a "clean" state to reset to. Blindly
 *     resetting is_admin to false once cost a real admin their access.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFile = fs.existsSync(".env.local") ? ".env.local" : ".env";
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const URL_ = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) { console.error("Missing Supabase env vars."); process.exit(1); }

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// ── Pick the user to audit as ──────────────────────────────────────
let email = process.env.AUDIT_EMAIL || env.AUDIT_EMAIL;
if (email) {
  const { data: p } = await admin.from("profiles").select("is_admin, is_suspended").eq("email", email).maybeSingle();
  if (!p) { console.error(`No profile found for ${email}.`); process.exit(1); }
  if (p.is_admin) {
    console.error(
      `\n${email} is an admin.\n\n` +
      `This audit measures what an ORDINARY user can do. Admins are supposed to\n` +
      `be able to edit profiles and grant badges, so running as one would report\n` +
      `false failures. Re-run without AUDIT_EMAIL to auto-pick a normal account.\n`
    );
    process.exit(1);
  }
} else {
  const { data: candidate } = await admin.from("profiles")
    .select("email").eq("is_admin", false).eq("is_suspended", false)
    .not("email", "is", null).limit(1).maybeSingle();
  if (!candidate?.email) { console.error("No non-admin user available to audit with."); process.exit(1); }
  email = candidate.email;
}

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (linkErr) { console.error("Could not create a test session:", linkErr.message); process.exit(1); }

const user = createClient(URL_, ANON, { auth: { persistSession: false } });
const { data: sess, error: otpErr } = await user.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
if (otpErr) { console.error("Could not verify test session:", otpErr.message); process.exit(1); }

const me = sess.user.id;
const { data: other } = await admin.from("profiles").select("*").neq("id", me).limit(1).single();
const { data: mine } = await admin.from("profiles").select("*").eq("id", me).single();
const { data: anyGig } = await admin.from("gigs").select("id").limit(1).maybeSingle();
const { data: otherGig } = await admin.from("gigs").select("id, title").neq("organizer_id", me).limit(1).maybeSingle();

/** Restores the exact values a test may have altered. */
const restore = async (id, snapshot, fields) => {
  const patch = Object.fromEntries(fields.map((f) => [f, snapshot[f]]));
  await admin.from("profiles").update(patch).eq("id", id);
};

let failures = 0;
const check = (label, blocked, detail = "") => {
  if (blocked) console.log(`  \x1b[32mPASS\x1b[0m  ${label}`);
  else { failures++; console.log(`  \x1b[31mFAIL\x1b[0m  ${label} — this should be impossible${detail ? ` (${detail})` : ""}`); }
};

console.log(`\nRLS audit as ${email} (non-admin)\n`);

// ── Impersonation ──────────────────────────────────────────────────
{
  const g = { organizer_id: other.id, gig_type: "event", title: "RLS AUDIT", role_type: "Waitstaff",
    event_date: new Date(Date.now() + 864e5).toISOString(), location_text: "Indore",
    slots_total: 1, slots_filled: 0, pay_rate: 100, duration_hrs: 2, status: "open" };
  const { data, error } = await user.from("gigs").insert(g).select("id").single();
  check("cannot post a gig as another hirer", Boolean(error));
  if (data) await admin.from("gigs").delete().eq("id", data.id);
}
if (otherGig) {
  const { data, error } = await user.from("gigs").update({ title: otherGig.title }).eq("id", otherGig.id).select("id");
  check("cannot edit another hirer's listing", Boolean(error) || !data?.length);
}
if (anyGig) {
  const { data, error } = await user.from("applications")
    .insert({ gig_id: anyGig.id, worker_id: other.id, status: "pending" }).select("id").single();
  check("cannot apply on behalf of another worker", Boolean(error));
  if (data) await admin.from("applications").delete().eq("id", data.id);
}

// ── Privilege escalation ───────────────────────────────────────────
{
  const { data, error } = await user.from("profiles").update({ is_admin: true }).eq("id", me).select("id, is_admin");
  const escalated = !error && data?.[0]?.is_admin === true;
  check("cannot grant yourself admin", !escalated, escalated ? "PRIVILEGE ESCALATION" : "");
  if (escalated) await restore(me, mine, ["is_admin"]);
}
{
  const { data, error } = await user.from("profiles").update({ is_suspended: false }).eq("id", me).select("id");
  // Only a real change counts as a failure — a no-op update on an already-false
  // value tells us nothing.
  check("cannot lift your own suspension", Boolean(error) || !data?.length || mine.is_suspended === false);
  if (data?.length) await restore(me, mine, ["is_suspended"]);
}
{
  const { data, error } = await user.from("profiles").update({ city: "RLS-AUDIT" }).eq("id", other.id).select("id");
  const changed = !error && data?.length;
  check("cannot edit another user's profile", !changed);
  if (changed) await restore(other.id, other, ["city"]);
}
{
  const { data, error } = await user.from("profiles").update({ id_verified: true }).eq("id", me).select("id, id_verified");
  const selfVerified = !error && data?.[0]?.id_verified === true && mine.id_verified !== true;
  check("cannot self-award a verification badge", !selfVerified);
  if (selfVerified) await restore(me, mine, ["id_verified"]);
}

// ── Money ──────────────────────────────────────────────────────────
{
  const { data, error } = await user.from("wallet_transactions")
    .insert({ worker_id: me, amount: 99999, type: "bonus", status: "completed", description: "RLS AUDIT" }).select("id").single();
  check("cannot credit your own wallet", Boolean(error));
  if (data) await admin.from("wallet_transactions").delete().eq("id", data.id);
}
if (anyGig) {
  const { data, error } = await user.from("gig_payments").insert({
    gig_id: anyGig.id, organizer_id: me, total_worker_cost: 0, platform_fee: 0,
    organizer_total: 0, advance_amount: 0, final_amount: 0 }).select("id").single();
  check("cannot forge a payment record", Boolean(error));
  if (data) await admin.from("gig_payments").delete().eq("id", data.id);
}

// ── Legitimate actions must still work ─────────────────────────────
{
  const g = { organizer_id: me, gig_type: "event", title: "RLS AUDIT OWN", role_type: "Waitstaff",
    event_date: new Date(Date.now() + 864e5).toISOString(), location_text: "Indore",
    slots_total: 1, slots_filled: 0, pay_rate: 100, duration_hrs: 2, status: "open" };
  const { data, error } = await user.from("gigs").insert(g).select("id").single();
  check("CAN still post your own gig", !error, error?.message);
  if (data) await admin.from("gigs").delete().eq("id", data.id);
}
{
  const { error } = await user.from("profiles").update({ city: mine.city ?? "Indore" }).eq("id", me);
  check("CAN still edit your own profile", !error, error?.message);
}

// ── Confirm nothing was left altered ───────────────────────────────
const { data: mineAfter } = await admin.from("profiles").select("*").eq("id", me).single();
const { data: otherAfter } = await admin.from("profiles").select("*").eq("id", other.id).single();
const drifted = ["is_admin", "is_suspended", "id_verified", "city"].filter((f) => mineAfter[f] !== mine[f])
  .concat(["city"].filter((f) => otherAfter[f] !== other[f]).map((f) => `other.${f}`));
if (drifted.length) {
  console.log(`\n  \x1b[31mWARNING\x1b[0m the audit left these fields changed: ${drifted.join(", ")}`);
  failures++;
}

console.log(
  failures === 0
    ? "\n\x1b[32mAll checks passed.\x1b[0m\n"
    : `\n\x1b[31m${failures} check(s) failed — see supabase/migrations/010_rls_security_fix.sql.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
