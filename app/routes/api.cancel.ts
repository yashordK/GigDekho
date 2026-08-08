import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { sendEmail, cancellationConfirmEmail, promotedFromWaitlistEmail } from "~/lib/email.server";
import { syncGigSheet } from "~/lib/sheet-sync.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function calcPenalty(eventDate: string): { points: number; reason: string } {
  const h = (new Date(eventDate).getTime() - Date.now()) / 3600000;
  if (h < 6)  return { points: 15, reason: "cancel_within_24hrs" };
  if (h < 24) return { points: 5,  reason: "cancel_24_to_48hrs" };
  return       { points: 0,  reason: "cancel_48hrs_plus" };
}

export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const appId = formData.get("app_id") as string;
  if (!appId) return Response.json({ error: "Missing app_id" }, { status: 400 });

  const admin = adminClient();

  // 1. Fetch the application + gig info
  const { data: app } = await admin
    .from("applications")
    .select("id, status, gig_id, waitlist_position, gigs(event_date, title, pay_rate, duration_hrs, location_text)")
    .eq("id", appId)
    .eq("worker_id", user.id)
    .single();

  if (!app) return Response.json({ error: "not_found" }, { status: 404 });
  if (!["accepted", "pending"].includes(app.status)) {
    return Response.json({ error: "not_cancellable" }, { status: 400 });
  }

  const gig = app.gigs as any;
  const { points: penalty, reason } = calcPenalty(gig.event_date);

  // 2. If cancelling an ACCEPTED spot: find the #1 waitlisted person NOW (before trigger fires)
  //    The promote_next_waitlist trigger will auto-promote them when we update to 'cancelled'
  let nextWaitlistWorkerId: string | null = null;
  if (app.status === "accepted") {
    const { data: nextWait } = await admin
      .from("applications")
      .select("worker_id")
      .eq("gig_id", app.gig_id)
      .eq("status", "pending")
      .not("waitlist_position", "is", null)
      .order("waitlist_position", { ascending: true })
      .limit(1)
      .maybeSingle();
    nextWaitlistWorkerId = nextWait?.worker_id ?? null;
  }

  // 3. Cancel — the AFTER UPDATE trigger (promote_next_waitlist) handles:
  //    • decrementing gig.slots_filled
  //    • promoting the next pending (waitlisted) applicant
  //    • re-opening gig status if it was 'filled'
  await admin.from("applications").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason,
    cancellation_penalty: penalty,
  }).eq("id", appId);

  // 4. Apply reliability penalty (only for accepted cancellations)
  if (penalty > 0 && app.status === "accepted") {
    const { data: prof } = await admin
      .from("profiles")
      .select("reliability_score")
      .eq("id", user.id)
      .single();
    const newScore = Math.max(0, (prof?.reliability_score ?? 100) - penalty);
    await admin.from("profiles").update({ reliability_score: newScore }).eq("id", user.id);

    // Audit trail
    await admin.from("reliability_events").insert({
      worker_id: user.id,
      event_type: reason,
      score_delta: -penalty,
      application_id: appId,
    });
  }

  // 5. Send emails async
  (async () => {
    try {
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
      const name = prof?.full_name || "there";

      if (user.email) {
        const tpl = cancellationConfirmEmail(name, gig.title, penalty);
        await sendEmail({ to: user.email, ...tpl });
      }

      // Email the promoted worker (if any)
      if (nextWaitlistWorkerId) {
        const [{ data: promotedAuth }, { data: promotedProf }] = await Promise.all([
          admin.auth.admin.getUserById(nextWaitlistWorkerId),
          admin.from("profiles").select("full_name").eq("id", nextWaitlistWorkerId).single(),
        ]);
        const promotedEmail = promotedAuth?.user?.email;
        if (promotedEmail) {
          const tpl = promotedFromWaitlistEmail(promotedProf?.full_name || "there", gig);
          await sendEmail({ to: promotedEmail, ...tpl });
        }
      }
      // Reflect the cancellation + any waitlist promotion in the hirer's sheet
      await syncGigSheet(admin, app.gig_id, { createIfMissing: false });
    } catch (e) {
      console.error("[api.cancel] email error:", e);
    }
  })();

  return Response.json({ penalty, promoted: !!nextWaitlistWorkerId });
}
