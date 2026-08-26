import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { settleReferralForCompletedGig } from "~/lib/referrals.server";
import {
  ensureAttendanceRows, checkinWindow, getSettings, computePayout, settleGigPayout,
  type GigDay,
} from "~/lib/attendance.server";

/**
 * Every attendance action, one endpoint.
 *
 * Who may do what is decided here rather than in RLS, because the rules are
 * relational ("the organizer of the gig this day belongs to") and change
 * meaning depending on the intent. Each branch re-reads the row it is about to
 * touch and checks the caller against it — no branch trusts an id from the
 * client to imply permission.
 */

const MAX_SELFIE_BYTES = 4 * 1024 * 1024;

export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = serviceClient();
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  // Admin is profiles.is_admin, not a role string — and a suspended admin is
  // not an admin. This mirrors requireAdmin() rather than inventing a second,
  // weaker definition of the same thing.
  const { data: me } = await admin
    .from("profiles").select("id, is_admin, is_suspended, full_name").eq("id", user.id).maybeSingle();
  const isAdmin = Boolean(me?.is_admin) && !me?.is_suspended;

  switch (intent) {
    case "sync": return sync(admin, user.id, fd, isAdmin);
    case "checkin": return checkin(admin, user.id, fd);
    case "confirm":
    case "absent":
    case "excused": return decide(admin, user.id, fd, intent, isAdmin);
    case "settle": return settle(admin, user.id, fd, isAdmin);
    default:
      return Response.json({ error: "Unknown intent" }, { status: 400 });
  }
});

/**
 * Creates the attendance rows for a gig's accepted workers.
 *
 * Called by the hirer's roster view rather than at accept time, so gigs that
 * were filled before any of this existed — every gig currently in the
 * database — get their rows the first time someone looks.
 */
async function sync(admin: any, callerId: string, fd: FormData, isAdmin: boolean) {
  const gigId = String(fd.get("gig_id") ?? "");
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const { data: gig } = await admin
    .from("gigs").select("id, organizer_id").eq("id", gigId).maybeSingle();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.organizer_id !== callerId && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data: apps } = await admin
    .from("applications")
    .select("id, worker_id")
    .eq("gig_id", gigId)
    .in("status", ["accepted", "completed"]);

  for (const a of apps ?? []) {
    await ensureAttendanceRows(admin, a.id, a.worker_id, gigId);
  }
  return Response.json({ ok: true, synced: apps?.length ?? 0 });
}

/**
 * Worker marks themselves present for one day, with a selfie.
 *
 * The photo is uploaded here rather than from the browser so the check-in and
 * its proof land together — a client-side upload that succeeds followed by a
 * check-in that fails leaves an orphaned photo of someone with nothing
 * pointing at it.
 */
async function checkin(admin: any, callerId: string, fd: FormData) {
  const attendanceId = String(fd.get("attendance_id") ?? "");
  const selfie = fd.get("selfie");
  if (!attendanceId) return Response.json({ error: "Missing attendance_id" }, { status: 400 });
  if (!(selfie instanceof File) || selfie.size === 0) {
    return Response.json({ error: "A photo is required to check in." }, { status: 400 });
  }
  if (selfie.size > MAX_SELFIE_BYTES) {
    return Response.json({ error: "That photo is too large — try again, it should shrink automatically." }, { status: 400 });
  }
  if (!selfie.type.startsWith("image/")) {
    return Response.json({ error: "That file isn't an image." }, { status: 400 });
  }

  const { data: row } = await admin
    .from("gig_attendance")
    .select("id, worker_id, status, worker_marked_at, gig_day:gig_days(id, day_number, day_date, starts_at, ends_at, duration_hrs)")
    .eq("id", attendanceId)
    .maybeSingle();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.worker_id !== callerId) return Response.json({ error: "Unauthorized" }, { status: 403 });
  if (row.worker_marked_at) return Response.json({ error: "You've already checked in for this day." }, { status: 400 });
  if (row.status === "absent") {
    return Response.json({ error: "This day is marked absent. Ask the hirer to reopen it." }, { status: 400 });
  }

  const day = (Array.isArray(row.gig_day) ? row.gig_day[0] : row.gig_day) as GigDay;
  const { openMins, lateHrs } = await getSettings(admin);
  const win = checkinWindow(day, openMins, lateHrs);
  const now = new Date();
  if (now < win.opens) {
    return Response.json({
      error: `Too early — check-in opens ${openMins} minutes before the shift starts.`,
    }, { status: 400 });
  }
  if (now > win.closes) {
    return Response.json({
      error: "Check-in for this day has closed. Ask the hirer to mark you present.",
    }, { status: 400 });
  }

  const ext = (selfie.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${callerId}/${attendanceId}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("attendance-proof")
    .upload(path, await selfie.arrayBuffer(), { contentType: selfie.type, upsert: false });
  if (upErr) return Response.json({ error: `Couldn't save the photo: ${upErr.message}` }, { status: 500 });

  // The CHECK constraint refuses worker_marked_at without a selfie, so the
  // photo has to exist before this runs — which is why the upload is first.
  const { data: updated, error } = await admin
    .from("gig_attendance")
    .update({
      worker_marked_at: now.toISOString(),
      worker_selfie_url: path,
      status: "worker_marked",
    })
    .eq("id", attendanceId)
    .select("id, status, worker_marked_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!updated?.length) {
    await admin.storage.from("attendance-proof").remove([path]);
    return Response.json({ error: "The check-in was refused. Nothing was saved." }, { status: 500 });
  }

  return Response.json({ ok: true, status: "worker_marked" });
}

/**
 * Hirer (or admin) settles one day: confirm, absent, or excused.
 *
 * Confirming without the worker having marked in is allowed, because the hirer
 * standing in front of them is better evidence than the app — someone whose
 * phone died still worked. It is recorded as confirmed_by so the two cases are
 * distinguishable afterwards.
 */
async function decide(admin: any, callerId: string, fd: FormData, intent: string, isAdmin: boolean) {
  const attendanceId = String(fd.get("attendance_id") ?? "");
  const punctuality = String(fd.get("punctuality") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!attendanceId) return Response.json({ error: "Missing attendance_id" }, { status: 400 });

  const { data: row } = await admin
    .from("gig_attendance")
    .select("id, application_id, worker_id, status, gig_day:gig_days(id, gig_id)")
    .eq("id", attendanceId)
    .maybeSingle();
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  const day: any = Array.isArray(row.gig_day) ? row.gig_day[0] : row.gig_day;
  const { data: gig } = await admin
    .from("gigs").select("id, organizer_id, title").eq("id", day.gig_id).maybeSingle();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.organizer_id !== callerId && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const patch: Record<string, any> = {
    status: intent === "confirm" ? "confirmed" : intent === "absent" ? "absent" : "excused",
    confirmed_by: callerId,
    resolved_by: isAdmin ? callerId : null,
    resolved_at: new Date().toISOString(),
  };
  if (intent === "confirm") {
    patch.confirmed_at = new Date().toISOString();
    if (punctuality === "on_time" || punctuality === "late") patch.punctuality = punctuality;
  } else {
    // Clearing it keeps "confirmed at" honest if a day is later reopened.
    patch.confirmed_at = null;
    if (note) patch.dispute_note = note;
  }

  let { data: updated, error } = await admin
    .from("gig_attendance").update(patch).eq("id", attendanceId).select("id, status");

  // punctuality arrives with migration 020. If a deploy lands before the
  // migration is run, recording that someone turned up matters far more than
  // recording whether they were late — so drop the field and try again rather
  // than failing the confirmation outright.
  if (error && /punctuality/.test(error.message ?? "")) {
    const { punctuality, ...rest } = patch;
    ({ data: updated, error } = await admin
      .from("gig_attendance").update(rest).eq("id", attendanceId).select("id, status"));
  }

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!updated?.length) {
    return Response.json({ error: "That update was refused — nothing changed." }, { status: 500 });
  }

  const breakdown = await computePayout(admin, row.application_id);
  return Response.json({ ok: true, status: updated[0].status, breakdown });
}

/**
 * Pays a worker for the gig, once every day has been settled.
 *
 * The hirer can trigger this; an admin can also override the amount, which is
 * the escape hatch for the cases the arithmetic cannot know about — a day that
 * was scheduled but called off, or a rate agreed off-platform.
 */
async function settle(admin: any, callerId: string, fd: FormData, isAdmin: boolean) {
  const applicationId = String(fd.get("application_id") ?? "");
  const rawOverride = fd.get("amount");
  if (!applicationId) return Response.json({ error: "Missing application_id" }, { status: 400 });

  const { data: app } = await admin
    .from("applications")
    .select("id, worker_id, gig_id, status, gigs(organizer_id, title)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return Response.json({ error: "not_found" }, { status: 404 });

  const gig: any = Array.isArray(app.gigs) ? app.gigs[0] : app.gigs;
  if (gig?.organizer_id !== callerId && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const breakdown = await computePayout(admin, applicationId);
  if (!breakdown) return Response.json({ error: "not_found" }, { status: 404 });

  // Only an admin may pay an amount the attendance record does not support,
  // and only an admin may pay before every day is settled.
  let amountOverride: number | undefined;
  if (rawOverride != null && String(rawOverride) !== "") {
    if (!isAdmin) return Response.json({ error: "Unauthorized" }, { status: 403 });
    amountOverride = Math.round(Number(rawOverride));
    if (!Number.isFinite(amountOverride) || amountOverride < 0) {
      return Response.json({ error: "Enter a valid amount." }, { status: 400 });
    }
  }
  if (!breakdown.allResolved && !isAdmin) {
    return Response.json({
      error: "Some days are still unmarked. Confirm every day before paying.",
    }, { status: 400 });
  }

  const result = await settleGigPayout(admin, applicationId, {
    amountOverride,
    note: `Earnings — ${gig?.title ?? "gig"}`,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: 500 });

  // The referral pays out on the referred person's first *worked* gig, so it
  // hangs off this moment rather than off signup. A failure here must not undo
  // the wage that was just credited.
  let referral: any = null;
  if (!result.alreadyPaid) {
    try {
      referral = await settleReferralForCompletedGig(admin, app.worker_id, applicationId);
    } catch {
      referral = { paid: false, reason: "errored" };
    }
  }

  return Response.json({
    ok: true,
    amount: result.amount,
    alreadyPaid: result.alreadyPaid ?? false,
    breakdown,
    referral,
  });
}
