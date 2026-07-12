import { useState, useEffect, useRef } from "react";
import { supabase } from "~/lib/supabase.client";
import { fetchSkillCategories } from "~/lib/categories";
import LocationPicker from "./LocationPicker";
import { X, Plus, Trash2, Calendar, MapPin, AlertCircle, ChevronLeft, ChevronRight, Check } from "lucide-react";

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
  /** Optional quick template — prefills the form so repeat posting is one tap + date/headcount */
  template?: GigTemplate | null;
}

interface Step1Errors {
  title?: string;
  eventDate?: string;
  location?: string;
}

export default function PostGigModal({ isOpen, onClose, onSuccess, user, showToast, template }: PostGigModalProps) {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Step 1 State
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [location, setLocation] = useState({
    location_text: "",
    lat: null as number | null,
    lng: null as number | null,
    is_remote: false,
  });

  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});

  // Step 2 State
  const [roles, setRoles] = useState<RoleForm[]>([
    { role_type: "", custom_role: "", pay_rate: "", duration_hrs: "", slots_total: "", isCustom: false },
  ]);
  const [roleErrors, setRoleErrors] = useState<any[]>([]);

  // Searchable role selector active state
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load categories
  useEffect(() => {
    if (isOpen) {
      fetchSkillCategories().then((data) => {
        setCategories(data);
      });
      // Reset state on open (prefilled from template when provided)
      const emptyRole: RoleForm = { role_type: "", custom_role: "", pay_rate: "", duration_hrs: "", slots_total: "", isCustom: false };
      setStep(1);
      setEventTitle(template?.eventTitle ?? "");
      setEventDate("");
      setEventDescription(template?.description ?? "");
      setIsUrgent(false);
      setLocation({ location_text: "", lat: null, lng: null, is_remote: false });
      setRoles(
        template?.roles?.length
          ? template.roles.map((r) => ({ ...emptyRole, ...r }))
          : [emptyRole]
      );
      setStep1Errors({});
      setRoleErrors([]);
    }
  }, [isOpen, template]);

  // Click outside searchable dropdown to close it
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

  // Validation step 1
  const validateStep1 = (): boolean => {
    const errors: Step1Errors = {};
    if (!eventTitle.trim()) {
      errors.title = "Event title is required";
    } else if (eventTitle.trim().length < 3) {
      errors.title = "Event title must be at least 3 characters";
    }

    if (!eventDate) {
      errors.eventDate = "Event date and time is required";
    } else {
      const selectedDate = new Date(eventDate);
      if (selectedDate <= new Date()) {
        errors.eventDate = "Event date must be in the future";
      }
    }

    if (!location.is_remote && !location.location_text.trim()) {
      errors.location = "Please select a physical location or toggle Remote";
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validation step 2
  const validateStep2 = (): boolean => {
    const newErrors = roles.map((role) => {
      const errors: any = {};
      if (!role.isCustom && !role.role_type) {
        errors.role_type = "Please select a role";
      }
      if (role.isCustom && !role.custom_role.trim()) {
        errors.custom_role = "Custom role name is required";
      }

      if (role.pay_rate === "") {
        errors.pay_rate = "Pay rate is required";
      } else {
        const rate = Number(role.pay_rate);
        if (rate < 50 || rate > 10000) {
          errors.pay_rate = "Pay rate must be between ₹50 and ₹10,000";
        }
      }

      if (role.duration_hrs === "") {
        errors.duration_hrs = "Duration is required";
      } else {
        const duration = Number(role.duration_hrs);
        if (duration < 0.5 || duration > 24) {
          errors.duration_hrs = "Duration must be between 0.5 and 24 hours";
        }
      }

      if (role.slots_total === "") {
        errors.slots_total = "Slots count is required";
      } else {
        const slots = Number(role.slots_total);
        if (slots < 1 || slots > 100) {
          errors.slots_total = "Slots must be between 1 and 100";
        }
      }

      return errors;
    });

    setRoleErrors(newErrors);
    return newErrors.every((err) => Object.keys(err).length === 0);
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (step === 2) {
      if (validateStep2()) {
        setStep(3);
      }
    }
  };

  const handleBackStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Roles management
  const addRoleCard = () => {
    if (roles.length >= 10) {
      showToast("Maximum of 10 roles allowed per event", "error");
      return;
    }
    setRoles([...roles, { role_type: "", custom_role: "", pay_rate: "", duration_hrs: "", slots_total: "", isCustom: false }]);
    setRoleErrors([...roleErrors, {}]);
  };

  const removeRoleCard = (index: number) => {
    if (roles.length <= 1) {
      showToast("At least 1 role is required", "error");
      return;
    }
    const updated = roles.filter((_, i) => i !== index);
    const updatedErrors = roleErrors.filter((_, i) => i !== index);
    setRoles(updated);
    setRoleErrors(updatedErrors);
  };

  const updateRoleField = (index: number, field: keyof RoleForm, val: any) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: val };
    setRoles(updated);

    // Clear error for that field
    if (roleErrors[index]) {
      const updatedErr = { ...roleErrors[index] };
      delete updatedErr[field];
      const newRoleErrors = [...roleErrors];
      newRoleErrors[index] = updatedErr;
      setRoleErrors(newRoleErrors);
    }
  };

  // Calculate total event cost estimate
  const calculateTotalCost = () => {
    return roles.reduce((sum, role) => {
      const rate = Number(role.pay_rate || 0);
      const hours = Number(role.duration_hrs || 0);
      const slots = Number(role.slots_total || 0);
      return sum + rate * hours * slots;
    }, 0);
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2()) {
      showToast("Please fix the validation errors before submitting", "error");
      return;
    }

    setLoading(true);
    try {
      const gigInserts = roles.map((role) => ({
        organizer_id: user.id,
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
        status: "open",
      }));

      const { error } = await supabase.from("gigs").insert(gigInserts);

      if (error) throw error;

      showToast("Event posted successfully!", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to post gig(s). Try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to group categories by category_group
  const groupedCategories = categories.reduce((groups: any, cat) => {
    const group = cat.category_group || "Other";
    if (!groups[group]) groups[group] = [];
    groups[group].push(cat);
    return groups;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 animate-in fade-in duration-200">
      {/* Modal Box */}
      <div className="bg-[#111111] md:bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-[640px] h-[100dvh] md:h-auto md:max-h-[90vh] rounded-t-3xl md:rounded-3xl flex flex-col shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom md:zoom-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg lg:text-xl font-black text-white">Post Live Gig</h2>
            <span className="text-[11px] font-bold text-[#F4511E] uppercase tracking-wider">
              Step {step} of 3
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="flex w-full h-1 bg-[#111111]">
          <div className={`h-full bg-[#F4511E] transition-all duration-300 ${step === 1 ? "w-1/3" : step === 2 ? "w-2/3" : "w-full"}`} />
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
          {/* STEP 1: EVENT DETAILS */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Event Name */}
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-title" className="text-xs font-black text-white/60 uppercase tracking-wider">Event Title / Prefix</label>
                <input
                  id="gig-event-title"
                  type="text"
                  placeholder="e.g. Indore Tech Summit, Sunburn Arena"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className={`w-full h-11 px-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 ${
                    step1Errors.title ? "border-red-500" : "border-white/5"
                  }`}
                />
                {step1Errors.title && (
                  <p className="text-red-400 text-xs font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> {step1Errors.title}
                  </p>
                )}
              </div>

              {/* Event Date & Time */}
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-date" className="text-xs font-black text-white/60 uppercase tracking-wider">Event Date & Time</label>
                <div className="relative">
                  <input
                    id="gig-event-date"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={`w-full h-11 px-4 pr-10 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] focus-visible:outline-2 ${
                      step1Errors.eventDate ? "border-red-500" : "border-white/5"
                    }`}
                  />
                </div>
                {step1Errors.eventDate && (
                  <p className="text-red-400 text-xs font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> {step1Errors.eventDate}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="gig-event-desc" className="text-xs font-black text-white/60 uppercase tracking-wider">Event Description</label>
                <textarea
                  id="gig-event-desc"
                  rows={3}
                  placeholder="Tell workers about your event, code of conduct, dress code details..."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[#1C1C1C] md:bg-[#111111] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2 resize-none"
                />
              </div>

              {/* Location Picker */}
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs font-black text-white/60 uppercase tracking-wider">Event Location</label>
                <LocationPicker value={location} onChange={(val) => setLocation(val)} />
                {step1Errors.location && (
                  <p className="text-red-400 text-xs font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> {step1Errors.location}
                  </p>
                )}
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-center justify-between bg-[#1C1C1C] md:bg-[#111111] p-4 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white flex items-center gap-2">
                    Mark as Urgent ⚡
                  </span>
                  <span className="text-[11px] text-white/50 font-medium">Highlight this gig to hire workers faster</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUrgent(!isUrgent)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 btn-tap ${
                    isUrgent ? "bg-[#F4511E]" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                      isUrgent ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ROLES */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Event Roles</h3>
                <span className="text-xs text-white/50 font-bold">{roles.length} role(s) added</span>
              </div>

              {roles.map((role, index) => {
                const errors = roleErrors[index] || {};
                const totalPay = Number(role.pay_rate || 0) * Number(role.duration_hrs || 0);

                return (
                  <div
                    key={index}
                    className="relative bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-4 shadow-sm"
                  >
                    {/* Delete button (only if > 1 role) */}
                    {roles.length > 1 && (
                      <button
                        onClick={() => removeRoleCard(index)}
                        aria-label={`Remove role ${index + 1}`}
                        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors btn-tap"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <h4 className="text-xs font-black text-[#F4511E] uppercase tracking-widest">
                      Role #{index + 1}
                    </h4>

                    {/* Searchable Custom Dropdown */}
                    <div className="flex flex-col space-y-1.5 relative">
                      <label className="text-[11px] font-black text-white/60 uppercase tracking-wider">Select Role Category</label>
                      
                      {!role.isCustom ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDropdownIndex(activeDropdownIndex === index ? null : index);
                              setRoleSearchQuery("");
                            }}
                            className={`w-full h-11 px-4 flex items-center justify-between rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-sm font-semibold ${
                              errors.role_type ? "border-red-500 text-white/30" : "border-white/5 text-white"
                            }`}
                          >
                            <span>
                              {role.role_type
                                ? `${categories.find((c) => c.name === role.role_type)?.emoji || "💼"} ${role.role_type}`
                                : "Select or search role..."}
                            </span>
                            <span className="text-white/40 text-xs">▼</span>
                          </button>

                          {/* Searchable Options Panel */}
                          {activeDropdownIndex === index && (
                            <div
                              ref={dropdownRef}
                              className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-xl shadow-2xl p-2 max-h-[250px] overflow-y-auto hide-scrollbar animate-in fade-in duration-100"
                            >
                              {/* Search field */}
                              <input
                                type="text"
                                placeholder="Search roles..."
                                value={roleSearchQuery}
                                onChange={(e) => setRoleSearchQuery(e.target.value)}
                                className="w-full h-9 px-3 mb-2 rounded-lg bg-[#111111] md:bg-[#1C1C1C] border border-white/5 text-white text-xs font-bold focus-visible:outline-[#F4511E] focus-visible:outline-2"
                              />

                              {/* Custom Role Trigger */}
                              <button
                                type="button"
                                onClick={() => {
                                  updateRoleField(index, "isCustom", true);
                                  updateRoleField(index, "role_type", "");
                                  setActiveDropdownIndex(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-[#F4511E] hover:bg-white/5 rounded-lg flex items-center justify-between"
                              >
                                <span>➕ Add Custom Role</span>
                              </button>

                              <div className="border-t border-white/5 my-1.5" />

                              {/* Render Groups */}
                              {Object.keys(groupedCategories).map((groupName) => {
                                const filtered = groupedCategories[groupName].filter((c: any) =>
                                  c.name.toLowerCase().includes(roleSearchQuery.toLowerCase())
                                );

                                if (filtered.length === 0) return null;

                                return (
                                  <div key={groupName} className="space-y-1">
                                    <div className="text-[10px] uppercase font-black tracking-wider text-white/30 px-3 py-1">
                                      {groupName}
                                    </div>
                                    {filtered.map((cat: any) => (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                          updateRoleField(index, "role_type", cat.name);
                                          setActiveDropdownIndex(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center justify-between ${
                                          role.role_type === cat.name ? "bg-[#F4511E]/10 text-white" : "text-white/70 hover:bg-white/5"
                                        }`}
                                      >
                                        <span>
                                          {cat.emoji} {cat.name}
                                        </span>
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
                          <input
                            type="text"
                            placeholder="Enter custom role (e.g. Laser Tech, Coordinator)"
                            value={role.custom_role}
                            onChange={(e) => updateRoleField(index, "custom_role", e.target.value)}
                            className={`flex-1 h-11 px-4 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] ${
                              errors.custom_role ? "border-red-500" : "border-white/5"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateRoleField(index, "isCustom", false);
                              updateRoleField(index, "custom_role", "");
                            }}
                            className="px-4 text-[11px] font-black text-white/60 bg-[#111111] md:bg-[#1C1C1C] border border-white/5 rounded-xl hover:bg-white/5 btn-tap"
                          >
                            Reset
                          </button>
                        </div>
                      )}

                      {(errors.role_type || errors.custom_role) && (
                        <p className="text-red-400 text-xs font-semibold flex items-center gap-1 mt-1">
                          <AlertCircle size={12} /> {errors.role_type || errors.custom_role}
                        </p>
                      )}
                    </div>

                    {/* Numeric inputs row */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Pay Rate */}
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-wider">Pay (₹/hr)</label>
                        <input
                          type="number"
                          placeholder="e.g. 200"
                          value={role.pay_rate}
                          onChange={(e) => updateRoleField(index, "pay_rate", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${
                            errors.pay_rate ? "border-red-500" : "border-white/5"
                          }`}
                        />
                      </div>

                      {/* Duration */}
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-wider">Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          placeholder="e.g. 6"
                          value={role.duration_hrs}
                          onChange={(e) => updateRoleField(index, "duration_hrs", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${
                            errors.duration_hrs ? "border-red-500" : "border-white/5"
                          }`}
                        />
                      </div>

                      {/* Slots */}
                      <div className="flex flex-col space-y-1.5">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-wider">Workers</label>
                        <input
                          type="number"
                          placeholder="e.g. 5"
                          value={role.slots_total}
                          onChange={(e) => updateRoleField(index, "slots_total", e.target.value === "" ? "" : Number(e.target.value))}
                          className={`w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border text-white text-sm font-semibold focus-visible:outline-[#F4511E] ${
                            errors.slots_total ? "border-red-500" : "border-white/5"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Inline error feedback for numbers */}
                    {(errors.pay_rate || errors.duration_hrs || errors.slots_total) && (
                      <div className="space-y-1">
                        {errors.pay_rate && (
                          <p className="text-red-400 text-xs font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.pay_rate}
                          </p>
                        )}
                        {errors.duration_hrs && (
                          <p className="text-red-400 text-xs font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.duration_hrs}
                          </p>
                        )}
                        {errors.slots_total && (
                          <p className="text-red-400 text-xs font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.slots_total}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Total Pay Preview card */}
                    {role.pay_rate && role.duration_hrs && (
                      <div className="flex justify-between items-center bg-[#111111] md:bg-[#1C1C1C] px-4 py-2.5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Payout per worker</span>
                        <span className="text-xs font-black text-[#F4511E]">₹{totalPay}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRoleCard}
                className="w-full h-11 border border-dashed border-[#F4511E]/40 text-[#F4511E] rounded-xl flex items-center justify-center font-bold text-sm hover:bg-[#F4511E]/5 transition-colors btn-tap"
              >
                <Plus size={16} className="mr-1.5" /> Add Another Role
              </button>
            </div>
          )}

          {/* STEP 3: REVIEW & POST */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Review Event Details</h3>

              {/* Event Details Summary */}
              <div className="bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-3 shadow-inner">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-white/40">Event Title</span>
                  <span className="text-xs font-black text-white">{eventTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-white/40">Date & Time</span>
                  <span className="text-xs font-black text-white flex items-center gap-1">
                    <Calendar size={13} className="text-[#F4511E]" />
                    {new Date(eventDate).toLocaleString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
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

              {/* Roles Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-white/60 uppercase tracking-wider">Roles Breakdown</h4>
                {roles.map((role, idx) => {
                  const roleName = role.isCustom ? role.custom_role : role.role_type;
                  const perWorkerPay = Number(role.pay_rate || 0) * Number(role.duration_hrs || 0);
                  const totalRolePay = perWorkerPay * Number(role.slots_total || 0);

                  return (
                    <div
                      key={idx}
                      className="bg-[#1C1C1C] md:bg-[#111111] border border-white/5 rounded-2xl p-4 flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white">{roleName}</span>
                        <span className="text-[11px] text-white/50 font-semibold">
                          ₹{role.pay_rate}/hr · {role.duration_hrs}hrs · {role.slots_total} slots
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-white/40 block">Est. Cost</span>
                        <span className="text-sm font-black text-white">₹{totalRolePay}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Estimate Summary */}
              <div className="border-t border-white/10 pt-5 space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-black text-white uppercase tracking-wider">Total Event Estimate</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-[#F4511E] tracking-tight">₹{calculateTotalCost()}</span>
                    <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider mt-0.5">
                      * Platform fee applies
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-[#111111]">
          {step > 1 ? (
            <button
              onClick={handleBackStep}
              className="px-6 py-3 min-h-[44px] border border-white/10 text-white hover:bg-white/5 rounded-xl flex items-center justify-center font-bold text-sm btn-tap"
            >
              <ChevronLeft size={16} className="mr-1" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={handleNextStep}
              className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap"
            >
              Next <ChevronRight size={16} className="ml-1" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-3 min-h-[44px] bg-[#F4511E] text-white rounded-xl flex items-center justify-center font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50"
            >
              {loading ? "Posting..." : "Confirm & Post"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
