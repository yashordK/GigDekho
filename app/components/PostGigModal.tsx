import { useState, useEffect, useRef } from "react";
import { supabase } from "~/lib/supabase.client";
import { fetchSkillCategories } from "~/lib/categories";
import LocationPicker from "./LocationPicker";
import CoverImagePicker, { type CoverValue } from "./CoverImagePicker";
import {
  X, Plus, Trash2, Calendar, MapPin, AlertCircle, ChevronLeft, ChevronRight, Check,
  Users, GraduationCap, Briefcase, Clock, IndianRupee, Link2, FileText,
} from "lucide-react";

interface RoleForm {
  role_type: string;
  custom_role: string;
  pay_rate: number | "";
  duration_hrs: number | "";
  slots_total: number | "";
  isCustom: boolean;
}

export interface GigTemplate {
  eventTitle: string;
  description?: string;
  roles: Partial<RoleForm>[];
}

interface PostGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  /** Optional quick template — prefills the event form so repeat posting is one tap */
  template?: GigTemplate | null;
}

type HiringType = "event" | "internship";

const emptyRole = (): RoleForm => ({
  role_type: "", custom_role: "", pay_rate: "", duration_hrs: "", slots_total: "", isCustom: false,
});

const QUALIFICATION_HINT = "e.g. Students in their pre-final year, comfortable with Figma";

export default function PostGigModal({ isOpen, onClose, onSuccess, user, showToast, template }: PostGigModalProps) {
  const [hiringType, setHiringType] = useState<HiringType | null>(null);
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Shared / event state ──────────────────────────────────────────
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [location, setLocation] = useState({
    location_text: "", lat: null as number | null, lng: null as number | null, is_remote: false,
  });
  const [roles, setRoles] = useState<RoleForm[]>([emptyRole()]);
  const [cover, setCover] = useState<CoverValue>({ cover_mode: "default", cover_image_url: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [roleErrors, setRoleErrors] = useState<any[]>([]);

  // ── Internship state ──────────────────────────────────────────────
  const [intern, setIntern] = useState({
    title: "",
    role_type: "",
    isCustomRole: false,
    custom_role: "",
    work_mode: "onsite" as "onsite" | "hybrid" | "remote",
    commitment: "part_time" as "full_time" | "part_time",
    duration_months: "" as number | "",
    openings: 1 as number | "",
    is_unpaid: false,
    stipend_min: "" as number | "",
    stipend_max: "" as number | "",
    start_date: "",
    deadline: "",
    description: "",
    jd_url: "",
    preferences: "",
  });

  // Searchable role selector
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchSkillCategories().then(setCategories);
    // A template always means an event posting
    setHiringType(template ? "event" : null);
    setStep(1);
    setEventTitle(template?.eventTitle ?? "");
    setEventDate("");
    setEventDescription(template?.description ?? "");
    setIsUrgent(false);
    setLocation({ location_text: "", lat: null, lng: null, is_remote: false });
    setRoles(template?.roles?.length ? template.roles.map((r) => ({ ...emptyRole(), ...r })) : [emptyRole()]);
    setErrors({});
    setRoleErrors([]);
    setCover({ cover_mode: "default", cover_image_url: null });
    setIntern({
      title: "", role_type: "", isCustomRole: false, custom_role: "",
      work_mode: "onsite", commitment: "part_time", duration_months: "", openings: 1,
      is_unpaid: false, stipend_min: "", stipend_max: "",
      start_date: "", deadline: "", description: "", jd_url: "", preferences: "",
    });
  }, [isOpen, template]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const setI = (k: keyof typeof intern, v: any) => {
    setIntern((s) => ({ ...s, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  };

  const groupedCategories = categories.reduce((groups: any, cat) => {
    const group = cat.category_group || "Other";
    (groups[group] ??= []).push(cat);
    return groups;
  }, {});

  // ── Validation ────────────────────────────────────────────────────
  const validateEventStep1 = () => {
    const e: Record<string, string> = {};
    if (!eventTitle.trim()) e.title = "Event title is required";
    else if (eventTitle.trim().length < 3) e.title = "Event title must be at least 3 characters";
    if (!eventDate) e.eventDate = "Event date and time is required";
    else if (new Date(eventDate) <= new Date()) e.eventDate = "Event date must be in the future";
    if (!location.is_remote && !location.location_text.trim()) e.location = "Please select a physical location or toggle Remote";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateEventStep2 = () => {
    const newErrors = roles.map((role) => {
      const e: any = {};
      if (!role.isCustom && !role.role_type) e.role_type = "Please select a role";
      if (role.isCustom && !role.custom_role.trim()) e.custom_role = "Custom role name is required";
      if (role.pay_rate === "") e.pay_rate = "Pay rate is required";
      else if (Number(role.pay_rate) < 50 || Number(role.pay_rate) > 10000) e.pay_rate = "Pay rate must be between ₹50 and ₹10,000";
      if (role.duration_hrs === "") e.duration_hrs = "Duration is required";
      else if (Number(role.duration_hrs) < 0.5 || Number(role.duration_hrs) > 24) e.duration_hrs = "Duration must be between 0.5 and 24 hours";
      if (role.slots_total === "") e.slots_total = "Slots count is required";
      else if (Number(role.slots_total) < 1 || Number(role.slots_total) > 100) e.slots_total = "Slots must be between 1 and 100";
      return e;
    });
    setRoleErrors(newErrors);
    return newErrors.every((err) => Object.keys(err).length === 0);
  };

  const validateInternStep1 = () => {
    const e: Record<string, string> = {};
    if (!intern.title.trim()) e.title = "Give the role a clear title";
    else if (intern.title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (!intern.isCustomRole && !intern.role_type) e.role_type = "Pick the closest domain";
    if (intern.isCustomRole && !intern.custom_role.trim()) e.custom_role = "Enter the domain";
    if (intern.work_mode !== "remote" && !location.location_text.trim()) e.location = "Add the office location, or switch to Remote";
    if (!intern.openings || Number(intern.openings) < 1 || Number(intern.openings) > 50) e.openings = "Openings must be between 1 and 50";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateInternStep2 = () => {
    const e: Record<string, string> = {};
    if (!intern.duration_months || Number(intern.duration_months) < 1 || Number(intern.duration_months) > 24) {
      e.duration_months = "Enter a duration between 1 and 24 months";
    }
    if (!intern.is_unpaid) {
      if (intern.stipend_min === "" || Number(intern.stipend_min) < 0) e.stipend_min = "Enter a monthly stipend, or mark the role unpaid";
      else if (intern.stipend_max !== "" && Number(intern.stipend_max) < Number(intern.stipend_min)) {
        e.stipend_max = "Maximum can't be less than the minimum";
      }
    }
    if (!intern.start_date) e.start_date = "Expected start date is required";
    if (intern.deadline && intern.start_date && new Date(intern.deadline) > new Date(intern.start_date)) {
      e.deadline = "Deadline should be on or before the start date";
    }
    if (!intern.description.trim() && !intern.jd_url.trim()) {
      e.description = "Add a job description, or link to one";
    }
    if (intern.jd_url.trim() && !/^https?:\/\/.+\..+/.test(intern.jd_url.trim())) {
      e.jd_url = "Link must start with http:// or https://";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNextStep = () => {
    const ok = hiringType === "event"
      ? (step === 1 ? validateEventStep1() : validateEventStep2())
      : (step === 1 ? validateInternStep1() : validateInternStep2());
    if (ok) setStep(step + 1);
  };

  // ── Roles management (event) ──────────────────────────────────────
  const addRoleCard = () => {
    if (roles.length >= 10) { showToast("Maximum of 10 roles allowed per event", "error"); return; }
    setRoles([...roles, emptyRole()]);
    setRoleErrors([...roleErrors, {}]);
  };
  const removeRoleCard = (index: number) => {
    if (roles.length <= 1) { showToast("At least 1 role is required", "error"); return; }
    setRoles(roles.filter((_, i) => i !== index));
    setRoleErrors(roleErrors.filter((_, i) => i !== index));
  };
  const updateRoleField = (index: number, field: keyof RoleForm, val: any) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: val };
    setRoles(updated);
    if (roleErrors[index]) {
      const updatedErr = { ...roleErrors[index] };
      delete updatedErr[field];
      const next = [...roleErrors];
      next[index] = updatedErr;
      setRoleErrors(next);
    }
  };

  const calculateTotalCost = () =>
    roles.reduce((sum, r) => sum + Number(r.pay_rate || 0) * Number(r.duration_hrs || 0) * Number(r.slots_total || 0), 0);

  /**
   * Turns Postgres/PostgREST failures into something a hirer can act on.
   * 42501 (RLS) almost always means the session expired underneath them —
   * auth.uid() is null, so the row looks like it belongs to someone else.
   */
  const explainError = (err: any) => {
    const code = err?.code;
    if (code === "42501") {
      return "Your session has expired. Please sign in again and re-post — nothing was saved.";
    }
    if (code === "23502") {
      return "Something's missing from the listing. Go back and check every required field is filled.";
    }
    if (code === "23514") {
      return "One of the values isn't allowed. Check the stipend, duration and headcount.";
    }
    return err?.message || "Failed to post. Try again.";
  };

  /**
   * Inserts gigs, and if the cover columns aren't in the database yet,
   * retries without them.
   *
   * Deploys and migrations don't land at the same instant, and a listing
   * failing to post is a far worse outcome than one going up with the
   * default cover. Once migration 011 is applied this fallback never fires.
   */
  const insertGigs = async (rows: any[]) => {
    const first = await supabase.from("gigs").insert(rows);
    if (!first.error) return { error: null, coverSkipped: false };

    const msg = `${first.error.message} ${first.error.code ?? ""}`;
    const missingCoverColumn =
      /cover_mode|cover_image_url/.test(msg) &&
      /does not exist|schema cache|column/i.test(msg);
    if (!missingCoverColumn) return { error: first.error, coverSkipped: false };

    const stripped = rows.map(({ cover_mode, cover_image_url, ...rest }) => rest);
    const retry = await supabase.from("gigs").insert(stripped);
    return { error: retry.error, coverSkipped: !retry.error };
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Catch a dead session before we build the payload, so the hirer gets a
      // clear "sign in again" instead of an opaque RLS rejection.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showToast("Your session has expired. Please sign in again — nothing was lost.", "error");
        setLoading(false);
        return;
      }

      if (hiringType === "event") {
        if (!validateEventStep1() || !validateEventStep2()) {
          showToast("Please fix the validation errors before submitting", "error");
          setLoading(false);
          return;
        }
        const gigInserts = roles.map((role) => ({
          organizer_id: user.id,
          gig_type: "event",
          title: `${eventTitle} — ${role.isCustom ? role.custom_role : role.role_type}`,
          description: eventDescription,
          role_type: role.isCustom ? null : role.role_type,
          custom_role: role.isCustom ? role.custom_role : null,
          pay_rate: Number(role.pay_rate),
          duration_hrs: Number(role.duration_hrs),
          slots_total: Number(role.slots_total),
          slots_filled: 0,
          event_date: new Date(eventDate).toISOString(),
          location_text: location.location_text,
          lat: location.lat,
          lng: location.lng,
          is_urgent: isUrgent,
          cover_mode: cover.cover_mode,
          cover_image_url: cover.cover_mode === "custom" ? cover.cover_image_url : null,
          status: "open",
        }));
        const { error, coverSkipped } = await insertGigs(gigInserts);
        if (error) throw error;
        showToast(coverSkipped ? "Event posted! (Cover images aren't enabled yet.)" : "Event posted successfully!", "success");
      } else {
        if (!validateInternStep1() || !validateInternStep2()) {
          showToast("Please fix the validation errors before submitting", "error");
          setLoading(false);
          return;
        }
        const { error, coverSkipped } = await insertGigs([{
          organizer_id: user.id,
          gig_type: "internship",
          title: intern.title.trim(),
          description: intern.description.trim() || null,
          role_type: intern.isCustomRole ? null : intern.role_type,
          custom_role: intern.isCustomRole ? intern.custom_role.trim() : null,
          // event_date doubles as the expected start date for internships
          event_date: new Date(intern.start_date).toISOString(),
          location_text: intern.work_mode === "remote" ? "Remote" : location.location_text,
          lat: intern.work_mode === "remote" ? null : location.lat,
          lng: intern.work_mode === "remote" ? null : location.lng,
          slots_total: Number(intern.openings),
          slots_filled: 0,
          pay_rate: 0,
          duration_hrs: 0,
          work_mode: intern.work_mode,
          commitment: intern.commitment,
          duration_months: Number(intern.duration_months),
          is_unpaid: intern.is_unpaid,
          stipend_min: intern.is_unpaid ? null : Number(intern.stipend_min),
          stipend_max: intern.is_unpaid || intern.stipend_max === "" ? null : Number(intern.stipend_max),
          jd_url: intern.jd_url.trim() || null,
          preferences: intern.preferences.trim() || null,
          application_deadline: intern.deadline ? new Date(intern.deadline).toISOString() : null,
          cover_mode: cover.cover_mode,
          cover_image_url: cover.cover_mode === "custom" ? cover.cover_image_url : null,
          status: "open",
        }]);
        if (error) throw error;
        showToast(coverSkipped ? "Listing posted! (Cover images aren't enabled yet.)" : "Listing posted! Applications will appear on your dashboard.", "success");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(explainError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ─────────────────────────────────────────────────
  const inputCls = (bad?: string) =>
    `w-full h-11 px-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 ${bad ? "border-red-500" : "border-white/5"}`;
  const labelCls = "text-xs font-black text-white/60 uppercase tracking-wider";
  const Err = ({ msg }: { msg?: string }) => msg ? (
    <p className="text-red-400 text-xs font-semibold flex items-center gap-1 mt-1"><AlertCircle size={12} /> {msg}</p>
  ) : null;

  const totalSteps = 3;
  const stipendLabel = intern.is_unpaid
    ? "Unpaid"
    : intern.stipend_max && Number(intern.stipend_max) > Number(intern.stipend_min || 0)
      ? `₹${Number(intern.stipend_min).toLocaleString("en-IN")} – ₹${Number(intern.stipend_max).toLocaleString("en-IN")}/mo`
      : intern.stipend_min !== "" ? `₹${Number(intern.stipend_min).toLocaleString("en-IN")}/mo` : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 animate-in fade-in duration-200">
      <div className="bg-[#111111] md:bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-[640px] h-[100dvh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom md:zoom-in duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg lg:text-xl font-black text-white">
              {hiringType === null ? "What are you hiring for?"
                : hiringType === "event" ? "Post an Event Gig" : "Post an Internship / Job"}
            </h2>
            {hiringType && (
              <span className="text-[11px] font-bold text-[#F4511E] uppercase tracking-wider">
                Step {step} of {totalSteps}
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap">
            <X size={20} />
          </button>
        </div>

        {hiringType && (
          <div className="flex w-full h-1 bg-[#111111]">
            <div className={`h-full bg-[#F4511E] transition-all duration-300 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">

          {/* ══ TYPE CHOOSER ══ */}
          {hiringType === null && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-sm font-medium text-white/50">
                Pick the kind of hiring you're doing. The form adapts to match.
              </p>
              <button
                type="button"
                onClick={() => { setHiringType("event"); setStep(1); }}
                className="w-full text-left bg-[#1C1C1C] md:bg-[#111111] border border-white/10 hover:border-[#F4511E]/50 rounded-2xl p-5 flex items-start gap-4 transition-all btn-tap group"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center shrink-0">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="font-black text-white text-base mb-1">Event / Temporary Staff</h3>
                  <p className="text-xs font-medium text-white/50 leading-relaxed">
                    Waitstaff, helpers, photographers, promoters and more for a specific date. Workers are confirmed first-come-first-served and paid per gig.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setHiringType("internship"); setStep(1); }}
                className="w-full text-left bg-[#1C1C1C] md:bg-[#111111] border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 flex items-start gap-4 transition-all btn-tap group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h3 className="font-black text-white text-base mb-1">Internship / Job</h3>
                  <p className="text-xs font-medium text-white/50 leading-relaxed">
                    Ongoing roles with a stipend and a duration. Candidates submit a full application with their resume, and you shortlist from your dashboard.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ══ EVENT — STEP 1 ══ */}
          {hiringType === "event" && step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-title" className={labelCls}>Event Title / Prefix</label>
                <input id="gig-event-title" type="text" placeholder="e.g. Indore Tech Summit, Sunburn Arena"
                  value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className={inputCls(errors.title)} />
                <Err msg={errors.title} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-date" className={labelCls}>Event Date & Time</label>
                <input id="gig-event-date" type="datetime-local" value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)} className={inputCls(errors.eventDate)} />
                <Err msg={errors.eventDate} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-desc" className={labelCls}>Event Description</label>
                <textarea id="gig-event-desc" rows={3} placeholder="Tell workers about your event, code of conduct, dress code details..."
                  value={eventDescription} onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 resize-none" />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className={labelCls}>Event Location</label>
                <LocationPicker value={location} onChange={setLocation} />
                <Err msg={errors.location} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className={labelCls}>Cover Image</label>
                <p className="text-[11px] font-medium text-white/40 -mt-0.5 mb-1">
                  Applicants see this on the listing. A default is picked for you — upload your own or turn it off.
                </p>
                <CoverImagePicker
                  value={cover}
                  onChange={setCover}
                  userId={user?.id}
                  roleHint={roles[0]?.isCustom ? roles[0]?.custom_role : roles[0]?.role_type}
                />
              </div>

              <div className="flex items-center justify-between bg-[#1C1C1C] md:bg-[#111111] p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white flex items-center gap-2">Mark as Urgent ⚡</span>
                  <span className="text-[11px] text-white/50 font-medium">Highlight this gig to hire workers faster</span>
                </div>
                <button type="button" onClick={() => setIsUrgent(!isUrgent)}
                  aria-pressed={isUrgent} aria-label="Mark as urgent"
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 btn-tap ${isUrgent ? "bg-[#F4511E]" : "bg-white/10"}`}>
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${isUrgent ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          )}

          {/* ══ EVENT — STEP 2 (roles) ══ */}
          {hiringType === "event" && step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Event Roles</h3>
                <span className="text-xs text-white/50 font-bold">{roles.length} role(s) added</span>
              </div>

              {roles.map((role, index) => {
                const rErrors = roleErrors[index] || {};
                const totalPay = Number(role.pay_rate || 0) * Number(role.duration_hrs || 0);
                return (
                  <div key={index} className="relative bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
                    {roles.length > 1 && (
                      <button onClick={() => removeRoleCard(index)} aria-label={`Remove role ${index + 1}`}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors btn-tap">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <h4 className="text-xs font-black text-[#F4511E] uppercase tracking-widest">Role #{index + 1}</h4>

                    <div className="flex flex-col space-y-1.5 relative">
                      <label className="text-[11px] font-black text-white/60 uppercase tracking-wider">Select Role Category</label>
                      {!role.isCustom ? (
                        <div>
                          <button type="button"
                            onClick={() => { setActiveDropdownIndex(activeDropdownIndex === index ? null : index); setRoleSearchQuery(""); }}
                            className={`w-full h-11 px-4 flex items-center justify-between rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-sm font-semibold ${rErrors.role_type ? "border-red-500 text-white/30" : "border-white/5 text-white"}`}>
                            <span>{role.role_type ? `${categories.find((c) => c.name === role.role_type)?.emoji || "💼"} ${role.role_type}` : "Select or search role..."}</span>
                            <span className="text-white/40 text-xs">▼</span>
                          </button>
                          {activeDropdownIndex === index && (
                            <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-xl shadow-2xl p-2 max-h-[250px] overflow-y-auto hide-scrollbar animate-in fade-in duration-100">
                              <input type="text" placeholder="Search roles..." value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)} aria-label="Search roles"
                                className="w-full h-9 px-3 mb-2 rounded-lg bg-[#111111] md:bg-[#1C1C1C] border border-white/5 text-white text-xs font-bold focus-visible:outline-[#F4511E] focus-visible:outline-2" />
                              <button type="button"
                                onClick={() => { updateRoleField(index, "isCustom", true); updateRoleField(index, "role_type", ""); setActiveDropdownIndex(null); }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-[#F4511E] hover:bg-white/5 rounded-lg">
                                ➕ Add Custom Role
                              </button>
                              <div className="border-t border-white/5 my-1.5" />
                              {Object.keys(groupedCategories).map((groupName) => {
                                const filtered = groupedCategories[groupName].filter((c: any) => c.name.toLowerCase().includes(roleSearchQuery.toLowerCase()));
                                if (filtered.length === 0) return null;
                                return (
                                  <div key={groupName} className="space-y-1">
                                    <div className="text-[10px] uppercase font-black tracking-wider text-white/30 px-3 py-1">{groupName}</div>
                                    {filtered.map((cat: any) => (
                                      <button key={cat.id} type="button"
                                        onClick={() => { updateRoleField(index, "role_type", cat.name); setActiveDropdownIndex(null); }}
                                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-between ${role.role_type === cat.name ? "bg-[#F4511E]/10 text-white" : "text-white/70 hover:bg-white/5"}`}>
                                        <span>{cat.emoji} {cat.name}</span>
                                        {role.role_type === cat.name && <Check size={14} className="text-[#F4511E]" />}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="text" placeholder="Enter custom role (e.g. Laser Tech, Coordinator)" value={role.custom_role}
                            onChange={(e) => updateRoleField(index, "custom_role", e.target.value)} aria-label="Custom role name"
                            className={`flex-1 h-11 px-4 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] ${rErrors.custom_role ? "border-red-500" : "border-white/5"}`} />
                          <button type="button" onClick={() => { updateRoleField(index, "isCustom", false); updateRoleField(index, "custom_role", ""); }}
                            className="px-4 text-[11px] font-black text-white/60 bg-[#111111] md:bg-[#1C1C1C] border border-white/5 rounded-xl hover:bg-white/5 btn-tap">
                            Reset
                          </button>
                        </div>
                      )}
                      <Err msg={rErrors.role_type || rErrors.custom_role} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor={`pay-${index}`} className="text-[10px] font-black text-white/60 uppercase tracking-wider">Pay (₹/hr)</label>
                        <input id={`pay-${index}`} type="number" placeholder="200" value={role.pay_rate}
                          onChange={(e) => updateRoleField(index, "pay_rate", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${rErrors.pay_rate ? "border-red-500" : "border-white/5"}`} />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor={`hrs-${index}`} className="text-[10px] font-black text-white/60 uppercase tracking-wider">Hours</label>
                        <input id={`hrs-${index}`} type="number" step="0.5" placeholder="6" value={role.duration_hrs}
                          onChange={(e) => updateRoleField(index, "duration_hrs", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${rErrors.duration_hrs ? "border-red-500" : "border-white/5"}`} />
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label htmlFor={`slots-${index}`} className="text-[10px] font-black text-white/60 uppercase tracking-wider">Workers</label>
                        <input id={`slots-${index}`} type="number" placeholder="5" value={role.slots_total}
                          onChange={(e) => updateRoleField(index, "slots_total", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${rErrors.slots_total ? "border-red-500" : "border-white/5"}`} />
                      </div>
                    </div>
                    <Err msg={rErrors.pay_rate || rErrors.duration_hrs || rErrors.slots_total} />

                    {role.pay_rate && role.duration_hrs && (
                      <div className="flex justify-between items-center bg-[#111111] md:bg-[#1C1C1C] px-4 py-2.5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Payout per worker</span>
                        <span className="text-xs font-black text-[#F4511E]">₹{totalPay}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <button type="button" onClick={addRoleCard}
                className="w-full h-11 border border-dashed border-[#F4511E]/40 text-[#F4511E] rounded-xl flex items-center justify-center font-bold text-sm hover:bg-[#F4511E]/5 transition-colors btn-tap">
                <Plus size={16} className="mr-1.5" /> Add Another Role
              </button>
            </div>
          )}

          {/* ══ EVENT — STEP 3 (review) ══ */}
          {hiringType === "event" && step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Review Event Details</h3>
              <div className="bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-3 shadow-inner">
                <div className="flex justify-between"><span className="text-xs font-bold text-white/40">Event Title</span><span className="text-xs font-black text-white">{eventTitle}</span></div>
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-white/40">Date & Time</span>
                  <span className="text-xs font-black text-white flex items-center gap-1">
                    <Calendar size={13} className="text-[#F4511E]" />
                    {new Date(eventDate).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-white/40">Location</span>
                  <span className="text-xs font-black text-white max-w-[200px] truncate flex items-center gap-1">
                    <MapPin size={13} className="text-[#F4511E]" />
                    {location.is_remote ? "Remote (Work from Home)" : location.location_text}
                  </span>
                </div>
                {isUrgent && (
                  <div className="bg-[#F4511E]/15 text-[#F4511E] border border-[#F4511E]/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center">
                    ⚡ Urgent Recruitment Enabled
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black text-white/60 uppercase tracking-wider">Roles Breakdown</h4>
                {roles.map((role, idx) => (
                  <div key={idx} className="bg-[#1C1C1C] md:bg-[#111111] border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white">{role.isCustom ? role.custom_role : role.role_type}</span>
                      <span className="text-[11px] text-white/50 font-semibold">₹{role.pay_rate}/hr · {role.duration_hrs}hrs · {role.slots_total} slots</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white/40 block">Est. Cost</span>
                      <span className="text-sm font-black text-white">₹{Number(role.pay_rate || 0) * Number(role.duration_hrs || 0) * Number(role.slots_total || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-5 flex justify-between items-baseline">
                <span className="text-sm font-black text-white uppercase tracking-wider">Total Event Estimate</span>
                <div className="text-right">
                  <span className="text-3xl font-black text-[#F4511E] tracking-tight">₹{calculateTotalCost()}</span>
                  <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider mt-0.5">* Platform fee applies</span>
                </div>
              </div>
            </div>
          )}

          {/* ══ INTERNSHIP — STEP 1 (role) ══ */}
          {hiringType === "internship" && step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-title" className={labelCls}>Role Title</label>
                <input id="int-title" type="text" placeholder="e.g. Marketing Intern, Junior Web Developer"
                  value={intern.title} onChange={(e) => setI("title", e.target.value)} className={inputCls(errors.title)} />
                <Err msg={errors.title} />
              </div>

              <div className="flex flex-col space-y-1.5 relative">
                <label className={labelCls}>Domain</label>
                {!intern.isCustomRole ? (
                  <div>
                    <button type="button"
                      onClick={() => { setActiveDropdownIndex(activeDropdownIndex === -1 ? null : -1); setRoleSearchQuery(""); }}
                      className={`w-full h-11 px-4 flex items-center justify-between rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-sm font-semibold ${errors.role_type ? "border-red-500 text-white/30" : "border-white/5 text-white"}`}>
                      <span>{intern.role_type ? `${categories.find((c) => c.name === intern.role_type)?.emoji || "💼"} ${intern.role_type}` : "Select or search domain..."}</span>
                      <span className="text-white/40 text-xs">▼</span>
                    </button>
                    {activeDropdownIndex === -1 && (
                      <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-xl shadow-2xl p-2 max-h-[250px] overflow-y-auto hide-scrollbar animate-in fade-in duration-100">
                        <input type="text" placeholder="Search domains..." value={roleSearchQuery}
                          onChange={(e) => setRoleSearchQuery(e.target.value)} aria-label="Search domains"
                          className="w-full h-9 px-3 mb-2 rounded-lg bg-[#111111] md:bg-[#1C1C1C] border border-white/5 text-white text-xs font-bold focus-visible:outline-[#F4511E] focus-visible:outline-2" />
                        <button type="button"
                          onClick={() => { setI("isCustomRole", true); setI("role_type", ""); setActiveDropdownIndex(null); }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-[#F4511E] hover:bg-white/5 rounded-lg">
                          ➕ Add Custom Domain
                        </button>
                        <div className="border-t border-white/5 my-1.5" />
                        {Object.keys(groupedCategories).map((groupName) => {
                          const filtered = groupedCategories[groupName].filter((c: any) => c.name.toLowerCase().includes(roleSearchQuery.toLowerCase()));
                          if (filtered.length === 0) return null;
                          return (
                            <div key={groupName} className="space-y-1">
                              <div className="text-[10px] uppercase font-black tracking-wider text-white/30 px-3 py-1">{groupName}</div>
                              {filtered.map((cat: any) => (
                                <button key={cat.id} type="button"
                                  onClick={() => { setI("role_type", cat.name); setActiveDropdownIndex(null); }}
                                  className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-between ${intern.role_type === cat.name ? "bg-[#F4511E]/10 text-white" : "text-white/70 hover:bg-white/5"}`}>
                                  <span>{cat.emoji} {cat.name}</span>
                                  {intern.role_type === cat.name && <Check size={14} className="text-[#F4511E]" />}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. Operations, Business Development" value={intern.custom_role}
                      onChange={(e) => setI("custom_role", e.target.value)} aria-label="Custom domain"
                      className={`flex-1 h-11 px-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] ${errors.custom_role ? "border-red-500" : "border-white/5"}`} />
                    <button type="button" onClick={() => { setI("isCustomRole", false); setI("custom_role", ""); }}
                      className="px-4 text-[11px] font-black text-white/60 bg-[#1C1C1C] md:bg-[#111111] border border-white/5 rounded-xl hover:bg-white/5 btn-tap">Reset</button>
                  </div>
                )}
                <Err msg={errors.role_type || errors.custom_role} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className={labelCls}>Work Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: "onsite", l: "On-site" },
                    { v: "hybrid", l: "Hybrid" },
                    { v: "remote", l: "Remote" },
                  ] as const).map((m) => (
                    <button key={m.v} type="button" onClick={() => setI("work_mode", m.v)}
                      className={`py-2.5 rounded-xl text-xs font-bold border btn-tap transition-colors ${intern.work_mode === m.v ? "bg-[#F4511E] border-[#F4511E] text-white" : "bg-transparent border-white/10 text-white/60 hover:border-[#F4511E]/50"}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              {intern.work_mode !== "remote" && (
                <div className="flex flex-col space-y-1.5">
                  <label className={labelCls}>Office Location</label>
                  <LocationPicker value={location} onChange={setLocation} />
                  <Err msg={errors.location} />
                </div>
              )}

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-openings" className={labelCls}>Number of Openings</label>
                <input id="int-openings" type="number" min={1} max={50} value={intern.openings}
                  onChange={(e) => setI("openings", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls(errors.openings)} />
                <Err msg={errors.openings} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className={labelCls}>Cover Image</label>
                <p className="text-[11px] font-medium text-white/40 -mt-0.5 mb-1">
                  Shown to candidates on the listing. Upload your own, or turn it off for a clean text-only look.
                </p>
                <CoverImagePicker
                  value={cover}
                  onChange={setCover}
                  userId={user?.id}
                  roleHint={intern.isCustomRole ? intern.custom_role : intern.role_type}
                />
              </div>
            </div>
          )}

          {/* ══ INTERNSHIP — STEP 2 (terms + JD) ══ */}
          {hiringType === "internship" && step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col space-y-1.5">
                <label className={labelCls}>Commitment</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: "part_time", l: "Part-time" },
                    { v: "full_time", l: "Full-time" },
                  ] as const).map((c) => (
                    <button key={c.v} type="button" onClick={() => setI("commitment", c.v)}
                      className={`py-2.5 rounded-xl text-xs font-bold border btn-tap transition-colors ${intern.commitment === c.v ? "bg-[#F4511E] border-[#F4511E] text-white" : "bg-transparent border-white/10 text-white/60 hover:border-[#F4511E]/50"}`}>
                      {c.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-duration" className={labelCls}>Minimum Duration (months)</label>
                <input id="int-duration" type="number" min={1} max={24} placeholder="e.g. 3" value={intern.duration_months}
                  onChange={(e) => setI("duration_months", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls(errors.duration_months)} />
                <Err msg={errors.duration_months} />
              </div>

              <div className="bg-[#1C1C1C] md:bg-[#111111] p-4 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white">This role is unpaid</span>
                    <span className="text-[11px] text-white/50 font-medium">Unpaid roles get far fewer applicants</span>
                  </div>
                  <button type="button" onClick={() => setI("is_unpaid", !intern.is_unpaid)}
                    aria-pressed={intern.is_unpaid} aria-label="Mark role as unpaid"
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 btn-tap ${intern.is_unpaid ? "bg-[#F4511E]" : "bg-white/10"}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${intern.is_unpaid ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>

                {!intern.is_unpaid && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col space-y-1.5">
                      <label htmlFor="int-smin" className="text-[10px] font-black text-white/60 uppercase tracking-wider">Stipend from (₹/month)</label>
                      <input id="int-smin" type="number" min={0} placeholder="5000" value={intern.stipend_min}
                        onChange={(e) => setI("stipend_min", e.target.value === "" ? "" : Number(e.target.value))}
                        className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${errors.stipend_min ? "border-red-500" : "border-white/5"}`} />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <label htmlFor="int-smax" className="text-[10px] font-black text-white/60 uppercase tracking-wider">Up to (optional)</label>
                      <input id="int-smax" type="number" min={0} placeholder="8000" value={intern.stipend_max}
                        onChange={(e) => setI("stipend_max", e.target.value === "" ? "" : Number(e.target.value))}
                        className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${errors.stipend_max ? "border-red-500" : "border-white/5"}`} />
                    </div>
                  </div>
                )}
                <Err msg={errors.stipend_min || errors.stipend_max} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="int-start" className={labelCls}>Expected Start Date</label>
                  <input id="int-start" type="date" value={intern.start_date}
                    onChange={(e) => setI("start_date", e.target.value)} className={inputCls(errors.start_date)} />
                  <Err msg={errors.start_date} />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="int-deadline" className={labelCls}>Apply By (optional)</label>
                  <input id="int-deadline" type="date" value={intern.deadline}
                    onChange={(e) => setI("deadline", e.target.value)} className={inputCls(errors.deadline)} />
                  <Err msg={errors.deadline} />
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-desc" className={labelCls}>Job Description</label>
                <textarea id="int-desc" rows={4} placeholder="What will they work on day to day? What will they learn?"
                  value={intern.description} onChange={(e) => setI("description", e.target.value)}
                  className={`w-full p-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 resize-none ${errors.description ? "border-red-500" : "border-white/5"}`} />
                <Err msg={errors.description} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-jd" className={labelCls}>Or link to a full JD (optional)</label>
                <input id="int-jd" type="url" placeholder="https://..." value={intern.jd_url}
                  onChange={(e) => setI("jd_url", e.target.value)} className={inputCls(errors.jd_url)} />
                <Err msg={errors.jd_url} />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="int-pref" className={labelCls}>Who you're looking for (optional)</label>
                <textarea id="int-pref" rows={2} placeholder={QUALIFICATION_HINT}
                  value={intern.preferences} onChange={(e) => setI("preferences", e.target.value)}
                  className="w-full p-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 resize-none" />
              </div>
            </div>
          )}

          {/* ══ INTERNSHIP — STEP 3 (review) ══ */}
          {hiringType === "internship" && step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Review Listing</h3>

              <div className="bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-4">
                <div>
                  <h4 className="text-lg font-black text-white leading-tight">{intern.title}</h4>
                  <p className="text-[11px] font-bold text-[#F4511E] uppercase tracking-wider mt-0.5">
                    {intern.isCustomRole ? intern.custom_role : intern.role_type}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <IndianRupee size={13} />, label: "Stipend", value: stipendLabel },
                    { icon: <Clock size={13} />, label: "Duration", value: `${intern.duration_months} month${Number(intern.duration_months) !== 1 ? "s" : ""}` },
                    { icon: <Briefcase size={13} />, label: "Mode", value: `${intern.work_mode === "onsite" ? "On-site" : intern.work_mode === "hybrid" ? "Hybrid" : "Remote"} · ${intern.commitment === "full_time" ? "Full-time" : "Part-time"}` },
                    { icon: <Users size={13} />, label: "Openings", value: String(intern.openings) },
                    { icon: <Calendar size={13} />, label: "Starts", value: intern.start_date ? new Date(intern.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                    { icon: <MapPin size={13} />, label: "Location", value: intern.work_mode === "remote" ? "Remote" : (location.location_text || "—") },
                  ].map((f) => (
                    <div key={f.label} className="bg-[#111111] md:bg-[#1C1C1C] rounded-xl p-3 border border-white/5">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1">{f.icon} {f.label}</p>
                      <p className="text-xs font-black text-white truncate" title={f.value}>{f.value}</p>
                    </div>
                  ))}
                </div>

                {intern.deadline && (
                  <div className="bg-[#F4511E]/10 text-[#F4511E] border border-[#F4511E]/20 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-center">
                    Applications close {new Date(intern.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                )}

                {intern.description && (
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1 flex items-center gap-1"><FileText size={11} /> Description</p>
                    <p className="text-xs font-medium text-white/70 leading-relaxed whitespace-pre-wrap line-clamp-6">{intern.description}</p>
                  </div>
                )}
                {intern.jd_url && (
                  <p className="text-xs font-bold text-[#F4511E] flex items-center gap-1 truncate"><Link2 size={12} /> {intern.jd_url}</p>
                )}
                {intern.preferences && (
                  <div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Looking for</p>
                    <p className="text-xs font-medium text-white/70 leading-relaxed">{intern.preferences}</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
                <GraduationCap size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-white/60 leading-relaxed">
                  Candidates will submit a full application with their resume and details. You can shortlist them from your dashboard, and every application also lands in a live Google Sheet shared to your email.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hiringType && (
          <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-[#111111]">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : (setHiringType(null), setErrors({})))}
              className="px-6 py-3 min-h-[44px] border border-white/10 text-white hover:bg-white/5 rounded-xl flex items-center justify-center font-bold text-sm btn-tap"
            >
              <ChevronLeft size={16} className="mr-1" /> Back
            </button>

            {step < totalSteps ? (
              <button onClick={handleNextStep}
                className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap">
                Next <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50">
                {loading ? "Posting..." : hiringType === "event" ? "Confirm & Post" : "Publish Listing"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
