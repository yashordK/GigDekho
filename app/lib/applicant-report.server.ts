import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Builds the applicant table for a listing — used by BOTH the live Google
 * Sheet and the Excel export, so the two can never drift apart.
 *
 * PRIVACY: phone numbers and email addresses are deliberately excluded.
 * GigDekho is not a data-sharing pipe to companies — contact details are
 * visible only inside the app, to the hirer who owns the listing, and are
 * never written into an exportable file that can be forwarded on.
 */

const INTERNSHIP_STATUS: Record<string, string> = {
  submitted: "New", shortlisted: "Shortlisted", interviewing: "Interviewing",
  hired: "Hired", rejected: "Rejected",
};
const EVENT_STATUS: Record<string, string> = {
  pending: "Pending", accepted: "Confirmed", completed: "Completed",
  no_show: "No Show", cancelled: "Cancelled", rejected: "Rejected",
};

export interface ApplicantReport {
  gigTitle: string;
  gigType: "event" | "internship";
  organizerId: string;
  headers: string[];
  widths: number[];
  rows: string[][];
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "";

export async function buildApplicantReport(
  admin: SupabaseClient,
  gigId: string
): Promise<ApplicantReport | null> {
  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, gig_type, organizer_id")
    .eq("id", gigId)
    .single();
  if (!gig) return null;

  const gigType = (gig.gig_type ?? "event") as "event" | "internship";

  if (gigType === "internship") {
    const { data: apps } = await admin
      .from("internship_applications")
      .select("created_at, full_name, qualification, institution, degree_domain, graduation_year, why_you, about, resume_url, portfolio_url, status")
      .eq("gig_id", gigId)
      .order("created_at", { ascending: false });

    return {
      gigTitle: gig.title,
      gigType,
      organizerId: gig.organizer_id,
      headers: [
        "Applied On", "Name", "Status", "Qualification", "Institution",
        "Degree / Field", "Grad Year", "Why Them", "About / Note", "Resume", "Portfolio",
      ],
      widths: [20, 22, 14, 20, 26, 24, 11, 52, 44, 34, 34],
      rows: (apps ?? []).map((a) => [
        fmtDate(a.created_at),
        a.full_name ?? "",
        INTERNSHIP_STATUS[a.status] ?? a.status ?? "",
        a.qualification ?? "",
        a.institution ?? "",
        a.degree_domain ?? "",
        a.graduation_year ? String(a.graduation_year) : "",
        a.why_you ?? "",
        a.about ?? "",
        a.resume_url ?? "",
        a.portfolio_url ?? "",
      ]),
    };
  }

  // ── Event gig: volunteers / staff who applied ──
  const { data: apps } = await admin
    .from("applications")
    .select("applied_at, status, waitlist_position, profiles(full_name, avg_rating, reliability_score, worker_level, id_verified, basics_certified, city)")
    .eq("gig_id", gigId)
    .order("applied_at", { ascending: false });

  return {
    gigTitle: gig.title,
    gigType,
    organizerId: gig.organizer_id,
    headers: [
      "Applied On", "Name", "Status", "Waitlist #", "Rating",
      "Reliability", "Level", "ID Verified", "Basics Certified", "City",
    ],
    widths: [20, 22, 14, 12, 10, 12, 12, 13, 17, 16],
    rows: (apps ?? []).map((a: any) => {
      const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      return [
        fmtDate(a.applied_at),
        p?.full_name ?? "",
        EVENT_STATUS[a.status] ?? a.status ?? "",
        a.waitlist_position != null ? String(a.waitlist_position) : "",
        p?.avg_rating ? Number(p.avg_rating).toFixed(1) : "",
        p?.reliability_score != null ? `${Math.round(p.reliability_score)}%` : "",
        p?.worker_level ? p.worker_level.charAt(0).toUpperCase() + p.worker_level.slice(1) : "",
        p?.id_verified ? "Yes" : "No",
        p?.basics_certified ? "Yes" : "No",
        p?.city ?? "",
      ];
    }),
  };
}
