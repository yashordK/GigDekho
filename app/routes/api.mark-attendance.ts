import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { syncGigSheet } from "~/lib/sheet-sync.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const applicationId = formData.get("application_id") as string;
  if (!applicationId) return Response.json({ error: "Missing application_id" }, { status: 400 });

  const admin = adminClient();

  // Verify the caller is the organizer of this gig
  const { data: app } = await admin
    .from("applications")
    .select("id, status, worker_id, gigs(organizer_id, title, pay_rate, duration_hrs)")
    .eq("id", applicationId)
    .single();

  if (!app) return Response.json({ error: "not_found" }, { status: 404 });

  const gig = app.gigs as any;
  if (gig?.organizer_id !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (app.status !== "accepted") {
    return Response.json({ error: "Application is not in accepted state" }, { status: 400 });
  }

  // Mark as completed
  const { error: updateErr } = await admin
    .from("applications")
    .update({ status: "completed" })
    .eq("id", applicationId);

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

  // +5 reliability score (capped at 100)
  const { data: prof } = await admin
    .from("profiles")
    .select("reliability_score")
    .eq("id", app.worker_id)
    .single();

  const newScore = Math.min(100, (prof?.reliability_score ?? 100) + 5);
  await admin.from("profiles").update({ reliability_score: newScore }).eq("id", app.worker_id);

  // Audit trail
  await admin.from("reliability_events").insert({
    worker_id: app.worker_id,
    event_type: "good_attendance",
    score_delta: 5,
    application_id: applicationId,
  });

  // Credit earnings to the worker's wallet (idempotent per application)
  const earning = Math.round((gig.pay_rate || 0) * (gig.duration_hrs || 0));
  if (earning > 0) {
    const { data: existingCredit } = await admin
      .from("wallet_transactions")
      .select("id")
      .eq("reference_id", applicationId)
      .eq("type", "gig_earning")
      .maybeSingle();
    if (!existingCredit) {
      await admin.from("wallet_transactions").insert({
        worker_id: app.worker_id,
        amount: earning,
        type: "gig_earning",
        status: "completed",
        reference_id: applicationId,
        description: `Earnings — ${gig.title}`,
      });
      const { data: p } = await admin.from("profiles").select("total_earned").eq("id", app.worker_id).single();
      await admin.from("profiles").update({ total_earned: (p?.total_earned || 0) + earning }).eq("id", app.worker_id);
    }
  }

  // Attendance changes the worker's status — mirror it into the sheet if one exists
  const { data: appGig } = await admin
    .from("applications").select("gig_id").eq("id", applicationId).single();
  if (appGig?.gig_id) {
    syncGigSheet(admin, appGig.gig_id, { createIfMissing: false })
      .catch((e) => console.error("[api.mark-attendance] sheet sync:", e));
  }

  return Response.json({ ok: true });
}
