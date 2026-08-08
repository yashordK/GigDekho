import { useState, useEffect, useRef } from "react";
import { supabase } from "~/lib/supabase.client";
import { X, AlertTriangle, Upload, FileText, Link2, Check, ChevronRight, ChevronLeft } from "lucide-react";

const QUALIFICATIONS = [
  "Pursuing Bachelor's", "Bachelor's", "Pursuing Master's", "Master's",
  "Diploma", "Class 12 / School", "Other",
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  gigId: string;
  gigTitle: string;
  user: any;
  profile: any;
}

/**
 * Full internship application. Everything we already know about the
 * candidate is prefilled; they confirm and fill in what's missing.
 */
export default function InternshipApplyModal({
  isOpen, onClose, onSubmitted, gigId, gigTitle, user, profile,
}: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "",
    qualification: "", institution: "", degree_domain: "", graduation_year: "",
    about: "", why_you: "",
    resume_url: "", portfolio_url: "",
  });
  const [savedItems, setSavedItems] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showNoResumeWarning, setShowNoResumeWarning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setError("");
    setShowNoResumeWarning(false);
    setForm({
      full_name: profile?.full_name || "",
      email: user?.email || profile?.email || "",
      phone: profile?.phone || "",
      qualification: "", institution: "", degree_domain: "", graduation_year: "",
      about: profile?.bio || "", why_you: "",
      resume_url: "", portfolio_url: "",
    });
    // Offer whatever they already have in their portfolio
    if (user?.id) {
      supabase
        .from("portfolio_items")
        .select("id, kind, url, label")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setSavedItems(data || []));
    }
  }, [isOpen, user, profile]);

  if (!isOpen) return null;

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) { setError("Resume must be under 10 MB."); return; }
    setUploading(true);
    setError("");
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("portfolios").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("portfolios").getPublicUrl(path);
      set("resume_url", pub.publicUrl);
      // Keep it on their profile too, so the next application is one tap
      await supabase.from("portfolio_items").insert({
        worker_id: user.id, kind: "file", url: pub.publicUrl, label: file.name.slice(0, 60),
      });
      const { data } = await supabase
        .from("portfolio_items").select("id, kind, url, label")
        .eq("worker_id", user.id).order("created_at", { ascending: false });
      setSavedItems(data || []);
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const validateStep1 = () => {
    if (!form.full_name.trim()) { setError("Your name is required."); return false; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setError("Enter a valid email address."); return false; }
    if (!/^[+]?[\d\s-]{10,15}$/.test(form.phone.trim())) { setError("Enter a valid phone number."); return false; }
    setError("");
    return true;
  };

  const validateStep2 = () => {
    if (!form.qualification) { setError("Select your qualification."); return false; }
    if (!form.degree_domain.trim()) { setError("Tell them your degree or field of study."); return false; }
    if (form.graduation_year && !/^\d{4}$/.test(form.graduation_year)) { setError("Graduation year should be a 4-digit year."); return false; }
    setError("");
    return true;
  };

  const validateStep3 = () => {
    if (!form.why_you.trim()) { setError("Add a line on why you're a fit — this is what hirers read first."); return false; }
    setError("");
    return true;
  };

  const doSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("gig_id", gigId);
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch("/api/apply-internship", { method: "POST", body: fd });
      const result = await res.json();
      if (!res.ok || result.error) {
        if (result.error === "already_applied") throw new Error("You've already applied to this listing.");
        if (result.error === "account_suspended") throw new Error("Your account is suspended. Contact support.");
        throw new Error(result.error || "Could not submit. Try again.");
      }
      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setShowNoResumeWarning(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (!validateStep3()) return;
    if (!form.resume_url && !form.portfolio_url) {
      setShowNoResumeWarning(true);
      return;
    }
    doSubmit();
  };

  const inputCls = "w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]";
  const labelCls = "block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5";
  const areaCls = "w-full p-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none";

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/85 animate-in fade-in duration-200">
      <div className="bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-lg h-[100dvh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white truncate">Apply</h2>
            <p className="text-[11px] font-bold text-[#F4511E] uppercase tracking-wider truncate">{gigTitle} · Step {step} of 3</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap shrink-0">
            <X size={20} />
          </button>
        </div>
        <div className="flex w-full h-1 bg-[#111111] shrink-0">
          <div className={`h-full bg-[#F4511E] transition-all duration-300 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>
          )}

          {/* Step 1 — contact */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs font-medium text-white/40 -mt-1">
                We've filled in what we already know. Check it's right before continuing.
              </p>
              <div>
                <label htmlFor="ia-name" className={labelCls}>Full Name</label>
                <input id="ia-name" type="text" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ia-email" className={labelCls}>Email</label>
                <input id="ia-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} autoComplete="email" />
              </div>
              <div>
                <label htmlFor="ia-phone" className={labelCls}>Phone</label>
                <input id="ia-phone" type="tel" placeholder="+91 98xxxxxx00" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} autoComplete="tel" />
                <p className="text-[10px] font-medium text-white/30 mt-1">Shared with this hirer only, so they can reach you about this role.</p>
              </div>
            </div>
          )}

          {/* Step 2 — education */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label className={labelCls}>Qualification</label>
                <div className="flex flex-wrap gap-2">
                  {QUALIFICATIONS.map((q) => (
                    <button key={q} type="button" onClick={() => set("qualification", q)}
                      className={`px-3 py-2 rounded-full text-xs font-bold border btn-tap transition-colors min-h-0 ${form.qualification === q ? "bg-[#F4511E] border-[#F4511E] text-white" : "bg-transparent border-white/15 text-white/60 hover:border-[#F4511E]"}`}
                      style={{ minHeight: "36px" }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="ia-degree" className={labelCls}>Degree / Field of study</label>
                <input id="ia-degree" type="text" placeholder="e.g. B.Tech, Computer Science" value={form.degree_domain} onChange={(e) => set("degree_domain", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ia-inst" className={labelCls}>College / Institution</label>
                <input id="ia-inst" type="text" placeholder="e.g. IET DAVV, Indore" value={form.institution} onChange={(e) => set("institution", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ia-year" className={labelCls}>Graduation Year</label>
                <input id="ia-year" type="text" inputMode="numeric" placeholder="2027" maxLength={4} value={form.graduation_year} onChange={(e) => set("graduation_year", e.target.value)} className={inputCls} />
              </div>
            </div>
          )}

          {/* Step 3 — pitch + resume */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label htmlFor="ia-why" className={labelCls}>Why you?</label>
                <textarea id="ia-why" rows={4} maxLength={1200} placeholder="What makes you right for this role? Mention relevant work, projects, or skills."
                  value={form.why_you} onChange={(e) => set("why_you", e.target.value)} className={areaCls} />
              </div>
              <div>
                <label htmlFor="ia-about" className={labelCls}>About you / note to the hirer (optional)</label>
                <textarea id="ia-about" rows={3} maxLength={1200} placeholder="Anything else they should know — availability, notice period, questions."
                  value={form.about} onChange={(e) => set("about", e.target.value)} className={areaCls} />
              </div>

              {/* Resume */}
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={labelCls + " mb-0"}>Resume</span>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 text-[11px] font-black text-white bg-[#F4511E] px-3 py-1.5 rounded-full hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 min-h-0"
                    style={{ minHeight: "32px" }}>
                    <Upload size={12} /> {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" aria-hidden="true" onChange={handleUpload} />

                {form.resume_url && (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
                    <Check size={14} className="text-green-400 shrink-0" />
                    <span className="text-xs font-bold text-green-400 truncate">Resume attached</span>
                    <button type="button" onClick={() => set("resume_url", "")} className="ml-auto text-[10px] font-black text-white/40 hover:text-white uppercase min-h-0" style={{ minHeight: "24px" }}>Remove</button>
                  </div>
                )}

                {savedItems.length > 0 && !form.resume_url && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Use from your portfolio</p>
                    {savedItems.slice(0, 4).map((item) => (
                      <button key={item.id} type="button" onClick={() => set(item.kind === "file" ? "resume_url" : "portfolio_url", item.url)}
                        className="w-full flex items-center gap-2 bg-[#1C1C1C] border border-white/5 hover:border-[#F4511E]/40 rounded-xl px-3 py-2.5 transition-colors btn-tap text-left min-h-0" style={{ minHeight: "40px" }}>
                        {item.kind === "file" ? <FileText size={13} className="text-[#F4511E] shrink-0" /> : <Link2 size={13} className="text-blue-400 shrink-0" />}
                        <span className="text-xs font-bold text-white/75 truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <label htmlFor="ia-portfolio" className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Portfolio / work link (optional)</label>
                  <input id="ia-portfolio" type="url" placeholder="https://behance.net/you" value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-xs font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-[#111111] shrink-0">
          <button
            onClick={() => (step > 1 ? (setStep(step - 1), setError("")) : onClose())}
            className="px-5 py-3 min-h-[44px] border border-white/10 text-white hover:bg-white/5 rounded-xl flex items-center justify-center font-bold text-sm btn-tap"
          >
            <ChevronLeft size={16} className="mr-1" /> {step > 1 ? "Back" : "Cancel"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => { if (step === 1 ? validateStep1() : validateStep2()) setStep(step + 1); }}
              className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap"
            >
              Next <ChevronRight size={16} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          )}
        </div>
      </div>

      {/* No-resume warning */}
      {showNoResumeWarning && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={20} className="text-[#F4511E]" />
              <h3 className="font-black text-white text-base">Submit without a resume?</h3>
            </div>
            <p className="text-sm font-medium text-white/60 leading-relaxed mb-5">
              You haven't attached a resume or a portfolio link. Hirers almost always shortlist candidates who have one, so this application is likely to be skipped.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowNoResumeWarning(false)}
                className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#F4511E] hover:bg-[#D84315] transition-colors btn-tap">
                Add a resume
              </button>
              <button type="button" onClick={doSubmit} disabled={submitting}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white/70 bg-[#111111] hover:bg-white/5 border border-white/10 transition-colors btn-tap disabled:opacity-50">
                {submitting ? "Submitting…" : "Submit anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
