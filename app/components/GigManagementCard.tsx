import { useState, useRef, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { Calendar, MapPin, MoreVertical, Phone, Star, CheckCircle2, XCircle, Info, Loader2 } from "lucide-react";
import { useAuth } from "~/context/AuthContext";

interface WorkerApplication {
  id: string;
  gig_id: string;
  worker_id: string;
  status: string;
  profiles: {
    full_name: string;
    avg_rating: number;
    phone: string;
  } | null;
}

interface GigPayment {
  id: string;
  advance_paid: boolean;
  advance_paid_at: string | null;
  final_paid: boolean;
  final_paid_at: string | null;
  payout_released: boolean;
  organizer_total: number;
  advance_amount: number;
  final_amount: number;
}

interface Gig {
  id: string;
  title: string;
  role_type: string | null;
  custom_role: string | null;
  pay_rate: number;
  duration_hrs: number;
  event_date: string;
  location_text: string;
  is_urgent: boolean;
  slots_total: number;
  slots_filled: number;
  status: string;
  created_at: string;
  gig_payments: GigPayment | GigPayment[] | null;
}

interface GigManagementCardProps {
  gig: Gig;
  applications: WorkerApplication[];
  categories: any[];
  onActionSuccess: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function GigManagementCard({
  gig,
  applications,
  categories,
  onActionSuccess,
  showToast,
}: GigManagementCardProps) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [workersExpanded, setWorkersExpanded] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: "advance" | "final";
    amount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(new Set());

  const menuRef = useRef<HTMLDivElement>(null);

  // Close top-right menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format date helper
  const formatEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }) + " · " + d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Find emoji for the role
  const getRoleBadge = () => {
    if (gig.custom_role) {
      return `💼 ${gig.custom_role}`;
    }
    const cat = categories.find((c) => c.name === gig.role_type);
    return `${cat?.emoji || "💼"} ${gig.role_type || "Gig"}`;
  };

  // Extract payment details
  const getPayment = (): GigPayment | null => {
    if (!gig.gig_payments) return null;
    return Array.isArray(gig.gig_payments) ? gig.gig_payments[0] : gig.gig_payments;
  };

  const payment = getPayment();

  // Calculations
  const totalCost = gig.pay_rate * gig.duration_hrs * gig.slots_filled;
  const advanceAmount = Math.round(totalCost * 0.3);
  const finalAmount = totalCost - advanceAmount;

  // Filter accepted workers for this gig
  const acceptedWorkers = applications.filter(
    (app) => app.gig_id === gig.id && app.status === "accepted"
  );

  const handleMarkAttended = async (applicationId: string) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("application_id", applicationId);
      const res = await fetch("/api/mark-attendance", { method: "POST", body: form });
      if (!res.ok) throw new Error("Failed");
      setAttendedIds((prev) => new Set(prev).add(applicationId));
      showToast("Attendance marked! Worker reliability +5pts.", "success");
    } catch {
      showToast("Failed to mark attendance", "error");
    } finally {
      setLoading(false);
    }
  };

  // Update gig status (Completed / Cancelled)
  const handleUpdateStatus = async (newStatus: "completed" | "cancelled") => {
    setMenuOpen(false);
    setLoading(true);
    try {
      const { error } = await supabase
        .from("gigs")
        .update({ status: newStatus })
        .eq("id", gig.id);

      if (error) throw error;
      showToast(`Gig successfully marked as ${newStatus}!`, "success");
      onActionSuccess();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setLoading(false);
    }
  };

  // Process payments
  const handleConfirmPayment = async () => {
    if (!confirmModal || !user) return;
    setLoading(true);
    try {
      if (confirmModal.type === "advance") {
        const { error } = await supabase.from("gig_payments").insert({
          gig_id: gig.id,
          organizer_id: user.id,
          advance_paid: true,
          advance_paid_at: new Date().toISOString(),
          advance_amount: confirmModal.amount,
          final_paid: false,
          organizer_total: totalCost,
          final_amount: finalAmount,
          payout_released: false,
        });
        if (error) throw error;
        showToast("Advance payment successfully simulated!", "success");
      } else {
        const { error } = await supabase
          .from("gig_payments")
          .update({
            final_paid: true,
            final_paid_at: new Date().toISOString(),
            final_amount: confirmModal.amount,
            payout_released: true, // Auto-release on final payment for mock purposes
          })
          .eq("gig_id", gig.id);
        if (error) throw error;
        showToast("Final payment successfully simulated!", "success");
      }
      setConfirmModal(null);
      onActionSuccess();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Payment simulation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Slots progress percentage
  const slotsPercent = gig.slots_total > 0 ? (gig.slots_filled / gig.slots_total) * 100 : 0;
  const isFullyFilled = gig.slots_filled >= gig.slots_total;

  return (
    <div className="bg-[#1C1C1C] rounded-2xl p-5 border border-white/5 shadow-md flex flex-col relative group hover:border-[#F4511E]/20 transition-all">
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/60 z-30 rounded-2xl flex items-center justify-center">
          <Loader2 className="animate-spin text-[#F4511E]" size={28} />
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col space-y-1">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-black text-white/50 bg-[#111111] px-2.5 py-1 rounded-lg border border-white/5">
              {getRoleBadge()}
            </span>
            {gig.is_urgent && (
              <span className="bg-[#F4511E]/15 text-[#F4511E] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-[#F4511E]/20">
                Urgent
              </span>
            )}
          </div>
          <h3 className="font-black text-white text-base lg:text-lg tracking-tight mt-1">{gig.title}</h3>
          <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
            <Calendar size={12} className="text-[#F4511E]" /> {formatEventDate(gig.event_date)}
          </span>
          <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
            <MapPin size={12} className="text-[#F4511E] shrink-0" />
            <span className="truncate max-w-[200px]">{gig.location_text}</span>
          </span>
        </div>

        {/* Dropdown Action Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors btn-tap"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-40 bg-[#111111] border border-white/10 shadow-2xl rounded-xl py-1.5 z-40 animate-in fade-in slide-in-from-top-1">
              <button
                type="button"
                onClick={() => handleUpdateStatus("completed")}
                className="w-full text-left px-4 py-2 text-xs font-bold text-green-400 hover:bg-white/5 flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} /> Mark Completed
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus("cancelled")}
                className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:bg-white/5 flex items-center gap-1.5"
              >
                <XCircle size={14} /> Mark Cancelled
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="mb-5 bg-[#111111] p-3 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Workers Hired</span>
          <span className={`text-[10px] font-black uppercase ${isFullyFilled ? "text-green-400" : "text-[#F4511E]"}`}>
            {gig.slots_filled} / {gig.slots_total} Filled
          </span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isFullyFilled ? "bg-green-500" : "bg-[#F4511E]"}`}
            style={{ width: `${Math.min(100, slotsPercent)}%` }}
          />
        </div>
      </div>

      {/* Stepper & Payment Controls */}
      <div className="border-t border-white/5 pt-4 mb-4 flex flex-col space-y-4">
        {/* Horizontal Payment Stepper */}
        <div className="flex justify-between items-center px-1 text-[10px] font-black uppercase tracking-wider text-white/30">
          <div className="flex flex-col items-center">
            <div className={`w-3.5 h-3.5 rounded-full mb-1 flex items-center justify-center text-[8px] font-bold ${
              payment ? "bg-green-500 text-white" : "bg-[#F4511E] text-white"
            }`}>
              {payment ? "✓" : "1"}
            </div>
            <span className={payment ? "text-green-400" : "text-[#F4511E]"}>Advance</span>
          </div>

          <div className={`flex-1 h-0.5 mx-2 ${payment ? "bg-green-500/30" : "bg-white/10"}`} />

          <div className="flex flex-col items-center">
            <div className={`w-3.5 h-3.5 rounded-full mb-1 flex items-center justify-center text-[8px] font-bold ${
              payment ? "bg-green-500 text-white" : "bg-white/10 text-white/40"
            }`}>
              {payment ? "✓" : "2"}
            </div>
            <span className={payment ? "text-green-400" : "text-white/40"}>Event Day</span>
          </div>

          <div className={`flex-1 h-0.5 mx-2 ${payment?.final_paid ? "bg-green-500/30" : "bg-white/10"}`} />

          <div className="flex flex-col items-center">
            <div className={`w-3.5 h-3.5 rounded-full mb-1 flex items-center justify-center text-[8px] font-bold ${
              payment?.final_paid ? "bg-green-500 text-white" : payment ? "bg-[#F4511E] text-white" : "bg-white/10 text-white/40"
            }`}>
              {payment?.final_paid ? "✓" : "3"}
            </div>
            <span className={payment?.final_paid ? "text-green-400" : payment ? "text-[#F4511E]" : "text-white/40"}>Final Pay</span>
          </div>

          <div className={`flex-1 h-0.5 mx-2 ${payment?.final_paid ? "bg-green-500/30" : "bg-white/10"}`} />

          <div className="flex flex-col items-center">
            <div className={`w-3.5 h-3.5 rounded-full mb-1 flex items-center justify-center text-[8px] font-bold ${
              payment?.final_paid ? "bg-green-500 text-white" : "bg-white/10 text-white/40"
            }`}>
              {payment?.final_paid ? "✓" : "4"}
            </div>
            <span className={payment?.final_paid ? "text-green-400" : "text-white/40"}>Done</span>
          </div>
        </div>

        {/* Dynamic Payment Button/Badge */}
        <div className="mt-1">
          {/* Case 1: No Payment Record Yet */}
          {!payment && (
            <div>
              {gig.slots_filled === 0 ? (
                <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center gap-1.5 text-xs text-white/40 font-bold uppercase tracking-wider">
                  <Info size={14} /> Awaiting Applications
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmModal({ isOpen: true, type: "advance", amount: advanceAmount })}
                  className="w-full py-2.5 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white text-xs font-black uppercase tracking-widest shadow-md hover:shadow-orange-500/10 transition-all btn-tap"
                >
                  Pay Advance · ₹{advanceAmount} (30%)
                </button>
              )}
            </div>
          )}

          {/* Case 2: Advance Paid, Awaiting Final Payment */}
          {payment && !payment.final_paid && (
            <div className="flex gap-2">
              <div className="flex-1 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs text-green-400 font-bold uppercase tracking-wider">
                ✓ Advance Paid
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: true, type: "final", amount: finalAmount })}
                className="flex-1 py-2.5 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white text-xs font-black uppercase tracking-widest shadow-md hover:shadow-orange-500/10 transition-all btn-tap"
              >
                Pay Final · ₹{finalAmount} (70%)
              </button>
            </div>
          )}

          {/* Case 3: Fully Paid */}
          {payment && payment.final_paid && (
            <div className="flex flex-col space-y-2">
              <div className="w-full py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs text-green-400 font-bold uppercase tracking-wider">
                ✓ Fully Paid
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-wider">Payout status</span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  payment.payout_released ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                }`}>
                  {payment.payout_released ? "Payout Released" : "Payout Pending"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Accepted Workers Section Toggle */}
      <div className="border-t border-white/5 pt-3">
        <button
          onClick={() => setWorkersExpanded(!workersExpanded)}
          className="w-full text-left text-xs font-bold text-white/50 hover:text-white flex justify-between items-center transition-colors py-1 btn-tap"
        >
          <span>View Accepted Workers ({acceptedWorkers.length})</span>
          <span>{workersExpanded ? "▲" : "▼"}</span>
        </button>

        {workersExpanded && (
          <div className="mt-3 space-y-2.5 max-h-[200px] overflow-y-auto hide-scrollbar animate-in fade-in duration-200">
            {acceptedWorkers.length === 0 ? (
              <p className="text-[11px] italic text-white/40 py-2">No workers accepted yet.</p>
            ) : (
              acceptedWorkers.map((app) => {
                const p = app.profiles;
                const initial = p?.full_name?.charAt(0) || "W";
                const rating = p?.avg_rating || 5.0;

                return (
                  <div
                    key={app.id}
                    className="flex justify-between items-center bg-[#111111] p-3 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-white/5 text-white/70 font-black flex items-center justify-center text-xs border border-white/10">
                        {initial}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white">{p?.full_name || "Worker"}</span>
                        <div className="flex items-center text-[10px] text-yellow-500 font-bold gap-0.5 mt-0.5">
                          <Star size={10} fill="currentColor" /> {rating.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {p?.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          className="w-8 h-8 rounded-full bg-[#F4511E]/10 text-[#F4511E] flex items-center justify-center hover:bg-[#F4511E]/20 transition-colors btn-tap"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                      {gig.status === "completed" && (
                        attendedIds.has(app.id) || app.status === "completed" ? (
                          <span className="text-[10px] bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-bold">
                            Attended
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkAttended(app.id)}
                            className="text-[10px] bg-white/5 border border-white/10 text-white/60 px-2.5 py-1 rounded-full font-bold hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-all btn-tap"
                          >
                            Mark Attended
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Confirmation Bottom Sheet Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom md:zoom-in duration-300">
            <h3 className="text-base font-black text-white mb-3 uppercase tracking-wider">Confirm Payment</h3>
            <p className="text-sm font-semibold text-white/60 mb-6 leading-relaxed">
              You are about to pay <span className="text-[#F4511E] font-black text-base">₹{confirmModal.amount}</span> as{" "}
              <span className="font-bold text-white uppercase">{confirmModal.type} payment</span> for{" "}
              <span className="text-white font-bold">"{gig.title}"</span>.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white/70 bg-[#111111] hover:bg-white/5 border border-white/5 transition-colors btn-tap"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-[#F4511E] hover:bg-[#D84315] shadow-lg transition-colors btn-tap"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
