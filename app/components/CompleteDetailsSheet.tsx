import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { useViewportHeight } from "~/hooks/useViewportHeight";
import VerificationPanel from "./VerificationPanel";
import { X, Phone, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";

/**
 * The details a worker has to give before their first application goes
 * through: a number the hirer can reach them on, and an identity document.
 *
 * Asked here rather than at signup. Everything demanded before someone has
 * seen a gig they want is a reason to leave, and these two only start to
 * matter at the moment they are about to be counted on to turn up.
 *
 * Gender is collected in the same breath when it is not already known, since
 * some gigs reserve seats by it and an applicant with no gender recorded gets
 * waitlisted for a human to place rather than taken automatically.
 *
 * The identity step reuses VerificationPanel rather than reimplementing an
 * upload. That component carries a fix that took five attempts to land:
 * choosing a file does no work, because Android discards the page while the
 * native picker is open, so the upload runs from a separate tap on a restored
 * page. A second upload path here would have to rediscover all of that.
 */
export default function CompleteDetailsSheet({
  isOpen,
  onClose,
  userId,
  initialPhone,
  initialGender,
  needsPhone,
  needsIdentity,
  needsGender,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialPhone?: string | null;
  initialGender?: string | null;
  needsPhone: boolean;
  needsIdentity: boolean;
  needsGender: boolean;
  /** Fired once everything required is present, so the caller can resume. */
  onComplete: () => void;
}) {
  const sheetHeight = useViewportHeight(isOpen);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [gender, setGender] = useState<string | null>(initialGender ?? null);
  const [saving, setSaving] = useState(false);
  // Phone and gender are written together, so one flag covers both.
  const [detailsSaved, setDetailsSaved] = useState(!needsPhone && !needsGender);
  const [hasDoc, setHasDoc] = useState(!needsIdentity);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPhone(initialPhone ?? "");
    setGender(initialGender ?? null);
    setDetailsSaved(!needsPhone && !needsGender);
    setHasDoc(!needsIdentity);
    setError("");
  }, [isOpen, initialPhone, initialGender, needsPhone, needsIdentity, needsGender]);

  // VerificationPanel owns the upload; this only asks whether one now exists.
  const refreshDocs = async () => {
    const { count } = await supabase
      .from("verification_documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    setHasDoc(Boolean(count));
  };

  const saveDetails = async () => {
    const trimmed = phone.replace(/\s+/g, "");
    // Ten digits, optionally with +91 in front — the only shape that is any
    // use for actually calling someone on the day.
    if (needsPhone && !/^(\+?91)?[6-9]\d{9}$/.test(trimmed)) {
      setError("Enter a 10-digit mobile number.");
      return;
    }
    if (needsGender && !gender) {
      setError("Pick one of the three, or choose Rather not say.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const patch: Record<string, any> = {};
      if (needsPhone) patch.phone = trimmed;
      if (gender) patch.gender = gender;
      const { data, error: err } = await supabase
        .from("profiles").update(patch).eq("id", userId).select("id");
      if (err) throw err;
      // RLS refuses by returning no rows and no error, so the row count is
      // the only honest signal that anything was written.
      if (!data || data.length === 0) {
        throw new Error("Your session expired. Sign in again and retry.");
      }
      setDetailsSaved(true);
    } catch (e: any) {
      setError(e.message || "Could not save your details. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const ready = detailsSaved && hasDoc;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full md:max-w-lg bg-[#111111] border border-white/10 rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden"
        style={sheetHeight ? { maxHeight: sheetHeight * 0.92 } : { maxHeight: "92vh" }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white leading-tight">One-time details</h2>
            <p className="text-[11px] font-semibold text-white/45 mt-0.5">
              Needed before your first application. You won't be asked again.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 btn-tap min-h-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
          {needsPhone && (
            <div>
              <label htmlFor="cd-phone" className="text-[11px] font-black text-white/60 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Phone size={12} className="text-[#F4511E]" /> Mobile number
                {detailsSaved && <CheckCircle2 size={13} className="text-green-400" />}
              </label>
              <p className="text-[11px] font-medium text-white/40 mb-2 leading-relaxed">
                Shared only with the hirer once you're confirmed, so they can reach you about timings on the day.
              </p>
              <div className="flex gap-2">
                <input
                  id="cd-phone" type="tel" inputMode="numeric" placeholder="98765 43210"
                  value={phone} onChange={(e) => { setPhone(e.target.value); setDetailsSaved(false); }}
                  className="flex-1 h-11 px-4 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
                />
              </div>
            </div>
          )}

          {needsGender && (
            <div>
              <span className="text-[11px] font-black text-white/60 uppercase tracking-wider block mb-2">Gender</span>
              <p className="text-[11px] font-medium text-white/40 mb-2 leading-relaxed">
                Some events hire a set number of men and women for particular roles. Only used to place you against those.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([["male", "Male"], ["female", "Female"], ["undisclosed", "Rather not say"]] as const).map(([v, text]) => (
                  <button
                    key={v} type="button"
                    onClick={() => { setGender(v); setDetailsSaved(false); }}
                    aria-pressed={gender === v}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-black transition-colors btn-tap ${
                      gender === v
                        ? "bg-[#F4511E]/15 border-[#F4511E]/40 text-[#F4511E]"
                        : "bg-[#1C1C1C] border-white/10 text-white/60 hover:border-white/20"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(needsPhone || needsGender) && (
            <button
              type="button" onClick={saveDetails} disabled={saving || detailsSaved}
              className="w-full h-11 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white text-xs font-black uppercase tracking-wider btn-tap disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving</>
                : detailsSaved ? <><CheckCircle2 size={14} /> Saved</>
                : "Save these details"}
            </button>
          )}

          {needsIdentity && (
            <div>
              <span className="text-[11px] font-black text-white/60 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <ShieldCheck size={12} className="text-[#F4511E]" /> Identity proof
                {hasDoc && <CheckCircle2 size={13} className="text-green-400" />}
              </span>
              <p className="text-[11px] font-medium text-white/40 mb-3 leading-relaxed">
                Upload your Aadhaar. You can apply as soon as it's uploaded — you don't have to wait for it to be reviewed.
              </p>
              <VerificationPanel userId={userId} docTypes={["aadhaar"]} onStatusChange={refreshDocs} />
            </div>
          )}

          {error && (
            <p className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/10 shrink-0 bg-[#111111]">
          <button
            type="button"
            disabled={!ready}
            onClick={onComplete}
            className="w-full h-12 rounded-full bg-[#F4511E] hover:bg-[#D84315] text-white font-black text-sm uppercase tracking-wide btn-tap disabled:opacity-40 transition-colors"
          >
            {ready
              ? "Continue to apply"
              : !detailsSaved
                ? "Save your details to continue"
                : "Upload your ID to continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
