import { useState, useEffect } from "react";
import { X, Flag, ShieldAlert, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  { id: "safety", label: "Safety concern", hint: "Harassment, unsafe conditions, threats" },
  { id: "fraud", label: "Fraud or scam", hint: "Fake listing, non-payment, impersonation" },
  { id: "payment", label: "Payment issue", hint: "Wrong amount, missing payout" },
  { id: "no_show", label: "No-show", hint: "They didn't turn up" },
  { id: "behaviour", label: "Behaviour", hint: "Rude, unprofessional, misleading" },
  { id: "spam", label: "Spam", hint: "Irrelevant or repeated listings" },
  { id: "other", label: "Something else", hint: "" },
];

export default function ReportModal({
  isOpen, onClose, targetType, targetId, targetLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  targetType: "user" | "gig" | "application" | "message" | "other";
  targetId?: string;
  targetLabel?: string;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isOpen) { setCategory(""); setDescription(""); setError(""); setDone(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) { setError("Pick what this is about."); return; }
    if (description.trim().length < 10) { setError("Please describe what happened."); return; }
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("target_type", targetType);
      if (targetId) fd.append("target_id", targetId);
      if (targetLabel) fd.append("subject", targetLabel);
      fd.append("description", description.trim());
      const res = await fetch("/api/report", { method: "POST", body: fd });
      const r = await res.json();
      if (!res.ok || r.error) throw new Error(r.error || "Could not send the report.");
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto hide-scrollbar">
        {done ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Report sent</h3>
            <p className="text-sm font-medium text-white/50 leading-relaxed mb-6">
              The GigDekho team has been notified and will look into this. We may reach out if we need more detail.
            </p>
            <button type="button" onClick={onClose}
              className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Flag size={18} className="text-[#F4511E]" /> Report an issue
              </h3>
              <button type="button" aria-label="Close" onClick={onClose} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap">
                <X size={16} />
              </button>
            </div>
            {targetLabel && <p className="text-[11px] font-semibold text-white/40 mb-5 truncate">About: {targetLabel}</p>}

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <span className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-2">What's this about?</span>
                <div className="space-y-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCategory(c.id); setError(""); }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors btn-tap ${
                        category === c.id
                          ? "bg-[#F4511E]/10 border-[#F4511E]/40"
                          : "bg-[#111111] border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span className={`block text-xs font-bold ${category === c.id ? "text-[#F4511E]" : "text-white/80"}`}>{c.label}</span>
                      {c.hint && <span className="block text-[10px] font-medium text-white/35 mt-0.5">{c.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="report-desc" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">What happened?</label>
                <textarea
                  id="report-desc" rows={4} maxLength={4000} value={description}
                  onChange={(e) => { setDescription(e.target.value); setError(""); }}
                  placeholder="Give us the details — dates, what was said or done, anything that helps us understand."
                  className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none"
                />
              </div>

              <div className="flex items-start gap-2 bg-[#111111] rounded-xl p-3 border border-white/5">
                <ShieldAlert size={14} className="text-[#F4511E] shrink-0 mt-0.5" />
                <p className="text-[10px] font-medium text-white/40 leading-relaxed">
                  Reports go straight to the GigDekho team. The person you're reporting isn't told who reported them.
                  If you're in immediate danger, contact local emergency services first.
                </p>
              </div>

              <button type="submit" disabled={busy || !category}
                className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors">
                {busy ? "Sending…" : "Send report"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
