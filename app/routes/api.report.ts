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

const CATEGORIES = ["safety", "fraud", "payment", "behaviour", "spam", "no_show", "other"];
const TARGETS = ["user", "gig", "application", "message", "other"];

// Safety and fraud jump the queue automatically
const PRIORITY: Record<string, string> = { safety: "urgent", fraud: "high", payment: "high" };

export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to report an issue." }, { status: 401 });

  const fd = await request.formData();
  const category = String(fd.get("category") ?? "");
  const targetType = String(fd.get("target_type") ?? "other");
  const targetId = String(fd.get("target_id") ?? "") || null;
  const subject = String(fd.get("subject") ?? "").trim().slice(0, 160);
  const description = String(fd.get("description") ?? "").trim().slice(0, 4000);

  if (!CATEGORIES.includes(category)) return Response.json({ error: "Pick a category." }, { status: 400 });
  if (!TARGETS.includes(targetType)) return Response.json({ error: "Invalid target." }, { status: 400 });
  if (description.length < 10) {
    return Response.json({ error: "Please describe what happened in a bit more detail." }, { status: 400 });
  }

  const admin = adminClient();
  const priority = PRIORITY[category] ?? "normal";

  const { data: created, error } = await admin.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    category,
    subject: subject || null,
    description,
    priority,
  }).select("id").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Notify every admin in-app, and email on the serious ones
  (async () => {
    try {
      const { data: admins } = await admin.from("profiles").select("id, email").eq("is_admin", true);
      const { data: reporter } = await admin.from("profiles").select("full_name").eq("id", user.id).single();

      if (admins?.length) {
        await admin.from("notifications").insert(
          admins.map((a) => ({
            user_id: a.id,
            type: "report",
            title: `${priority === "urgent" ? "🚨 " : ""}New ${category} report`,
            body: `${reporter?.full_name ?? "A user"}: ${description.slice(0, 150)}`,
            link: "/admin/reports",
          }))
        );

        if (priority === "urgent" || priority === "high") {
          for (const a of admins) {
            if (!a.email) continue;
            await sendEmail({
              to: a.email,
              subject: `${priority === "urgent" ? "🚨 URGENT" : "⚠️"} ${category} report on GigDekho`,
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
                  <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
                  <h2 style="margin-top:0;">New ${category} report</h2>
                  <p style="color:#9ca3af;">From <strong style="color:#fff;">${reporter?.full_name ?? "a user"}</strong></p>
                  ${subject ? `<p style="color:#fff;font-weight:bold;">${subject}</p>` : ""}
                  <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;color:#d1d5db;white-space:pre-wrap;">${description}</div>
                  <p style="color:#9ca3af;font-size:13px;">Open the admin panel to triage it.</p>
                </div>`,
            });
          }
        }
      }
    } catch (e) {
      console.error("[api.report] notify:", e);
    }
  })();

  return Response.json({ ok: true, id: created.id });
}
