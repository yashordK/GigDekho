import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { X, Pencil, AlertTriangle } from "lucide-react";

/**
 * Edit a listing after it's live — both event gigs and internships.
 *
 * Used by the hirer on their own listings and by an admin on any listing;
 * RLS decides which, so there's no role check in here. Two things it
 * deliberately will not do: shrink the openings below the number already
 * filled, or quietly change money without saying so. People have applied on
 * the strength of what was posted.
 */

const WORK_MODES = [
  { v: "onsite", label: "On-site" },
  { v: "hybrid", label: "Hybrid" },
  { v: "remote", label: "Remote" },
];
const COMMITMENTS = [
  { v: "part_time", label: "Part-time" },
  { v: "full_time", label: "Full-time" },
];

const toDateInput = (v: string | null) => (v ? String(v).slice(0, 10) : "");

export default function EditGigModal({
  isOpen,
  onClose,
  gig,
  onSaved,
  showToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  gig: any;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const isInternship = gig?.gig_type === "internship";
  const [f, setF] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !gig) return;
    setErrors({});
    setF({
      title: gig.title ?? "",
      description: gig.description ?? "",
      location_text: gig.location_text ?? "",
      slots_total: gig.slots_total ?? 1,
      // event
      pay_rate: gig.pay_rate ?? "",
      duration_hrs: gig.duration_hrs ?? "",
      event_date: toDateInput(gig.event_date),
      is_urgent: Boolean(gig.is_urgent),
      // internship
      work_mode: gig.work_mode ?? "onsite",
      commitment: gig.commitment ?? "part_time",
      duration_months: gig.duration_months ?? "",
      is_unpaid: Boolean(gig.is_unpaid),
      stipend_min: gig.stipend_min ?? "",
      stipend_max: gig.stipend_max ?? "",
      jd_url: gig.jd_url ?? "",
      preferences: gig.preferences ?? "",
      application_deadline: toDateInput(gig.application_deadline),
    });
  }, [isOpen, gig]);

  if (!isOpen || !gig) return null;

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const filled = gig.slots_filled ?? 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.title?.trim()) e.title = "Give the listing a title";
    if (Number(f.slots_total) < 1) e.slots_total = "There must be at least one opening";
    else if (Number(f.slots_total) < filled) {
      e.slots_total = `${filled} ${filled === 1 ? "person is" : "people are"} already confirmed — you can't go below that`;
    }

    if (isInternship) {
      if (f.work_mode !== "remote" && !f.location_text?.trim()) {
        e.location_text = "Add the office location, or switch to Remote";
      }
      if (!f.duration_months || Number(f.duration_months) < 1 || Number(f.duration_months) > 24) {
        e.duration_months = "Enter a duration between 1 and 24 months";
      }
      if (!f.is_unpaid) {
        if (f.stipend_min === "" || Number(f.stipend_min) < 0) {
          e.stipend_min = "Enter a monthly stipend, or mark the role unpaid";
        } else if (f.stipend_max !== "" && Number(f.stipend_max) < Number(f.stipend_min)) {
          e.stipend_max = "Maximum can't be less than the minimum";
        }
      }
      if (!f.description?.trim() && !f.jd_url?.trim()) {
        e.description = "Add a description, or link a job description";
      }
      if (f.jd_url?.trim() && !/^https?:\/\/.+\..+/.test(f.jd_url.trim())) {
        e.jd_url = "Link must start with http:// or https://";
      }
    } else {
      if (!f.location_text?.trim()) e.location_text = "Add where this is happening";
      if (!f.pay_rate || Number(f.pay_rate) <= 0) e.pay_rate = "Enter the hourly pay";
      if (!f.duration_hrs || Number(f.duration_hrs) <= 0) e.duration_hrs = "Enter how many hours";
      if (!f.event_date) e.event_date = "Pick the date";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const patch: any = {
        title: f.title.trim(),
        description: f.description?.trim() || null,
        slots_total: Number(f.slots_total),
      };

      if (isInternship) {
        patch.work_mode = f.work_mode;
        patch.commitment = f.commitment;
        patch.duration_months = Number(f.duration_months);
        patch.is_unpaid = f.is_unpaid;
        patch.stipend_min = f.is_unpaid || f.stipend_min === "" ? null : Number(f.stipend_min);
        patch.stipend_max = f.is_unpaid || f.stipend_max === "" ? null : Number(f.stipend_max);
        patch.jd_url = f.jd_url?.trim() || null;
        patch.preferences = f.preferences?.trim() || null;
        patch.application_deadline = f.application_deadline || null;
        patch.location_text = f.work_mode === "remote" ? "Remote" : f.location_text.trim();
        if (f.work_mode === "remote") {
          patch.lat = null;
          patch.lng = null;
        }
      } else {
        patch.pay_rate = Number(f.pay_rate);
        patch.duration_hrs = Number(f.duration_hrs);
        patch.event_date = f.event_date;
        patch.is_urgent = f.is_urgent;
        patch.location_text = f.location_text.trim();
      }

      // `select` matters: when RLS refuses an update it returns no error and
      // no rows, so without checking the result we'd report a false success.
      const { data, error } = await supabase
        .from("gigs")
        .update(patch)
        .eq("id", gig.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to edit this listing, or your session expired.");
      }

      showToast("Listing updated", "success");
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(
        err?.code === "42501"
          ? "Your session has expired. Sign in again and retry."
          : err.message || "Could not save your changes.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-4 py-3 min-h-[44px] bg-[#111111] border border-white/10 rounded-xl text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]";
  const label = "block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5";
  const Err = ({ k }: { k: string }) =>
    errors[k] ? <p className="text-[11px] font-semibold text-red-400 mt-1.5">{errors[k]}</p> : null;

  const Chips = ({ opts, value, onPick }: { opts: { v: string; label: string }[]; value: string; onPick: (v: string) => void }) => (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onPick(o.v)}
          className={`px-4 py-2 rounded-xl text-xs font-black border btn-tap transition-colors ${
            value === o.v
              ? "bg-[#F4511E] border-[#F4511E] text-white"
              : "bg-[#111111] border-white/10 text-white/60 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto hide-scrollbar">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#F4511E]" />
            Edit {isInternship ? "internship" : "gig"}
          </h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] font-semibold text-white/40 mb-5 truncate">{gig.title}</p>

        {filled > 0 && (
          <div className="flex items-start gap-2.5 bg-[#F4511E]/5 border border-[#F4511E]/20 rounded-xl p-3 mb-5">
            <AlertTriangle size={14} className="text-[#F4511E] shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium text-white/55 leading-relaxed">
              {filled} {filled === 1 ? "person has" : "people have"} already been confirmed. They applied
              based on what's written here, so tell them yourself if you change the pay, timing or place.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="edit-title">Title</label>
            <input id="edit-title" className={input} value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            <Err k="title" />
          </div>

          <div>
            <label className={label} htmlFor="edit-desc">Description</label>
            <textarea
              id="edit-desc"
              rows={4}
              className={`${input} resize-none`}
              value={f.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
            <Err k="description" />
          </div>

          {isInternship ? (
            <>
              <div>
                <span className={label}>Work mode</span>
                <Chips opts={WORK_MODES} value={f.work_mode} onPick={(v) => set("work_mode", v)} />
              </div>
              <div>
                <span className={label}>Commitment</span>
                <Chips opts={COMMITMENTS} value={f.commitment} onPick={(v) => set("commitment", v)} />
              </div>

              {f.work_mode !== "remote" && (
                <div>
                  <label className={label} htmlFor="edit-loc">Location</label>
                  <input id="edit-loc" className={input} value={f.location_text ?? ""} onChange={(e) => set("location_text", e.target.value)} />
                  <Err k="location_text" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="edit-months">Duration (months)</label>
                  <input id="edit-months" type="number" min={1} max={24} className={input}
                    value={f.duration_months ?? ""} onChange={(e) => set("duration_months", e.target.value === "" ? "" : Number(e.target.value))} />
                  <Err k="duration_months" />
                </div>
                <div>
                  <label className={label} htmlFor="edit-openings">Openings</label>
                  <input id="edit-openings" type="number" min={1} className={input}
                    value={f.slots_total ?? 1} onChange={(e) => set("slots_total", e.target.value === "" ? "" : Number(e.target.value))} />
                  <Err k="slots_total" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={Boolean(f.is_unpaid)} onChange={(e) => set("is_unpaid", e.target.checked)}
                  className="w-4 h-4 accent-[#F4511E]" />
                <span className="text-xs font-bold text-white/70">This role is unpaid</span>
              </label>

              {!f.is_unpaid && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label} htmlFor="edit-smin">Stipend min (₹/mo)</label>
                    <input id="edit-smin" type="number" min={0} className={input}
                      value={f.stipend_min ?? ""} onChange={(e) => set("stipend_min", e.target.value === "" ? "" : Number(e.target.value))} />
                    <Err k="stipend_min" />
                  </div>
                  <div>
                    <label className={label} htmlFor="edit-smax">Stipend max (optional)</label>
                    <input id="edit-smax" type="number" min={0} className={input}
                      value={f.stipend_max ?? ""} onChange={(e) => set("stipend_max", e.target.value === "" ? "" : Number(e.target.value))} />
                    <Err k="stipend_max" />
                  </div>
                </div>
              )}

              <div>
                <label className={label} htmlFor="edit-deadline">Application deadline</label>
                <input id="edit-deadline" type="date" className={input}
                  value={f.application_deadline ?? ""} onChange={(e) => set("application_deadline", e.target.value)} />
              </div>

              <div>
                <label className={label} htmlFor="edit-jd">Job description link</label>
                <input id="edit-jd" className={input} placeholder="https://…"
                  value={f.jd_url ?? ""} onChange={(e) => set("jd_url", e.target.value)} />
                <Err k="jd_url" />
              </div>

              <div>
                <label className={label} htmlFor="edit-prefs">Who you're looking for</label>
                <textarea id="edit-prefs" rows={2} className={`${input} resize-none`}
                  value={f.preferences ?? ""} onChange={(e) => set("preferences", e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={label} htmlFor="edit-loc">Location</label>
                <input id="edit-loc" className={input} value={f.location_text ?? ""} onChange={(e) => set("location_text", e.target.value)} />
                <Err k="location_text" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="edit-pay">Pay (₹/hr)</label>
                  <input id="edit-pay" type="number" min={1} className={input}
                    value={f.pay_rate ?? ""} onChange={(e) => set("pay_rate", e.target.value === "" ? "" : Number(e.target.value))} />
                  <Err k="pay_rate" />
                </div>
                <div>
                  <label className={label} htmlFor="edit-hrs">Hours</label>
                  <input id="edit-hrs" type="number" min={1} className={input}
                    value={f.duration_hrs ?? ""} onChange={(e) => set("duration_hrs", e.target.value === "" ? "" : Number(e.target.value))} />
                  <Err k="duration_hrs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="edit-date">Date</label>
                  <input id="edit-date" type="date" className={input}
                    value={f.event_date ?? ""} onChange={(e) => set("event_date", e.target.value)} />
                  <Err k="event_date" />
                </div>
                <div>
                  <label className={label} htmlFor="edit-slots">Openings</label>
                  <input id="edit-slots" type="number" min={1} className={input}
                    value={f.slots_total ?? 1} onChange={(e) => set("slots_total", e.target.value === "" ? "" : Number(e.target.value))} />
                  <Err k="slots_total" />
                </div>
              </div>

              {f.pay_rate && f.duration_hrs ? (
                <p className="text-[11px] font-bold text-white/40">
                  Each person earns ₹{(Number(f.pay_rate) * Number(f.duration_hrs)).toLocaleString("en-IN")}
                </p>
              ) : null}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={Boolean(f.is_urgent)} onChange={(e) => set("is_urgent", e.target.checked)}
                  className="w-4 h-4 accent-[#F4511E]" />
                <span className="text-xs font-bold text-white/70">Mark as urgent</span>
              </label>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose}
            className="flex-1 py-3.5 bg-[#111111] border border-white/10 text-white/70 hover:text-white rounded-xl font-black text-sm btn-tap transition-colors">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
