import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sheetsConfigured,
  createApplicantSheet,
  writeApplicantRows,
  enforceViewOnly,
} from "./google-sheets.server";
import { buildApplicantReport } from "./applicant-report.server";

/**
 * Pushes the applicant list for a listing into its live Google Sheet,
 * creating and sharing (view-only) the sheet on first use. Works for both
 * event gigs (volunteers/staff) and internship listings.
 *
 * Always safe to call: no-ops when Sheets isn't configured, and records
 * rather than throws on API errors, so an applicant's submit never fails
 * because of a spreadsheet problem.
 */
export async function syncGigSheet(
  admin: SupabaseClient,
  gigId: string,
  /**
   * Whether to create the sheet when none exists yet. Automatic background
   * syncs for event gigs pass `false` so we never create a spreadsheet (and
   * email the hirer about it) uninvited — only an explicit button press or an
   * internship application does that.
   */
  { createIfMissing = true }: { createIfMissing?: boolean } = {}
) {
  if (!sheetsConfigured()) return { ok: false, reason: "not_configured" as const };

  try {
    const report = await buildApplicantReport(admin, gigId);
    if (!report) return { ok: false, reason: "not_found" as const };

    let { data: sheet } = await admin
      .from("gig_sheets")
      .select("spreadsheet_id, spreadsheet_url")
      .eq("gig_id", gigId)
      .maybeSingle();

    if (!sheet && !createIfMissing) return { ok: false, reason: "no_sheet" as const };

    if (!sheet) {
      const { data: organizer } = await admin
        .from("profiles").select("email").eq("id", report.organizerId).single();

      let hirerEmail = organizer?.email ?? null;
      if (!hirerEmail) {
        const { data: au } = await admin.auth.admin.getUserById(report.organizerId);
        hirerEmail = au?.user?.email ?? null;
      }

      const label = report.gigType === "internship" ? "Applicants" : "Volunteers";
      const created = await createApplicantSheet(`GigDekho ${label} — ${report.gigTitle}`, hirerEmail);
      if (!created) return { ok: false, reason: "not_configured" as const };

      await admin.from("gig_sheets").insert({
        gig_id: gigId,
        organizer_id: report.organizerId,
        spreadsheet_id: created.spreadsheetId,
        spreadsheet_url: created.spreadsheetUrl,
        shared_with: hirerEmail,
      });
      sheet = { spreadsheet_id: created.spreadsheetId, spreadsheet_url: created.spreadsheetUrl };
    } else {
      // Sheets created before the view-only rule get downgraded here
      await enforceViewOnly(sheet.spreadsheet_id);
    }

    await writeApplicantRows(sheet.spreadsheet_id, report.headers, report.rows);

    await admin.from("gig_sheets").update({
      rows_synced: report.rows.length,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    }).eq("gig_id", gigId);

    return { ok: true as const, url: sheet.spreadsheet_url, rows: report.rows.length };
  } catch (err: any) {
    console.error("[sheet-sync]", err);
    await admin
      .from("gig_sheets")
      .update({ last_error: String(err?.message ?? err).slice(0, 500) })
      .eq("gig_id", gigId);
    return { ok: false, reason: "error" as const, error: String(err?.message ?? err) };
  }
}
