import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { sendEmail } from "~/lib/email.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Hirer posts a gig-scoped announcement → stored on the gig, fanned out as
// in-app notifications + backup emails to the chosen audience.
export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const gigId = formData.get("gig_id") as string;
  const message = ((formData.get("message") as string) || "").trim();
  const audience = formData.get("audience") as string;

  if (!gigId || !message || !["confirmed", "all_applicants"].includes(audience)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (message.length > 1000) {
    return Response.json({ error: "Announcement too long (max 1000 characters)" }, { status: 400 });
  }

  const admin = adminClient();

  // Verify ownership
  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, organizer_id, profiles!gigs_organizer_id_fkey(full_name, company_name)")
    .eq("id", gigId)
    .single();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.organizer_id !== user.id) return Response.json({ error: "Unauthorized" }, { status: 403 });

  // Store the announcement
  const { data: ann, error: annErr } = await admin
    .from("gig_announcements")
    .insert({ gig_id: gigId, organizer_id: user.id, message, audience })
    .select("id")
    .single();
  if (annErr) return Response.json({ error: annErr.message }, { status: 500 });

  // Resolve recipients
  let appQuery = admin
    .from("applications")
    .select("worker_id")
    .eq("gig_id", gigId);
  if (audience === "confirmed") appQuery = appQuery.eq("status", "accepted");
  else appQuery = appQuery.in("status", ["accepted", "pending"]);
  const { data: apps } = await appQuery;
  const workerIds = [...new Set((apps || []).map(a => a.worker_id))];

  const orgProfile = Array.isArray(gig.profiles) ? gig.profiles[0] : gig.profiles;
  const hirerName = orgProfile?.company_name || orgProfile?.full_name || "Your hirer";
  const title = `Announcement from ${hirerName} — ${gig.title}`;

  // In-app notifications
  if (workerIds.length > 0) {
    await admin.from("notifications").insert(
      workerIds.map(id => ({
        user_id: id,
        type: "announcement",
        title,
        body: message.slice(0, 200),
        link: `/gigs/${gigId}`,
      }))
    );
  }

  // Backup emails — async, don't block the response
  (async () => {
    try {
      for (const workerId of workerIds) {
        const { data: au } = await admin.auth.admin.getUserById(workerId);
        const email = au?.user?.email;
        if (!email) continue;
        await sendEmail({
          to: email,
          subject: `📢 ${title}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
              <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
              <h2 style="margin-top:0;">📢 Announcement</h2>
              <p style="color:#9ca3af;">From <strong style="color:#fff;">${hirerName}</strong> about <strong style="color:#fff;">${gig.title}</strong>:</p>
              <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;">${message}</div>
              <p style="color:#9ca3af;font-size:13px;">Open the gig on GigDekho for full details.</p>
            </div>`,
        });
      }
    } catch (e) {
      console.error("[api.announce] email error:", e);
    }
  })();

  return Response.json({ ok: true, id: ann.id, recipients: workerIds.length });
}
