import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import {
  Calendar, MapPin, MoreVertical, Users, FileText, Link2, Mail, Phone,
  ChevronDown, ChevronUp, Loader2,
  CheckCircle2, XCircle, GraduationCap, IndianRupee, Megaphone,
} from "lucide-react";
import AnnounceModal from "./AnnounceModal";
import ApplicantExportBar from "./ApplicantExportBar";

const STATUS_FLOW = [
  { id: "submitted", label: "New", cls: "bg-white/10 text-white/70 border-white/20" },
  { id: "shortlisted", label: "Shortlisted", cls: "bg-blue-500/10 text-blue-400 border-blue-500/25" },
  { id: "interviewing", label: "Interviewing", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25" },
  { id: "hired", label: "Hired", cls: "bg-green-500/10 text-green-400 border-green-500/25" },
  { id: "rejected", label: "Rejected", cls: "bg-red-500/10 text-red-400 border-red-500/25" },
];
const statusMeta = (id: string) => STATUS_FLOW.find((s) => s.id === id) ?? STATUS_FLOW[0];

const WORK_MODE: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
const COMMITMENT: Record<string, string> = { full_time: "Full-time", part_time: "Part-time" };

function stipendText(gig: any) {
  if (gig.is_unpaid) return "Unpaid";
  if (gig.stipend_min == null) return "—";
  if (gig.stipend_max && gig.stipend_max > gig.stipend_min) {
    return `₹${gig.stipend_min.toLocaleString("en-IN")}–${gig.stipend_max.toLocaleString("en-IN")}/mo`;
  }
  return `₹${gig.stipend_min.toLocaleString("en-IN")}/mo`;
}

export default function InternshipManagementCard({
  gig, onActionSuccess, showToast,
}: {
  gig: any;
  onActionSuccess: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [openApplicant, setOpenApplicant] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAnnounce, setShowAnnounce] = useState(false);

  const fetchApplicants = async () => {
    const { data: apps } = await supabase
      .from("internship_applications")
      .select("*")
      .eq("gig_id", gig.id)
      .order("created_at", { ascending: false });
    setApplicants(apps || []);
  };

  useEffect(() => { fetchApplicants(); }, [gig.id]);

  const setStatus = async (applicationId: string, status: string) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("intent", "status");
      fd.append("gig_id", gig.id);
      fd.append("application_id", applicationId);
      fd.append("status", status);
      const res = await fetch("/api/internship-applicants", { method: "POST", body: fd });
      const r = await res.json();
      if (!res.ok || r.error) throw new Error(r.error || "Failed");
      setApplicants((list) => list.map((a) => (a.id === applicationId ? { ...a, status } : a)));
      showToast(`Marked as ${statusMeta(status).label.toLowerCase()}`, "success");
    } catch (err: any) {
      showToast(err.message || "Could not update", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateGigStatus = async (newStatus: "completed" | "cancelled") => {
    setMenuOpen(false);
    setLoading(true);
    try {
      const { error } = await supabase.from("gigs").update({ status: newStatus }).eq("id", gig.id);
      if (error) throw error;
      showToast(`Listing ${newStatus === "completed" ? "closed" : "cancelled"}`, "success");
      onActionSuccess();
    } catch (err: any) {
      showToast(err.message || "Failed to update", "error");
    } finally {
      setLoading(false);
    }
  };

  const counts = STATUS_FLOW.reduce((acc, s) => {
    acc[s.id] = applicants.filter((a) => a.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);
  const shown = filter === "all" ? applicants : applicants.filter((a) => a.status === filter);
  const newCount = counts.submitted ?? 0;
  const deadlinePassed = gig.application_deadline && new Date(gig.application_deadline) < new Date();

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/5 shadow-md relative">
      {loading && (
        <div className="absolute inset-0 bg-black/60 z-30 rounded-2xl flex items-center justify-center">
          <Loader2 className="animate-spin text-[#F4511E]" size={28} />
        </div>
      )}

      {/* Header */}
      <div className="p-5 flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-1 rounded-full flex items-center gap-1">
              <GraduationCap size={10} /> Internship
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 text-white/50 border border-white/10 px-2 py-1 rounded-full">
              {WORK_MODE[gig.work_mode] ?? "—"} · {COMMITMENT[gig.commitment] ?? "—"}
            </span>
            {deadlinePassed && (
              <span className="text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/25 px-2 py-1 rounded-full">Closed</span>
            )}
          </div>
          <h3 className="font-black text-white text-base lg:text-lg tracking-tight truncate">{gig.title}</h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
              <IndianRupee size={11} className="text-[#F4511E]" /> {stipendText(gig)}
            </span>
            <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
              <Calendar size={11} className="text-[#F4511E]" /> Starts {new Date(gig.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
            <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
              <MapPin size={11} className="text-[#F4511E] shrink-0" />
              <span className="truncate max-w-[140px]">{gig.location_text}</span>
            </span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Listing actions" aria-expanded={menuOpen}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors btn-tap">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-[#111111] border border-white/10 shadow-2xl rounded-xl py-1.5 z-40 animate-in fade-in slide-in-from-top-1">
              <button type="button" onClick={() => { setMenuOpen(false); setShowAnnounce(true); }}
                className="w-full text-left px-4 py-2 text-xs font-bold text-[#F4511E] hover:bg-white/5 flex items-center gap-1.5">
                <Megaphone size={14} /> Announce
              </button>
              <button type="button" onClick={() => updateGigStatus("completed")}
                className="w-full text-left px-4 py-2 text-xs font-bold text-green-400 hover:bg-white/5 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Close hiring
              </button>
              <button type="button" onClick={() => updateGigStatus("cancelled")}
                className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:bg-white/5 flex items-center gap-1.5">
                <XCircle size={14} /> Cancel listing
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="px-5 pb-4">
        <div className="bg-[#111111] rounded-xl p-3 border border-white/5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black text-white/40 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={11} /> {applicants.length} applicant{applicants.length !== 1 ? "s" : ""}
            </span>
            {newCount > 0 && (
              <span className="text-[10px] font-black text-[#F4511E] flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#F4511E] rounded-full animate-pulse" /> {newCount} new
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FLOW.map((s) => (
              <span key={s.id} className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${counts[s.id] ? s.cls : "bg-transparent text-white/25 border-white/10"}`}>
                {s.label} {counts[s.id] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Export & live sheet */}
      <div className="px-5 pb-4">
        <ApplicantExportBar gigId={gig.id} kind="applicants" showToast={showToast} />
      </div>

      {/* Applicants */}
      <div className="border-t border-white/5 px-5 py-3">
        <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
          className="w-full text-left text-xs font-bold text-white/50 hover:text-white flex justify-between items-center transition-colors py-1 btn-tap">
          <span>Review applicants ({applicants.length})</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {expanded && (
          <div className="mt-3 animate-in fade-in duration-200">
            {applicants.length === 0 ? (
              <div className="bg-[#111111] border border-white/5 border-dashed rounded-xl p-5 text-center">
                <p className="text-xs font-bold text-white/50 mb-1">No applications yet</p>
                <p className="text-[11px] font-medium text-white/35 leading-relaxed">
                  Share the listing link with your network to get the first few in. New applications appear here and in your sheet instantly.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button type="button" onClick={() => setFilter("all")}
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border transition-colors btn-tap min-h-0 ${filter === "all" ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50"}`}
                    style={{ minHeight: "28px" }}>All {applicants.length}</button>
                  {STATUS_FLOW.filter((s) => counts[s.id] > 0).map((s) => (
                    <button key={s.id} type="button" onClick={() => setFilter(s.id)}
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border transition-colors btn-tap min-h-0 ${filter === s.id ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50"}`}
                      style={{ minHeight: "28px" }}>{s.label} {counts[s.id]}</button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto hide-scrollbar">
                  {shown.map((a) => {
                    const isOpen = openApplicant === a.id;
                    const meta = statusMeta(a.status);
                    return (
                      <div key={a.id} className="bg-[#111111] rounded-xl border border-white/5 overflow-hidden">
                        <button type="button" onClick={() => setOpenApplicant(isOpen ? null : a.id)} aria-expanded={isOpen}
                          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#F4511E]/10 text-[#F4511E] font-black flex items-center justify-center text-xs shrink-0 border border-[#F4511E]/20">
                              {a.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-white truncate">{a.full_name}</p>
                              <p className="text-[10px] font-semibold text-white/40 truncate">
                                {[a.degree_domain, a.institution, a.graduation_year].filter(Boolean).join(" · ") || "No education details"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${meta.cls}`}>{meta.label}</span>
                            {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/5 pt-3 animate-in fade-in duration-150">
                            <div className="flex flex-wrap gap-2">
                              <a href={`mailto:${a.email}`} className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 bg-[#1C1C1C] border border-white/10 px-2.5 py-1.5 rounded-lg hover:border-[#F4511E]/40 transition-colors btn-tap min-h-0" style={{ minHeight: "30px" }}>
                                <Mail size={11} className="text-[#F4511E]" /> {a.email}
                              </a>
                              <a href={`tel:${a.phone}`} className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 bg-[#1C1C1C] border border-white/10 px-2.5 py-1.5 rounded-lg hover:border-[#F4511E]/40 transition-colors btn-tap min-h-0" style={{ minHeight: "30px" }}>
                                <Phone size={11} className="text-[#F4511E]" /> {a.phone}
                              </a>
                              {a.resume_url && (
                                <a href={a.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/25 px-2.5 py-1.5 rounded-lg hover:bg-[#F4511E]/20 transition-colors btn-tap min-h-0" style={{ minHeight: "30px" }}>
                                  <FileText size={11} /> Resume
                                </a>
                              )}
                              {a.portfolio_url && (
                                <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors btn-tap min-h-0" style={{ minHeight: "30px" }}>
                                  <Link2 size={11} /> Portfolio
                                </a>
                              )}
                              {!a.resume_url && !a.portfolio_url && (
                                <span className="text-[10px] font-bold text-white/30 px-2.5 py-1.5">No resume attached</span>
                              )}
                            </div>

                            {a.qualification && (
                              <p className="text-[11px] font-semibold text-white/50">
                                <span className="text-white/30 uppercase tracking-wider text-[9px] font-black mr-1.5">Qualification</span>{a.qualification}
                              </p>
                            )}
                            {a.why_you && (
                              <div>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">Why them</p>
                                <p className="text-[11px] font-medium text-white/70 leading-relaxed whitespace-pre-wrap">{a.why_you}</p>
                              </div>
                            )}
                            {a.about && (
                              <div>
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1">About / note</p>
                                <p className="text-[11px] font-medium text-white/60 leading-relaxed whitespace-pre-wrap">{a.about}</p>
                              </div>
                            )}

                            <div>
                              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1.5">Move to</p>
                              <div className="flex flex-wrap gap-1.5">
                                {STATUS_FLOW.filter((s) => s.id !== a.status).map((s) => (
                                  <button key={s.id} type="button" onClick={() => setStatus(a.id, s.id)}
                                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors btn-tap min-h-0 ${s.cls} opacity-70 hover:opacity-100`}
                                    style={{ minHeight: "30px" }}>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <AnnounceModal
        isOpen={showAnnounce}
        onClose={() => setShowAnnounce(false)}
        gigId={gig.id}
        gigTitle={gig.title}
        onSent={(n) => showToast(`Announcement sent to ${n} applicant${n !== 1 ? "s" : ""}!`, "success")}
      />
    </div>
  );
}
