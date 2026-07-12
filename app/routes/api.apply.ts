import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { sendEmail, applicationAcceptedEmail, waitlistEmail } from "~/lib/email.server";

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
  const gigId = formData.get("gig_id") as string;
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const admin = adminClient();

  // ID verification is required before a worker's first (and every) application
  const { data: workerProfile } = await admin
    .from("profiles")
    .select("id_verified, is_suspended")
    .eq("id", user.id)
    .single();
  if (workerProfile?.is_suspended) {
    return Response.json({ error: "account_suspended" }, { status: 403 });
  }
  if (!workerProfile?.id_verified) {
    return Response.json({ error: "id_verification_required" }, { status: 403 });
  }

  // Validate the gig is still joinable ('open' or 'filled' — filled gigs go to waitlist)
  const { data: gigCheck } = await admin
    .from("gigs")
    .select("id, status, event_date")
    .eq("id", gigId)
    .single();

  if (!gigCheck) return Response.json({ error: "Gig not found" }, { status: 404 });
  if (!["open", "filled"].includes(gigCheck.status)) {
    return Response.json({ error: "This gig is no longer accepting applications" }, { status: 400 });
  }
  if (new Date(gigCheck.event_date) <= new Date()) {
    return Response.json({ error: "This gig has already started" }, { status: 400 });
  }

  // Check for existing active application
  const { data: existing } = await admin
    .from("applications")
    .select("id, status")
    .eq("gig_id", gigId)
    .eq("worker_id", user.id)
    .not("status", "eq", "cancelled")
    .maybeSingle();

  if (existing) {
    return Response.json({ error: "already_applied" }, { status: 400 });
  }

  // INSERT with status 'pending' — the BEFORE INSERT trigger handles FCFS:
  //   slots available → sets status='accepted', increments gig.slots_filled
  //   slots full      → keeps status='pending', sets waitlist_position
  const { data: newApp, error } = await admin
    .from("applications")
    .insert({ gig_id: gigId, worker_id: user.id, status: "pending" })
    .select("id, status, waitlist_position")
    .single();

  if (error || !newApp) {
    return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  const isAccepted = newApp.status === "accepted";
  const isWaitlisted = newApp.status === "pending" && newApp.waitlist_position != null;

  // Fire email async — don't block the response
  (async () => {
    try {
      const [{ data: gig }, { data: profile }] = await Promise.all([
        admin.from("gigs").select("title, event_date, location_text, pay_rate, duration_hrs, role_type").eq("id", gigId).single(),
        admin.from("profiles").select("full_name").eq("id", user.id).single(),
      ]);
      const name = profile?.full_name || "there";

      if (isAccepted && gig && user.email) {
        const tpl = applicationAcceptedEmail(name, gig);
        await sendEmail({ to: user.email, ...tpl });
      } else if (isWaitlisted && gig && user.email) {
        const tpl = waitlistEmail(name, gig.title, newApp.waitlist_position!);
        await sendEmail({ to: user.email, ...tpl });
      }
    } catch (e) {
      console.error("[api.apply] email error:", e);
    }
  })();

  return Response.json({
    status: isAccepted ? "accepted" : "waitlisted",
    waitlist_position: newApp.waitlist_position ?? null,
  });
}
