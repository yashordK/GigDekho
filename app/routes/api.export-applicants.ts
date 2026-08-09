import { type LoaderFunctionArgs, type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { buildApplicantReport } from "~/lib/applicant-report.server";
import { buildXlsx } from "~/lib/xlsx.server";
import { sendEmail } from "~/lib/email.server";
import { syncGigSheet } from "~/lib/sheet-sync.server";
import { sheetsConfigured } from "~/lib/google-sheets.server";

/** Verifies the caller owns the listing, then returns an admin client + report. */
async function authorize(request: Request, gigId: string) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = serviceClient();
  const { data: gig } = await admin
    .from("gigs").select("id, organizer_id").eq("id", gigId).single();
  if (!gig) return { error: Response.json({ error: "not_found" }, { status: 404 }) };
  if (gig.organizer_id !== user.id) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 403 }) };
  }
  return { admin, user };
}

const safeFilename = (s: string) =>
  s.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "applicants";

// ── GET: download the applicant list as a real .xlsx ────────────────
export async function loader({ request }: LoaderFunctionArgs) {
  const gigId = new URL(request.url).searchParams.get("gig_id") ?? "";
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const auth = await authorize(request, gigId);
  if (auth.error) return auth.error;

  const report = await buildApplicantReport(auth.admin!, gigId);
  if (!report) return Response.json({ error: "not_found" }, { status: 404 });

  const buffer = buildXlsx({
    name: report.gigType === "internship" ? "Applicants" : "Volunteers",
    headers: report.headers,
    rows: report.rows,
    widths: report.widths,
  });

  const label = report.gigType === "internship" ? "applicants" : "volunteers";
  const filename = `gigdekho-${label}-${safeFilename(report.gigTitle)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}

// ── POST: email the hirer their live sheet link ────────────────────
export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  // A malformed body is the caller's mistake, not a server fault — parsing it
  // unguarded turned a bad request into a 500 in the error logs.
  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return Response.json({ error: "Expected form data." }, { status: 400 });
  }
  const gigId = (fd.get("gig_id") as string) ?? "";
  if (!gigId) return Response.json({ error: "Missing gig_id" }, { status: 400 });

  const auth = await authorize(request, gigId);
  if (auth.error) return auth.error;
  const admin = auth.admin!;

  if (!sheetsConfigured()) {
    return Response.json({ error: "sheets_not_configured" }, { status: 400 });
  }

  // Make sure the sheet exists and is current before we send the link
  const sync = await syncGigSheet(admin, gigId);
  if (!sync.ok) {
    return Response.json(
      { error: sync.reason === "error" ? sync.error : sync.reason },
      { status: 500 }
    );
  }

  const report = await buildApplicantReport(admin, gigId);
  const { data: au } = await admin.auth.admin.getUserById(auth.user!.id);
  const email = au?.user?.email;
  if (!email) return Response.json({ error: "No email on your account" }, { status: 400 });

  const label = report?.gigType === "internship" ? "applicants" : "volunteers";
  await sendEmail({
    to: email,
    subject: `📊 Your ${label} sheet — ${report?.gigTitle ?? "GigDekho"}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2 style="margin-top:0;">Your live ${label} sheet</h2>
        <p style="color:#9ca3af;">Here's the always-up-to-date sheet for <strong style="color:#fff;">${report?.gigTitle ?? ""}</strong>. It refreshes automatically as new ${label} come in.</p>
        <p style="margin:24px 0;">
          <a href="${sync.url}" style="background:#F4511E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;display:inline-block;">Open the sheet</a>
        </p>
        <p style="color:#6b7280;font-size:12px;line-height:1.6;">
          The sheet is view-only and contains ${sync.rows} row${sync.rows === 1 ? "" : "s"}.
          Phone numbers and email addresses are never included — you can see those inside GigDekho,
          on the listing itself.
        </p>
      </div>`,
  });

  return Response.json({ ok: true, url: sync.url, rows: sync.rows });
});
