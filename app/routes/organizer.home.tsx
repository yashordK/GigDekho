import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { useAuth } from "~/context/AuthContext";
import { useNavigate } from "react-router";
import { Plus, Briefcase, Users, IndianRupee, ShieldCheck, ChevronDown, ChevronUp, Clock, Calendar } from "lucide-react";
import { fetchSkillCategories } from "~/lib/categories";
import GigManagementCard from "~/components/GigManagementCard";
import PostGigModal from "~/components/PostGigModal";
import Toast from "~/components/Toast";

export default function OrganizerHomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPastGigs, setShowPastGigs] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    // Redirect if not logged in
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading]);

  // Fetch skill categories on mount
  useEffect(() => {
    fetchSkillCategories().then((data) => {
      setCategories(data);
    });
  }, []);

  // Fetch data
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Organizer Profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, avg_rating, is_verified")
        .eq("id", user.id)
        .single();
      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. Gigs
      const { data: gigsData, error: gigsErr } = await supabase
        .from("gigs")
        .select(`
          id, title, role_type, custom_role, pay_rate, duration_hrs,
          event_date, location_text, is_urgent, slots_total, slots_filled,
          status, created_at,
          gig_payments (
            id, advance_paid, advance_paid_at, final_paid, final_paid_at,
            payout_released, organizer_total, advance_amount, final_amount
          )
        `)
        .eq("organizer_id", user.id)
        .order("event_date", { ascending: true });
      if (gigsErr) throw gigsErr;
      setGigs(gigsData || []);

      // 3. Applications (accepted only, to render worker profiles)
      const gigIds = gigsData?.map((g: any) => g.id) ?? [];
      if (gigIds.length > 0) {
        const { data: appsData, error: appsErr } = await supabase
          .from("applications")
          .select("id, gig_id, worker_id, status, profiles(full_name, avg_rating, phone)")
          .in("gig_id", gigIds)
          .eq("status", "accepted");
        if (appsErr) throw appsErr;
        setApplications(appsData || []);
      } else {
        setApplications([]);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleSwitchToWorker = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: "worker" })
        .eq("id", user.id);
      
      if (!error) {
        navigate("/worker/home");
      } else {
        console.error("Error switching role:", error);
        showToast("Failed to switch to Worker mode. Try again.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to switch role.", "error");
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  // Helper stats computation
  const totalGigs = gigs.length;
  const activeGigs = gigs.filter((g) => g.status === "open").length;
  const workersHired = gigs.reduce((sum, g) => sum + (g.slots_filled || 0), 0);
  const totalSpent = gigs.reduce((sum, g) => {
    const pay = Array.isArray(g.gig_payments) ? g.gig_payments[0] : g.gig_payments;
    if (pay && pay.final_paid) {
      return sum + (pay.organizer_total || 0);
    }
    return sum;
  }, 0);

  // Categorize gigs
  const activeGigsList = gigs.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const pastGigsList = gigs.filter((g) => g.status === "completed" || g.status === "cancelled");

  if (authLoading || (loading && gigs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayName = profile?.company_name || profile?.full_name || "Organizer";

  return (
    <div className="pb-24 lg:pb-12 bg-[#111111] min-h-screen pt-4">
      {/* Toast System */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Hero Header Area */}
      <div className="relative w-full pt-12 pb-16 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6">
        <div className="absolute top-0 right-[20%] w-[250px] h-[250px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-40"></div>

        <div className="relative z-10 flex items-center gap-2 mb-2 bg-[#1C1C1C] px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
          <span className="text-white font-bold text-sm">Welcome back, {displayName}</span>
          {profile?.is_verified && <ShieldCheck size={16} className="text-[#F4511E]" />}
        </div>
        <h1 className="text-3xl lg:text-4xl font-black text-white mb-2 tracking-tight relative z-10 drop-shadow-md">
          Indore Organizer Center
        </h1>
        <p className="text-white/60 font-medium text-sm lg:text-base max-w-md relative z-10 mb-4">
          Post and manage your hyperlocal event staffing instantly.
        </p>
        <button
          onClick={handleSwitchToWorker}
          className="relative z-10 btn-tap px-4 py-2 rounded-full border border-[#F4511E] text-[#F4511E] hover:bg-[#F4511E]/10 font-bold text-xs cursor-pointer transition-all"
        >
          Switch to Worker Mode
        </button>
      </div>

      {/* Stats Bar */}
      <div className="px-6 xl:px-12 w-full mx-auto mb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Gigs */}
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F4511E]">
              <Briefcase size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Total Gigs</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{totalGigs}</span>
            </div>
          </div>

          {/* Active Now */}
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 flex items-center justify-center text-[#F4511E]">
              <Clock size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Active Now</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{activeGigs}</span>
            </div>
          </div>

          {/* Workers Hired */}
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Users size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Workers Hired</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{workersHired}</span>
            </div>
          </div>

          {/* Total Spent */}
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
              <IndianRupee size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Total Spent</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">
                ₹{totalSpent.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="px-6 xl:px-12 w-full mx-auto space-y-8">
        
        {/* Active Gigs Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Active & Upcoming Gigs</h2>
          
          {activeGigsList.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-2xl p-10 text-center border border-white/5 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-4">
                <Briefcase size={26} />
              </div>
              <p className="text-white font-black mb-1 text-lg">No active gigs listed</p>
              <p className="text-sm font-medium text-white/50 max-w-sm mb-6">
                Post your event staff requirements and start accepting applications.
              </p>
              <button
                onClick={() => setShowPostModal(true)}
                className="px-6 py-2.5 bg-[#F4511E] text-white text-xs font-black tracking-widest uppercase rounded-xl shadow-lg hover:bg-[#D84315] transition-colors btn-tap"
              >
                Post Your First Gig
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGigsList.map((gig) => (
                <GigManagementCard
                  key={gig.id}
                  gig={gig}
                  applications={applications}
                  categories={categories}
                  onActionSuccess={fetchData}
                  showToast={showToast}
                />
              ))}
            </div>
          )}
        </div>

        {/* Collapsible Past Gigs Section */}
        <div className="border-t border-white/5 pt-6">
          <button
            onClick={() => setShowPastGigs(!showPastGigs)}
            className="flex items-center gap-2 bg-[#1C1C1C] hover:bg-white/5 text-white/60 hover:text-white px-5 py-2.5 rounded-full border border-white/5 text-xs font-bold transition-all btn-tap cursor-pointer"
          >
            <span>{showPastGigs ? "Hide Past Gigs" : "Show Past Gigs"}</span>
            {showPastGigs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showPastGigs && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              {pastGigsList.length === 0 ? (
                <p className="text-sm italic text-white/40 col-span-full">No completed or cancelled gigs yet.</p>
              ) : (
                pastGigsList.map((gig) => {
                  const pay = Array.isArray(gig.gig_payments) ? gig.gig_payments[0] : gig.gig_payments;
                  const isCompleted = gig.status === "completed";
                  const totalRolePay = gig.pay_rate * gig.duration_hrs * gig.slots_filled;

                  return (
                    <div
                      key={gig.id}
                      className="bg-[#1C1C1C]/50 rounded-2xl p-4 border border-white/5 opacity-65 flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-white/80 text-sm line-clamp-1">{gig.title}</h4>
                          <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${
                            isCompleted ? "bg-green-500/10 text-green-400 border border-green-500/10" : "bg-red-500/10 text-red-400 border border-red-500/10"
                          }`}>
                            {gig.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/40 font-semibold flex items-center gap-1">
                          <Calendar size={10} /> {new Date(gig.event_date).toLocaleDateString("en-IN")}
                        </p>
                      </div>

                      <div className="border-t border-white/5 pt-3 mt-4 flex justify-between items-center text-[11px] font-semibold text-white/50">
                        <span>Paid: {pay?.final_paid ? "₹" + totalRolePay : "₹0"}</span>
                        <span>{gig.slots_filled} worker(s)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Floating post gig trigger */}
      <button
        onClick={() => setShowPostModal(true)}
        className="fixed bottom-6 right-6 z-40 btn-tap flex items-center gap-2 
                   bg-[#F4511E] text-white px-6 py-3.5 rounded-full shadow-xl 
                   shadow-orange-500/20 font-black tracking-widest text-xs uppercase cursor-pointer hover:bg-[#D84315] hover:scale-105 transition-all"
      >
        <Plus size={18} />
        Post a Gig
      </button>

      {/* Multi-role Post Modal */}
      <PostGigModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onSuccess={fetchData}
        user={user}
        showToast={showToast}
      />
    </div>
  );
}
