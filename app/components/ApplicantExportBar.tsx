import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { Table2, ExternalLink, RefreshCw, Download, Mail, Lock } from "lucide-react";

/**
 * Export controls shared by event gigs (volunteers) and internship listings
 * (applicants): download as Excel, open the live view-only Google Sheet, or
 * have the link emailed over.
 */
export default function ApplicantExportBar({
  gigId,
  kind,
  showToast,
}: {
  gigId: string;
  kind: "volunteers" | "applicants";
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [sheet, setSheet] = useState<any>(null);
  const [busy, setBusy] = useState<"sync" | "email" | null>(null);

  const fetchSheet = async () => {
    const { data } = await supabase
      .from("gig_sheets")
      .select("spreadsheet_url, rows_synced, last_synced_at")
      .eq("gig_id", gigId)
      .maybeSingle();
    setSheet(data);
  };

  useEffect(() => { fetchSheet(); }, [gigId]);

  const post = async (intent: "sync" | "email") => {
    setBusy(intent);
    try {
      const fd = new FormData();
      fd.append("gig_id", gigId);
      const url = intent === "sync" ? "/api/internship-applicants" : "/api/export-applicants";
      if (intent === "sync") fd.append("intent", "sync");

      const res = await fetch(url, { method: "POST", body: fd });
      const r = await res.json();
      if (!res.ok || r.error) {
        if (r.error === "sheets_not_configured") {
          throw new Error("Google Sheets isn't connected on this deployment yet.");
        }
        throw new Error(r.error || "Something went wrong");
      }
      await fetchSheet();
      if (intent === "sync") {
        showToast(`Sheet updated with ${r.rows} row${r.rows === 1 ? "" : "s"}`, "success");
        if (r.url) window.open(r.url, "_blank", "noopener");
      } else {
        showToast("Sheet link sent to your email", "success");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const downloadExcel = () => {
    // Server streams a real .xlsx with a Content-Disposition attachment header
    window.location.href = `/api/export-applicants?gig_id=${encodeURIComponent(gigId)}`;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadExcel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] text-[11px] font-black uppercase tracking-wider hover:bg-[#F4511E]/20 transition-colors btn-tap"
        >
          <Download size={13} /> Export to Excel
        </button>

        {sheet?.spreadsheet_url ? (
          <a
            href={sheet.spreadsheet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500/10 border border-green-500/25 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-colors btn-tap"
          >
            <Table2 size={13} /> Open Sheet <ExternalLink size={11} />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => post("sync")}
            disabled={busy !== null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#111111] border border-white/10 border-dashed text-white/60 hover:text-white hover:border-green-500/40 text-[11px] font-black uppercase tracking-wider transition-colors btn-tap disabled:opacity-50"
          >
            <Table2 size={13} /> {busy === "sync" ? "Creating…" : "Create Sheet"}
          </button>
        )}
      </div>

      {sheet?.spreadsheet_url && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => post("email")}
            disabled={busy !== null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#111111] border border-white/10 text-white/50 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors btn-tap disabled:opacity-50"
          >
            <Mail size={12} /> {busy === "email" ? "Sending…" : "Email me the link"}
          </button>
          <button
            type="button"
            onClick={() => post("sync")}
            disabled={busy !== null}
            aria-label="Re-sync sheet"
            className="px-4 py-2 rounded-xl bg-[#111111] border border-white/10 text-white/50 hover:text-white transition-colors btn-tap disabled:opacity-50"
          >
            <RefreshCw size={12} className={busy === "sync" ? "animate-spin" : ""} />
          </button>
        </div>
      )}

      <p className="text-[10px] font-medium text-white/25 flex items-start gap-1 leading-relaxed">
        <Lock size={10} className="shrink-0 mt-0.5" />
        <span>
          View-only sheet. Phone numbers and emails are never exported — see those on the {kind === "applicants" ? "applicant" : "worker"} cards above.
          {sheet?.last_synced_at && ` Synced ${new Date(sheet.last_synced_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.`}
        </span>
      </p>
    </div>
  );
}
