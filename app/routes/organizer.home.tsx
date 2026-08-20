import { useState, useEffect, useMemo } from "react";
import { supabase } from "~/lib/supabase.client";
import { useAuth } from "~/context/AuthContext";
import { useNavigate } from "react-router";
import { Plus, Briefcase, Users, IndianRupee, ShieldCheck, ChevronDown, ChevronUp, Clock, Calendar, Star, Phone, Heart, MapPin, GraduationCap } from "lucide-react";
import { fetchSkillCategories } from "~/lib/categories";
import GigManagementCard from "~/components/GigManagementCard";
import InternshipManagementCard from "~/components/InternshipManagementCard";
import PostGigModal, { type GigTemplate } from "~/components/PostGigModal";
import Toast from "~/components/Toast";
import SpotlightCategories from "~/components/SpotlightCategories";
import ProfileCompletionNudge from "~/components/ProfileCompletionNudge";

export const meta = () => [
  { title: "Hirer dashboard — GigDekho" },
  { name: "robots", content: "noindex, nofollow" },
];

// Quick Start discovery — shows the hirer everything they can get done here.
// Details stay hidden until they tap a chip; one more tap prefills the post form.
interface DiscoverItem {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  template: GigTemplate | null; // null = blank form (custom / anything else)
}

const DISCOVER_ITEMS: DiscoverItem[] = [
  {
    id: "staff",
    label: "Temporary staff",
    emoji: "🙋",
    desc: "Helpers, coordinators, waitstaff, receptionists, babysitters, security. Verified extra hands for any shift or event.",
    template: {
      eventTitle: "Staffing Requirement",
      description: "Reliable staff needed. Details of duties, dress code, and reporting time below.",
      roles: [{ role_type: "Event Helper/Coordinator", pay_rate: 120, duration_hrs: 5, slots_total: 2 }],
    },
  },
  {
    id: "wedding",
    label: "Wedding waitstaff",
    emoji: "💒",
    desc: "Trained waitstaff in formals for wedding functions. Most hirers book 6 to 10 for a full evening.",
    template: {
      eventTitle: "Wedding Event",
      description: "Waitstaff needed for a wedding function. Formal dress code (black & white). Food provided.",
      roles: [{ role_type: "Waitstaff", pay_rate: 150, duration_hrs: 6, slots_total: 8 }],
    },
  },
  {
    id: "cafe",
    label: "Cafe weekend shift",
    emoji: "☕",
    desc: "Extra hands for the weekend rush. Serving, clearing tables, and basic counter help.",
    template: {
      eventTitle: "Cafe Weekend Shift",
      description: "Extra hands for the weekend rush. Serving, clearing tables, basic counter help.",
      roles: [{ role_type: "Waitstaff", pay_rate: 120, duration_hrs: 5, slots_total: 2 }],
    },
  },
  {
    id: "moments",
    label: "Celebrations: Moments",
    emoji: "📸",
    desc: "\"Kheech Meri Photo\" + \"Ek Reel Meri Bhi\". A photographer and reel shooter cover your party so guests leave with great pics.",
    template: {
      eventTitle: "Celebration",
      description: "Personal celebration. Photographer + reel shooter to capture candids, group shots, and share-ready reels.",
      roles: [
        { role_type: "Event Photographer", pay_rate: 400, duration_hrs: 4, slots_total: 1 },
        { role_type: "Reel Shooter/Videographer", pay_rate: 350, duration_hrs: 4, slots_total: 1 },
      ],
    },
  },
  {
    id: "setup",
    label: "Celebrations: + Setup",
    emoji: "🎈",
    desc: "Everything in Moments plus a surprise-setup crew: decor, balloons, and lights ready before your guest of honour arrives.",
    template: {
      eventTitle: "Surprise Celebration",
      description: "Surprise celebration. Photos + reels coverage, plus setup crew for decor before the guest of honour arrives.",
      roles: [
        { role_type: "Event Photographer", pay_rate: 400, duration_hrs: 4, slots_total: 1 },
        { role_type: "Surprise Setup Specialist", pay_rate: 200, duration_hrs: 3, slots_total: 2 },
      ],
    },
  },
  {
    id: "projects",
    label: "GigDekho Projects",
    emoji: "💼",
    desc: "Skilled local freelancers: websites, graphic design, video editing, content, social media. Post your budget and review portfolios.",
    template: {
      eventTitle: "Project Work",
      description: "Project brief: scope, deliverables, and timeline below. Share your portfolio when applying.",
      roles: [{ role_type: "Web Development", pay_rate: 300, duration_hrs: 10, slots_total: 1 }],
    },
  },
  {
    id: "artists",
    label: "Book an artist",
    emoji: "🎤",
    desc: "Singers, DJs, anchors, dancers, live bands, magicians. Skilled college talent with samples and ratings.",
    template: {
      eventTitle: "Artist Booking",
      description: "Looking for a performer for our event. Share your samples/portfolio when applying.",
      roles: [{ role_type: "Singer", pay_rate: 500, duration_hrs: 2, slots_total: 1 }],
    },
  },
  {
    id: "custom",
    label: "…or anything else",
    emoji: "✨",
    desc: "Not limited to these! Post any custom role: pandal help, inventory counting, queue management, whatever you need people for.",
    template: null,
  },
];

export default function OrganizerHomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [regulars, setRegulars] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<GigTemplate | null>(null);
  const [discoverId, setDiscoverId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?mode=organizer");
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    fetchSkillCategories().then(setCategories);
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Organizer profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, company_name, avg_rating, is_verified")
        .eq("id", user.id)
        .single();
      if (profileErr) throw profileErr;
      setProfile(profileData);

      // 2. My gigs (with payment state)
      // cover_* arrive with migration 011; fall back so the dashboard
      // still lists gigs if the deploy lands before the migration.
      const gigFields = `
          id, title, role_type, custom_role, pay_rate, duration_hrs,
          event_date, location_text, is_urgent, slots_total, slots_filled,
          status, created_at, organizer_id, gig_type, work_mode, commitment,
          duration_months, stipend_min, stipend_max, is_unpaid,
          application_deadline,
          gig_payments (
            id, advance_paid, advance_paid_at, final_paid, final_paid_at,
            payout_released, organizer_total, advance_amount, final_amount
          )
        `;
      // `as any` on the select: the column list is built at runtime, so
      // PostgREST's type inference has nothing to narrow against.
      const selectGigs = (withCover: boolean) =>
        (supabase.from("gigs") as any)
          .select(withCover ? `cover_mode, cover_image_url, ${gigFields}` : gigFields)
          .eq("organizer_id", user.id)
          .order("event_date", { ascending: true }) as Promise<{ data: any[] | null; error: any }>;
      let { data: gigsData, error: gigsErr } = await selectGigs(true);
      if (gigsErr && /cover_mode|cover_image_url/.test(gigsErr.message ?? "")) {
        ({ data: gigsData, error: gigsErr } = await selectGigs(false));
      }
      if (gigsErr) throw gigsErr;
      setGigs(gigsData || []);

      // 3. Accepted applications (worker cards on gig management)
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

      // 4. My Regulars — auto-populated from my own high ratings of workers
      const { data: ratingRows } = await supabase
        .from("ratings")
        .select("ratee_id, score, worker:profiles!ratings_ratee_id_fkey(id, full_name, avg_rating, phone, avatar_url, worker_level)")
        .eq("rater_id", user.id)
        .gte("score", 4);

      const byWorker = new Map<string, any>();
      for (const row of ratingRows || []) {
        const w = Array.isArray(row.worker) ? row.worker[0] : row.worker;
        if (!w) continue;
        const existing = byWorker.get(w.id);
        if (existing) existing.timesRated += 1;
        else byWorker.set(w.id, { ...w, timesRated: 1 });
      }
      setRegulars([...byWorker.values()].sort((a, b) => b.timesRated - a.timesRated).slice(0, 8));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  // Real-time refresh on application/gig changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`organizer-dashboard-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `organizer_id=eq.${user.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSwitchToWorker = () => {
    localStorage.setItem('activeView', 'worker');
    navigate("/worker/home");
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const openPostModal = (template: GigTemplate | null = null) => {
    setActiveTemplate(template);
    setShowPostModal(true);
  };

  // Stats
  const totalGigs = gigs.length;
  const activeGigs = gigs.filter((g) => g.status === "open").length;
  const workersHired = gigs.reduce((sum, g) => sum + (g.slots_filled || 0), 0);
  const totalSpent = gigs.reduce((sum, g) => {
    const pay = Array.isArray(g.gig_payments) ? g.gig_payments[0] : g.gig_payments;
    if (pay && pay.final_paid) return sum + (pay.organizer_total || 0);
    return sum;
  }, 0);

  const liveList = gigs.filter((g) => g.status !== "completed" && g.status !== "cancelled");
  const activeGigsList = liveList.filter((g) => g.gig_type !== "internship");
  const internshipList = liveList.filter((g) => g.gig_type === "internship");
  const pastGigsList = gigs.filter((g) => g.status === "completed" || g.status === "cancelled");
  const totalPendingApplicants = applications.length;

  // Upcoming Calendar — confirmed/open gigs from today onward, grouped by day
  const upcomingByDay = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const upcoming = liveList
      .filter((g) => new Date(g.event_date) >= startOfToday)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    const groups = new Map<string, any[]>();
    for (const g of upcoming) {
      const key = new Date(g.event_date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(g);
    }
    return [...groups.entries()];
  }, [gigs]);

  if (authLoading || (loading && gigs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayName = profile?.company_name || profile?.full_name || "Hirer";

  return (
    <div className="bg-[#111111] min-h-screen pt-4">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* ── Hero: Post a Gig is the primary action ─────────────────── */}
      <div className="relative w-full pt-12 pb-14 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-8">
        {/* Torch reveal — everything you can hire for */}
        <SpotlightCategories />
        <div className="absolute top-0 right-[20%] w-[250px] h-[250px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-40"></div>

        <div data-torch-safe className="relative z-10 flex items-center gap-2 mb-3 bg-[#1C1C1C] px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
          <span className="text-white font-bold text-sm">Welcome back, {displayName}</span>
          {profile?.is_verified && <ShieldCheck size={16} className="text-[#F4511E]" />}
        </div>
        <h1 data-torch-safe className="text-3xl lg:text-5xl font-black text-white mb-3 tracking-tight relative z-10 drop-shadow-md">
          Need people? Post a gig.
        </h1>
        <p data-torch-safe className="text-white/60 font-medium text-sm lg:text-base max-w-md relative z-10 mb-7">
          Workers in Indore apply within minutes. First come, first confirmed.
        </p>

        <button
          onClick={() => openPostModal()}
          data-torch-safe className="relative z-10 btn-tap flex items-center gap-2 bg-[#F4511E] hover:bg-[#D84315] text-white px-10 py-4 rounded-full shadow-xl shadow-orange-500/25 font-black tracking-widest text-sm uppercase cursor-pointer hover:scale-105 transition-all mb-6"
        >
          <Plus size={20} /> Post a Gig
        </button>

        {/* Quick Start discovery — tap a chip to see what it covers, tap again to post */}
        <div data-torch-safe className="relative z-10 w-full max-w-2xl">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Quick start · everything you can get done here</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {DISCOVER_ITEMS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-expanded={discoverId === t.id}
                onClick={() => setDiscoverId(discoverId === t.id ? null : t.id)}
                className={`btn-tap flex items-center gap-1.5 backdrop-blur border px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  discoverId === t.id
                    ? 'bg-[#F4511E]/20 border-[#F4511E]/60 text-white'
                    : 'bg-[#1C1C1C]/80 border-white/10 hover:border-[#F4511E]/40 text-white/80 hover:text-white'
                }`}
              >
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Detail card appears only when a chip is selected */}
          {(() => {
            const item = DISCOVER_ITEMS.find(d => d.id === discoverId);
            if (!item) return null;
            return (
              <div className="mt-3 bg-[#1C1C1C]/90 backdrop-blur border border-[#F4511E]/25 rounded-2xl p-4 text-left flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-xs font-medium text-white/70 leading-relaxed flex-1">{item.desc}</p>
                <button
                  type="button"
                  onClick={() => { setDiscoverId(null); openPostModal(item.template); }}
                  className="shrink-0 btn-tap bg-[#F4511E] hover:bg-[#D84315] text-white px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-colors"
                >
                  {item.template ? 'Post this' : 'Post custom gig'}
                </button>
              </div>
            );
          })()}
        </div>

        <button
          onClick={handleSwitchToWorker}
          className="relative z-10 mt-6 btn-tap px-4 py-2 rounded-full border border-white/15 text-white/50 hover:text-white hover:border-white/40 font-bold text-xs cursor-pointer transition-all"
        >
          Switch to Worker Mode
        </button>
      </div>

      <div className="px-6 xl:px-12 w-full mx-auto">
        {user && <ProfileCompletionNudge isOrganizerView={true} />}
      </div>

      {/* ── Stats Bar ───────────────────────────────────────────────── */}
      <div className="px-6 xl:px-12 w-full mx-auto mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F4511E]">
              <Briefcase size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Total Gigs</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{totalGigs}</span>
            </div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 flex items-center justify-center text-[#F4511E]">
              <Clock size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Active Now</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{activeGigs}</span>
            </div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 relative">
              <Users size={20} />
              {totalPendingApplicants > 0 && activeGigs > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#F4511E] rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-wider text-white/40">Workers Hired</span>
              <span className="text-xl lg:text-2xl font-black text-white tracking-tight">{workersHired}</span>
            </div>
          </div>
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

      <div className="px-6 xl:px-12 w-full mx-auto space-y-12">

        {/* ── 1. Active Gigs & Applicants ─────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Active Gigs & Applicants</h2>

          {activeGigsList.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-2xl p-10 text-center border border-white/5 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-4">
                <Briefcase size={26} />
              </div>
              <p className="text-white font-black mb-1 text-lg">No active gigs listed</p>
              <p className="text-sm font-medium text-white/50 max-w-sm mb-6">
                Post your gig requirements and start accepting applications — use a quick template above to do it in seconds.
              </p>
              <button
                onClick={() => openPostModal()}
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
        </section>

        {/* ── 2. Internships & Jobs ───────────────────────────────────── */}
        {internshipList.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase tracking-wider">Internships & Jobs</h2>
              <GraduationCap size={16} className="text-blue-400" />
            </div>
            <p className="text-xs font-medium text-white/40 -mt-2">
              Review full applications, move candidates through your pipeline, and track everything in a live Google Sheet.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {internshipList.map((gig) => (
                <InternshipManagementCard
                  key={gig.id}
                  gig={gig}
                  onActionSuccess={fetchData}
                  showToast={showToast}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── 3. My Regulars ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white uppercase tracking-wider">My Regulars</h2>
            <Heart size={16} className="text-[#F4511E]" />
          </div>
          <p className="text-xs font-medium text-white/40 -mt-2">
            Workers you've rated 4★ or higher — your trusted crew, auto-saved from your rating history.
          </p>

          {regulars.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-2xl p-8 border border-white/5 border-dashed flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-3">
                <Star size={22} />
              </div>
              <p className="text-white font-bold mb-1">Build your trusted crew</p>
              <p className="text-xs font-medium text-white/50 max-w-sm">
                After a gig, rate the workers who did well. Anyone you rate 4★ or higher shows up here so you can rehire them without searching.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
              {regulars.map((w) => (
                <div key={w.id} className="min-w-[200px] bg-[#1C1C1C] rounded-2xl p-5 border border-white/5 flex flex-col items-center text-center shrink-0">
                  {w.avatar_url ? (
                    <img src={w.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover mb-3 border border-white/10" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#F4511E]/15 text-[#F4511E] font-black text-xl flex items-center justify-center mb-3 border border-[#F4511E]/20">
                      {w.full_name?.charAt(0) || 'W'}
                    </div>
                  )}
                  <p className="font-black text-white text-sm mb-0.5 truncate max-w-full">{w.full_name}</p>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">{w.worker_level || 'worker'}</p>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mb-3">
                    <Star size={12} className="fill-current" /> {w.avg_rating ? Number(w.avg_rating).toFixed(1) : '—'}
                    <span className="text-white/30 ml-1">· rated {w.timesRated}×</span>
                  </div>
                  {w.phone && (
                    <a
                      href={`tel:${w.phone}`}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/20 px-3.5 py-1.5 rounded-full hover:bg-[#F4511E]/20 transition-colors btn-tap"
                    >
                      <Phone size={12} /> Call
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. Upcoming Calendar ────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Upcoming Calendar</h2>

          {upcomingByDay.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-2xl p-8 border border-white/5 border-dashed flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-3">
                <Calendar size={22} />
              </div>
              <p className="text-white font-bold mb-1">Nothing scheduled yet</p>
              <p className="text-xs font-medium text-white/50 max-w-sm mb-4">
                Confirmed gigs will appear here by date so you always know what's coming up.
              </p>
              <button
                onClick={() => openPostModal()}
                className="text-[#F4511E] text-xs font-bold hover:underline btn-tap"
              >
                Schedule your next gig →
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {upcomingByDay.map(([day, dayGigs]) => (
                <div key={day} className="bg-[#1C1C1C] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="px-5 py-3 bg-[#111111] border-b border-white/5 flex items-center gap-2">
                    <Calendar size={14} className="text-[#F4511E]" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">{day}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {dayGigs.map((g: any) => (
                      <div key={g.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{g.title}</p>
                          <p className="text-[11px] font-semibold text-white/40 flex items-center gap-1 mt-0.5">
                            <Clock size={11} />
                            {new Date(g.event_date).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                            <span className="text-white/20 mx-1">·</span>
                            <MapPin size={11} />
                            <span className="truncate max-w-[160px]">{g.location_text}</span>
                          </p>
                        </div>
                        <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          g.slots_filled >= g.slots_total
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {g.slots_filled}/{g.slots_total} hired
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. History & Spend ──────────────────────────────────────── */}
        <section className="border-t border-white/5 pt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white uppercase tracking-wider">History & Spend</h2>
            <div className="flex items-center gap-2 bg-[#1C1C1C] border border-white/5 px-4 py-2 rounded-full">
              <IndianRupee size={14} className="text-green-400" />
              <span className="text-xs font-bold text-white/60">Lifetime spend:</span>
              <span className="text-sm font-black text-white">₹{totalSpent.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {pastGigsList.length === 0 ? (
            <p className="text-sm font-medium text-white/40">
              Completed gigs and your running spend will collect here — useful for budgeting your events.
            </p>
          ) : (
            <>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 bg-[#1C1C1C] hover:bg-white/5 text-white/60 hover:text-white px-5 py-2.5 rounded-full border border-white/5 text-xs font-bold transition-all btn-tap cursor-pointer"
              >
                <span>{showHistory ? "Hide" : "Show"} {pastGigsList.length} past gig{pastGigsList.length !== 1 ? 's' : ''}</span>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showHistory && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
                  {pastGigsList.map((gig) => {
                    const pay = Array.isArray(gig.gig_payments) ? gig.gig_payments[0] : gig.gig_payments;
                    const isCompleted = gig.status === "completed";
                    const paidAmount = pay?.final_paid ? (pay.organizer_total || 0) : 0;

                    return (
                      <div
                        key={gig.id}
                        className="bg-[#1C1C1C]/50 rounded-2xl p-4 border border-white/5 opacity-75 flex flex-col justify-between"
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
                          <span>Paid: ₹{paidAmount.toLocaleString("en-IN")}</span>
                          <span>{gig.slots_filled} worker{gig.slots_filled !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

      </div>

      {/* Floating post gig trigger (secondary — hero is primary) */}
      <button
        onClick={() => openPostModal()}
        aria-label="Post a gig"
        className="fixed bottom-24 lg:bottom-6 right-6 z-40 btn-tap flex items-center gap-2
                   bg-[#F4511E] text-white px-6 py-3.5 rounded-full shadow-xl
                   shadow-orange-500/20 font-black tracking-widest text-xs uppercase cursor-pointer hover:bg-[#D84315] hover:scale-105 transition-all"
      >
        <Plus size={18} />
        Post a Gig
      </button>

      <PostGigModal
        isOpen={showPostModal}
        onClose={() => { setShowPostModal(false); setActiveTemplate(null); }}
        onSuccess={fetchData}
        user={user}
        showToast={showToast}
        template={activeTemplate}
      />
    </div>
  );
}
