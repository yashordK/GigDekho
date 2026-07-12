import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { detectContactInfo } from "~/lib/contact-filter";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Post a question (applicant) or reply (hirer or applicant) on a gig's Q&A thread.
// Server is the authority for: participation check, contact-info filter,
// auto-lock after the event date, and notifying the hirer of new questions.
export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const gigId = formData.get("gig_id") as string;
  const parentId = (formData.get("parent_id") as string) || null;
  const body = ((formData.get("body") as string) || "").trim();

  if (!gigId || !body) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (body.length > 1000) return Response.json({ error: "Message too long (max 1000 characters)" }, { status: 400 });

  // Contact-info filter — block, never store
  const detected = detectContactInfo(body);
  if (detected) {
    return Response.json(
      { error: `Message blocked — it looks like it contains a ${detected}. Contact details can't be shared here.` },
      { status: 422 }
    );
  }

  const admin = adminClient();

  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, organizer_id, event_date")
    .eq("id", gigId)
    .single();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });

  // Auto-lock once the event date has passed
  if (new Date(gig.event_date) <= new Date()) {
    return Response.json({ error: "This thread is locked — the gig date has passed." }, { status: 400 });
  }

  const isOrganizer = gig.organizer_id === user.id;
  if (!isOrganizer) {
    // Must have applied (any status) to participate
    const { data: app } = await admin
      .from("applications")
      .select("id")
      .eq("gig_id", gigId)
      .eq("worker_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!app) return Response.json({ error: "Apply to this gig to join the Q&A." }, { status: 403 });
  }

  const { data: msg, error } = await admin
    .from("gig_questions")
    .insert({ gig_id: gigId, author_id: user.id, parent_id: parentId, body })
    .select("id, created_at")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Notify the hirer of new worker questions (not their own replies)
  if (!isOrganizer && !parentId) {
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", user.id).single();
    await admin.from("notifications").insert({
      user_id: gig.organizer_id,
      type: "qa_question",
      title: `New question on "${gig.title}"`,
      body: `${prof?.full_name || "A worker"}: ${body.slice(0, 150)}`,
      link: `/gigs/${gigId}`,
    });
  }

  return Response.json({ ok: true, id: msg.id });
}
