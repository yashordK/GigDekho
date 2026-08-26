import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, gigPaidEmail } from "~/lib/email.server";

/**
 * Two-sided, per-day attendance, and the payout that hangs off it.
 *
 * The rule the whole file exists to enforce: nobody gets paid on their own
 * word. A worker says "I am here" and backs it with a selfie taken at the
 * venue; the hirer (or an admin) confirms it. Money moves only for days that
 * carry both marks.
 *
 * Every write goes through the service role, so RLS is not the thing keeping
 * these rules — this file is. Callers must have already established who the
 * caller is and what they are allowed to do.
 */

export type AttendanceStatus =
  | "pending" | "worker_marked" | "confirmed" | "disputed" | "absent" | "excused";

/** Statuses that count as "this person worked this day" for pay purposes. */
const PAID_STATUSES: AttendanceStatus[] = ["confirmed", "excused"];

/** Statuses that mean the day is settled and needs no further action. */
const RESOLVED: AttendanceStatus[] = ["confirmed", "absent", "excused"];

export interface GigDay {
  id: string;
  day_number: number;
  day_date: string;
  starts_at: string;
  ends_at: string;
  duration_hrs: number;
}

/**
 * Makes sure a gig has day rows before anything tries to hang attendance off
 * them. A single-day gig gets exactly one row, so there is one code path for
 * both shapes rather than a special case that only gets exercised in
 * production.
 */
export async function ensureGigDays(admin: SupabaseClient, gigId: string): Promise<GigDay[]> {
  const { data: existing } = await admin
    .from("gig_days")
    .select("id, day_number, day_date, starts_at, ends_at, duration_hrs")
    .eq("gig_id", gigId)
    .order("day_number");

  if (existing && existing.length) return existing as GigDay[];

  const { data: gig } = await admin
    .from("gigs")
    .select("id, event_date, duration_hrs")
    .eq("id", gigId)
    .maybeSingle();
  if (!gig?.event_date) return [];

  // event_date is stored UTC; the day and the clock time people care about are
  // the Indore ones, so derive both in IST rather than from the raw timestamp.
  const start = new Date(gig.event_date);
  const ist = new Date(start.getTime() + 5.5 * 3600 * 1000);
  const hrs = Math.max(Number(gig.duration_hrs) || 0, 0.5);
  const end = new Date(ist.getTime() + hrs * 3600 * 1000);
  const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;

  const { data: created } = await admin
    .from("gig_days")
    .insert({
      gig_id: gigId,
      day_number: 1,
      day_date: ist.toISOString().slice(0, 10),
      starts_at: hhmm(ist),
      ends_at: hhmm(end),
      duration_hrs: hrs,
    })
    .select("id, day_number, day_date, starts_at, ends_at, duration_hrs");

  return (created as GigDay[]) ?? [];
}

/**
 * Creates the missing attendance rows for an accepted application, one per day.
 * Idempotent — the unique index on (application_id, gig_day_id) is what makes
 * it safe to call on every page load rather than at one exact moment.
 */
export async function ensureAttendanceRows(
  admin: SupabaseClient,
  applicationId: string,
  workerId: string,
  gigId: string,
): Promise<void> {
  const days = await ensureGigDays(admin, gigId);
  if (!days.length) return;

  const { data: rows } = await admin
    .from("gig_attendance")
    .select("gig_day_id")
    .eq("application_id", applicationId);
  const have = new Set((rows ?? []).map((r: any) => r.gig_day_id));

  const missing = days
    .filter((d) => !have.has(d.id))
    .map((d) => ({
      application_id: applicationId,
      gig_day_id: d.id,
      worker_id: workerId,
      status: "pending" as const,
    }));
  if (!missing.length) return;

  // A concurrent request may have inserted the same rows a moment ago; the
  // unique constraint is the arbiter, and losing that race is not an error.
  await admin.from("gig_attendance").upsert(missing, {
    onConflict: "application_id,gig_day_id",
    ignoreDuplicates: true,
  });
}

/**
 * When a worker may check in for a day.
 *
 * Opens an hour before the day starts, so someone arriving early is not told to
 * come back. Closes some hours after it ends rather than on the dot: people are
 * working, and a check-in window that shuts at the exact end time punishes the
 * ones who were busiest. The hirer still has to confirm, so a generous window
 * costs nothing.
 */
export function checkinWindow(day: GigDay, openMins: number, lateHrs: number) {
  // day_date + starts_at are IST wall-clock. Convert to a real instant.
  const startIST = new Date(`${day.day_date}T${day.starts_at}`);
  const start = new Date(startIST.getTime() - 5.5 * 3600 * 1000);
  const endIST = new Date(`${day.day_date}T${day.ends_at}`);
  let end = new Date(endIST.getTime() - 5.5 * 3600 * 1000);
  // A shift that ends before it starts crossed midnight.
  if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);

  return {
    opens: new Date(start.getTime() - openMins * 60 * 1000),
    closes: new Date(end.getTime() + lateHrs * 3600 * 1000),
    start,
    end,
  };
}

export async function getSettings(admin: SupabaseClient) {
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "attendance_checkin_window_mins",
      "attendance_late_checkin_hrs",
      "late_cancel_penalty",
    ]);
  const get = (k: string, d: number) => Number((data ?? []).find((s: any) => s.key === k)?.value ?? d);
  return {
    openMins: get("attendance_checkin_window_mins", 60),
    lateHrs: get("attendance_late_checkin_hrs", 12),
    penalty: get("late_cancel_penalty", 100),
  };
}

export interface PayoutBreakdown {
  totalPay: number;
  earned: number;
  totalHours: number;
  attendedHours: number;
  daysTotal: number;
  daysAttended: number;
  allResolved: boolean;
}

/**
 * What this worker has earned on this gig.
 *
 * Pay is advertised as a whole-gig figure (rate x duration on the gig record),
 * not rebuilt from the day rows — the day rows are how the work is scheduled,
 * and their hours can be edited after people have already applied. Paying from
 * them would silently change the deal. Days decide the *share* that was earned,
 * never the total.
 */
export async function computePayout(
  admin: SupabaseClient,
  applicationId: string,
): Promise<PayoutBreakdown | null> {
  const { data: app } = await admin
    .from("applications")
    .select("id, gig_id, worker_id, status, gigs(pay_rate, duration_hrs)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return null;

  const gig: any = Array.isArray(app.gigs) ? app.gigs[0] : app.gigs;
  const totalPay = Math.round(Number(gig?.pay_rate ?? 0) * Number(gig?.duration_hrs ?? 0));

  const { data: rows } = await admin
    .from("gig_attendance")
    .select("status, gig_day:gig_days(duration_hrs)")
    .eq("application_id", applicationId);

  const list = rows ?? [];
  let totalHours = 0;
  let attendedHours = 0;
  let daysAttended = 0;
  let allResolved = list.length > 0;

  for (const r of list as any[]) {
    const d = Array.isArray(r.gig_day) ? r.gig_day[0] : r.gig_day;
    const h = Number(d?.duration_hrs ?? 0);
    totalHours += h;
    if (PAID_STATUSES.includes(r.status)) {
      attendedHours += h;
      daysAttended += 1;
    }
    if (!RESOLVED.includes(r.status)) allResolved = false;
  }

  // If every scheduled day was worked, pay the advertised figure exactly —
  // never a rounded fraction of it that lands a rupee or two short.
  const earned =
    totalHours <= 0 ? 0
      : attendedHours >= totalHours ? totalPay
        : Math.round((totalPay * attendedHours) / totalHours);

  return {
    totalPay,
    earned,
    totalHours,
    attendedHours,
    daysTotal: list.length,
    daysAttended,
    allResolved,
  };
}

/**
 * Credits the wallet for a finished gig and closes the application.
 *
 * Idempotent on (reference_id, type): calling it twice pays once. That matters
 * because both the hirer confirming the last day and an admin settling by hand
 * can land here, sometimes within the same second.
 */
export async function settleGigPayout(
  admin: SupabaseClient,
  applicationId: string,
  opts: { amountOverride?: number; note?: string } = {},
): Promise<{ ok: boolean; reason?: string; amount?: number; alreadyPaid?: boolean }> {
  const breakdown = await computePayout(admin, applicationId);
  if (!breakdown) return { ok: false, reason: "not_found" };

  const amount = opts.amountOverride != null ? Math.round(opts.amountOverride) : breakdown.earned;
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: "bad_amount" };

  const { data: app } = await admin
    .from("applications")
    .select("id, worker_id, gig_id, gigs(title)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { ok: false, reason: "not_found" };

  const gig: any = Array.isArray(app.gigs) ? app.gigs[0] : app.gigs;

  const { data: existing } = await admin
    .from("wallet_transactions")
    .select("id, amount")
    .eq("reference_id", applicationId)
    .eq("type", "gig_earning")
    .maybeSingle();

  if (existing) {
    return { ok: true, amount: existing.amount, alreadyPaid: true };
  }

  if (amount > 0) {
    const { error } = await admin.from("wallet_transactions").insert({
      worker_id: app.worker_id,
      amount,
      type: "gig_earning",
      status: "completed",
      reference_id: applicationId,
      description: opts.note ?? `Earnings — ${gig?.title ?? "gig"}`,
    });
    if (error) return { ok: false, reason: error.message };
  }

  // Row counts, not the absence of an error: a refused update returns neither.
  const { data: updated } = await admin
    .from("applications")
    .update({ status: "completed", days_attended: breakdown.daysAttended })
    .eq("id", applicationId)
    .select("id");
  if (!updated?.length) return { ok: false, reason: "application_update_refused" };

  // Lifetime earnings and reliability are what the old single-shot
  // mark-attendance maintained. Losing them here would quietly degrade every
  // worker's profile, so they move across rather than being left behind.
  if (amount > 0) {
    const { data: p } = await admin
      .from("profiles").select("total_earned").eq("id", app.worker_id).maybeSingle();
    await admin.from("profiles")
      .update({ total_earned: (p?.total_earned ?? 0) + amount })
      .eq("id", app.worker_id);
  }

  if (breakdown.daysAttended > 0) {
    const { data: prof } = await admin
      .from("profiles").select("reliability_score").eq("id", app.worker_id).maybeSingle();
    await admin.from("profiles")
      .update({ reliability_score: Math.min(100, (prof?.reliability_score ?? 100) + 5) })
      .eq("id", app.worker_id);
    await admin.from("reliability_events").insert({
      worker_id: app.worker_id,
      event_type: "good_attendance",
      score_delta: 5,
      application_id: applicationId,
    });
  }

  await admin.from("notifications").insert({
    user_id: app.worker_id,
    type: "payment",
    title: `₹${amount} added to your wallet`,
    body: `${gig?.title ?? "Your gig"} is complete. Add your UPI ID and withdraw whenever you like.`,
    link: "/worker/earnings",
  });

  // The email is the part they actually see — most people never open the
  // notifications bell. It is sent last and its failure is swallowed, because
  // a mail server having a bad minute must not undo a payment that has already
  // been credited.
  try {
    await notifyPaid(admin, app.worker_id, gig?.title ?? "your gig", amount);
  } catch (e) {
    console.error("[attendance] payment email:", e);
  }

  return { ok: true, amount };
}

/**
 * Tells the worker their money has arrived, and what it is worth to them to
 * post a reel about the gig.
 *
 * Rates are read from app_settings rather than hardcoded so the email can never
 * promise a different number from the one the site pays.
 */
async function notifyPaid(
  admin: SupabaseClient,
  workerId: string,
  gigTitle: string,
  amount: number,
): Promise<void> {
  const [{ data: profile }, { data: settings }, { data: payout }] = await Promise.all([
    admin.from("profiles").select("email, full_name").eq("id", workerId).maybeSingle(),
    admin.from("app_settings").select("key, value"),
    admin.from("worker_bank_accounts").select("id").eq("worker_id", workerId).maybeSingle(),
  ]);

  if (!profile?.email) return;

  const get = (k: string, d: number) => Number((settings ?? []).find((x: any) => x.key === k)?.value ?? d);
  const mail = gigPaidEmail(profile.full_name || "there", {
    amount,
    gigTitle,
    minWithdrawal: get("min_withdrawal_amount", 150),
    perReel: get("reel_bonus_per_reel", 50),
    maxPerGig: get("reel_bonus_max_per_gig", 100),
    viewsBonus: get("reel_views_bonus", 50),
    viewsThreshold: get("reel_views_threshold", 3000),
    hasPayoutMethod: Boolean(payout),
  });

  await sendEmail({ to: profile.email, subject: mail.subject, html: mail.html });
}
