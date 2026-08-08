import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { sendEmail } from "~/lib/email.server";
import { syncGigSheet } from "~/lib/sheet-sync.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const str = (fd: FormData, key: string, max = 2000) =>
  ((fd.get(key) as string) || "").trim().slice(0, max);

export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await request.formData();
  const gigId = str(fd, "gig_id", 64);
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const admin = adminClient();

  // Suspended accounts can't apply. (ID verification is intentionally NOT
  // required here — internship candidates are judged on their application,
  // and gating a resume submission behind an Aadhaar upload kills conversion.)
  const { data: me } = await admin
    .from("profiles")
    .select("is_suspended")
    .eq("id", user.id)
    .single();
  if (me?.is_suspended) return Response.json({ error: "account_suspended" }, { status: 403 });

  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, gig_type, status, organizer_id, application_deadline")
    .eq("id", gigId)
    .single();
  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.gig_type !== "internship") {
    return Response.json({ error: "This listing doesn't accept applications here." }, { status: 400 });
  }
  if (gig.status !== "open") {
    return Response.json({ error: "This listing is no longer accepting applications." }, { status: 400 });
  }
  if (gig.application_deadline && new Date(gig.application_deadline) < new Date()) {
    return Response.json({ error: "The application deadline has passed." }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("internship_applications")
    .select("id")
    .eq("gig_id", gigId)
    .eq("applicant_id", user.id)
    .maybeSingle();
  if (existing) return Response.json({ error: "already_applied" }, { status: 400 });

  const fullName = str(fd, "full_name", 120);
  const email = str(fd, "email", 160);
  const phone = str(fd, "phone", 20);

  if (!fullName) return Response.json({ error: "Your name is required." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[+]?[\d\s-]{10,15}$/.test(phone)) {
    return Response.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const gradYearRaw = str(fd, "graduation_year", 8);
  const graduationYear = /^\d{4}$/.test(gradYearRaw) ? Number(gradYearRaw) : null;

  const { data: created, error } = await admin
    .from("internship_applications")
    .insert({
      gig_id: gigId,
      applicant_id: user.id,
      full_name: fullName,
      email,
      phone,
      qualification: str(fd, "qualification", 80) || null,
      institution: str(fd, "institution", 160) || null,
      degree_domain: str(fd, "degree_domain", 160) || null,
      graduation_year: graduationYear,
      about: str(fd, "about", 1200) || null,
      why_you: str(fd, "why_you", 1200) || null,
      resume_url: str(fd, "resume_url", 600) || null,
      portfolio_url: str(fd, "portfolio_url", 600) || null,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Notify the hirer + push to their live sheet. Neither should block the
  // applicant's response, so they run detached.
  (async () => {
    try {
      await admin.from("notifications").insert({
        user_id: gig.organizer_id,
        type: "internship_application",
        title: `New application for "${gig.title}"`,
        body: `${fullName}${graduationYear ? ` · ${graduationYear} grad` : ""} applied.`,
        link: `/organizer/home`,
      });

      const { data: au } = await admin.auth.admin.getUserById(gig.organizer_id);
      const hirerEmail = au?.user?.email;
      if (hirerEmail) {
        await sendEmail({
          to: hirerEmail,
          subject: `📄 New application: ${gig.title} — GigDekho`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
              <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
              <h2 style="margin-top:0;">New application received</h2>
              <p style="color:#9ca3af;"><strong style="color:#fff;">${fullName}</strong> applied for <strong style="color:#fff;">${gig.title}</strong>.</p>
              <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;color:#9ca3af;font-size:14px;">
                <div>📧 ${email}</div>
                <div>📱 ${phone}</div>
                ${graduationYear ? `<div>🎓 Graduating ${graduationYear}</div>` : ""}
              </div>
              <p style="color:#9ca3af;font-size:13px;">Open your GigDekho dashboard to review the full application, or check your live applicant sheet.</p>
            </div>`,
        });
      }

      await syncGigSheet(admin, gigId);
    } catch (e) {
      console.error("[api.apply-internship] post-submit tasks:", e);
    }
  })();

  return Response.json({ ok: true, id: created.id });
}
