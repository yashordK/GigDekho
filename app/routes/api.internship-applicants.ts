import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { syncGigSheet } from "~/lib/sheet-sync.server";
import { sheetsConfigured } from "~/lib/google-sheets.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const VALID_STATUS = ["submitted", "shortlisted", "interviewing", "hired", "rejected"];

/**
 * Hirer-side actions on internship applicants:
 *   intent=status  → move a candidate through the pipeline (then re-sync the sheet)
 *   intent=sync    → create the Google Sheet if needed and push all rows
 */
export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await request.formData();
  const intent = (fd.get("intent") as string) || "status";
  const gigId = (fd.get("gig_id") as string) || "";
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const admin = adminClient();

  // Ownership check — the caller must own the listing
  const { data: gig } = await admin
    .from("gigs")
    .select("id, organizer_id, gig_type")
    .eq("id", gigId)
    .single();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.organizer_id !== user.id) return Response.json({ error: "Unauthorized" }, { status: 403 });

  if (intent === "sync") {
    if (!sheetsConfigured()) {
      return Response.json({ error: "sheets_not_configured" }, { status: 400 });
    }
    const result = await syncGigSheet(admin, gigId);
    if (!result.ok) {
      return Response.json({ error: result.reason === "error" ? result.error : result.reason }, { status: 500 });
    }
    return Response.json({ ok: true, url: result.url, rows: result.rows });
  }

  // intent === "status"
  const applicationId = (fd.get("application_id") as string) || "";
  const status = (fd.get("status") as string) || "";
  if (!applicationId || !VALID_STATUS.includes(status)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { error } = await admin
    .from("internship_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("gig_id", gigId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Let the applicant know when they move forward or are closed out
  (async () => {
    try {
      const { data: app } = await admin
        .from("internship_applications")
        .select("applicant_id, gig_id")
        .eq("id", applicationId)
        .single();
      const { data: listing } = await admin.from("gigs").select("title").eq("id", gigId).single();
      const copy: Record<string, string> = {
        shortlisted: "You've been shortlisted",
        interviewing: "You're moving to the interview stage",
        hired: "You got the role! 🎉",
        rejected: "Update on your application",
      };
      if (app && copy[status]) {
        await admin.from("notifications").insert({
          user_id: app.applicant_id,
          type: "internship_status",
          title: `${copy[status]} — ${listing?.title ?? "your application"}`,
          body: status === "rejected"
            ? "The hirer has closed your application for this listing. Keep applying — more listings go up daily."
            : "Open the listing to see the details.",
          link: `/gigs/${gigId}`,
        });
      }
      await syncGigSheet(admin, gigId);
    } catch (e) {
      console.error("[api.internship-applicants] post-update:", e);
    }
  })();

  return Response.json({ ok: true });
}
