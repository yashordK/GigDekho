import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import AttendanceCheckIn from '~/components/AttendanceCheckIn';
import { useAuth } from '~/context/AuthContext';
import { useNavigate } from 'react-router';
import { Calendar, ChevronRight, Briefcase, Shield, XCircle, AlertTriangle, GraduationCap } from 'lucide-react';
import { formatRelativeDate } from '~/lib/utils';
import SpotlightCategories from '~/components/SpotlightCategories';
import { gigCoverUrl } from '~/lib/cover';

export const meta = () => [
  { title: "My gigs — GigDekho" },
  { name: "robots", content: "noindex, nofollow" },
];

function reliabilityLabel(score: number) {
  if (score >= 90) return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' };
  if (score >= 70) return { label: 'Good',      color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' };
  if (score >= 50) return { label: 'Fair',      color: 'text-yellow-400',bg: 'bg-yellow-500/10 border-yellow-500/20' };
  return                 { label: 'Poor',       color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20' };
}

const INTERN_STATUS: Record<string, { label: string; color: string }> = {
  submitted:    { label: 'Submitted',    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  shortlisted:  { label: 'Shortlisted',  color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  interviewing: { label: 'Interviewing', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  hired:        { label: 'Hired 🎉',     color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  rejected:     { label: 'Not selected', color: 'bg-white/5 text-white/40 border-white/10' },
};

function getCancelPenalty(eventDate: string): number {
  const h = (new Date(eventDate).getTime() - Date.now()) / 3600000;
  if (h < 6) return 15;
  if (h < 24) return 5;
  return 0;
}

export default function DashboardScreen() {
  const [tab, setTab] = useState('active');
  const [apps, setApps] = useState<any[]>([]);
  const [internApps, setInternApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reliabilityScore, setReliabilityScore] = useState(100);
  const [cancelModal, setCancelModal] = useState<{
    appId: string; gigTitle: string; eventDate: string; penalty: number;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchReliabilityScore();
    }
  }, [user?.id]);

  const fetchReliabilityScore = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('reliability_score')
      .eq('id', user.id)
      .single();
    if (data?.reliability_score != null) setReliabilityScore(data.reliability_score);
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`*, gig:gigs(*)`)
        .eq('worker_id', user.id)
        .order('applied_at', { ascending: false });
      if (error) throw error;
      setApps(data || []);

      const { data: internData } = await supabase
        .from('internship_applications')
        .select('id, status, created_at, gig:gigs(id, title, location_text, event_date, work_mode, commitment, stipend_min, stipend_max, is_unpaid, duration_months)')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });
      setInternApps((internData || []).filter((a: any) => a.gig));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (app: any) => {
    setCancelModal({
      appId: app.id,
      gigTitle: app.gig.title,
      eventDate: app.gig.event_date,
      penalty: getCancelPenalty(app.gig.event_date),
    });
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    try {
      const form = new FormData();
      form.append('app_id', cancelModal.appId);
      const res = await fetch('/api/cancel', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed');
      setCancelModal(null);
      await Promise.all([fetchApplications(), fetchReliabilityScore()]);
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setCancelling(false);
    }
  };

  // 'pending' in DB means either: awaiting (no position) or waitlisted (has position)
  // This is the trigger's convention — not a custom 'waitlisted' status
  const getStatusParams = (app: any) => {
    const { status, waitlist_position } = app;
    if (status === 'pending' && waitlist_position != null)
      return { label: `Waitlisted #${waitlist_position}`, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
    switch (status) {
      case 'pending':   return { label: 'Pending',   color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
      case 'accepted':  return { label: 'Confirmed', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
      case 'completed': return { label: 'Completed', color: 'bg-white/10 text-white/70 border-white/20' };
      case 'no_show':   return { label: 'No Show',   color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'cancelled': return { label: 'Cancelled', color: 'bg-white/5 text-white/40 border-white/10' };
      default:          return { label: status,      color: 'bg-white/5 text-white/40 border-white/10' };
    }
  };

  const filteredApps = apps.filter(app => {
    if (tab === 'active') return ['pending', 'accepted'].includes(app.status);
    return ['completed', 'no_show', 'cancelled'].includes(app.status);
  });

  const rel = reliabilityLabel(reliabilityScore);

  return (
    <div className="bg-[#111111] min-h-screen pt-4">

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom md:zoom-in duration-300">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-[#F4511E]" />
              <h3 className="text-base font-black text-white uppercase tracking-wider">Cancel Your Spot?</h3>
            </div>
            <p className="text-sm font-semibold text-white/60 mb-4 leading-relaxed">
              You're cancelling your spot for{' '}
              <span className="text-white font-bold">"{cancelModal.gigTitle}"</span>.
            </p>
            {cancelModal.penalty > 0 ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 text-sm text-red-400 font-semibold space-y-1">
                <p>⚠️ Late cancellation — reliability score drops by <strong>{cancelModal.penalty} pts</strong>.</p>
                {cancelModal.penalty >= 15 && (
                  <p className="text-xs text-red-400/70">Cancelling &lt;6h before event also triggers a ₹100 deduction from your next payout.</p>
                )}
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-5 text-sm text-green-400 font-semibold">
                ✓ Cancelling with &gt;24h notice — no reliability penalty.
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white/70 bg-[#111111] hover:bg-white/5 border border-white/5 transition-colors btn-tap"
              >
                Keep My Spot
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3.5 rounded-xl font-black text-sm text-white bg-red-500 hover:bg-red-600 shadow-lg transition-colors btn-tap disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative w-full pt-12 pb-24 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6">
        <SpotlightCategories />
        <div className="absolute top-0 right-[20%] w-[250px] h-[250px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-40" />

        <h1 data-torch-safe className="text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight relative z-10 drop-shadow-md">My Gigs</h1>
        <p data-torch-safe className="text-white/60 font-medium text-base lg:text-lg mb-4 max-w-md relative z-10 leading-relaxed">
          Track your ongoing applications and review past events.
        </p>

        {/* Reliability Score */}
        <div data-torch-safe className={`relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-black mb-6 ${rel.bg} ${rel.color}`}>
          <Shield size={14} />
          Reliability {reliabilityScore}/100 — {rel.label}
        </div>

        {/* Tabs */}
        <div data-torch-safe className="flex bg-[#1C1C1C] border border-white/10 p-1.5 rounded-full w-full lg:w-[400px] shadow-lg relative z-10 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 min-w-[120px] min-h-[44px] py-1.5 text-sm font-bold rounded-full transition-all btn-tap ${tab === 'active' ? 'bg-[#F4511E] text-white shadow-md' : 'text-white/60 hover:text-white flex items-center justify-center'}`}
          >
            Active Gigs
          </button>
          <button
            onClick={() => setTab('past')}
            className={`flex-1 min-w-[120px] min-h-[44px] py-1.5 text-sm font-bold rounded-full transition-all btn-tap ${tab === 'past' ? 'bg-[#F4511E] text-white shadow-md' : 'text-white/60 hover:text-white flex items-center justify-center'}`}
          >
            Past Events
          </button>
          {internApps.length > 0 && (
            <button
              onClick={() => setTab('internships')}
              className={`flex-1 min-w-[130px] min-h-[44px] py-1.5 text-sm font-bold rounded-full transition-all btn-tap ${tab === 'internships' ? 'bg-[#F4511E] text-white shadow-md' : 'text-white/60 hover:text-white flex items-center justify-center'}`}
            >
              Applications ({internApps.length})
            </button>
          )}
        </div>
      </div>

      <div className="px-4 xl:px-12 w-full mx-auto">
        {/* Internship / job applications */}
        {tab === 'internships' && (
          <div className="w-full lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
            {internApps.map(app => {
              const s = INTERN_STATUS[app.status] ?? INTERN_STATUS.submitted;
              return (
                <div
                  key={app.id}
                  onClick={() => navigate(`/gigs/${app.gig.id}`)}
                  className="bg-[#1C1C1C] rounded-2xl p-5 shadow-sm border border-white/5 flex flex-col btn-tap cursor-pointer group hover:border-[#F4511E]/30 transition-all mt-4 lg:mt-0"
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/25 px-2 py-1 rounded-full inline-flex items-center gap-1 mb-2">
                        <GraduationCap size={10} /> Internship
                      </span>
                      <h3 className="font-black text-white text-lg leading-tight truncate">{app.gig.title}</h3>
                      <p className="text-white/50 font-medium text-sm truncate">{app.gig.location_text}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shrink-0 flex items-center gap-1.5 ${s.color}`}>
                      {app.status === 'submitted' && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />}
                      {s.label}
                    </div>
                  </div>
                  <div className="flex justify-between items-end mt-auto pt-4 border-t border-white/5">
                    <span className="text-xs font-bold text-white/40">
                      Applied {new Date(app.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="font-black text-[#F4511E] text-lg tracking-tight">
                      {app.gig.is_unpaid ? 'Unpaid' : app.gig.stipend_min ? `₹${app.gig.stipend_min.toLocaleString('en-IN')}/mo` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={`w-full lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6 ${tab === 'internships' ? 'hidden' : ''}`}>
          {loading ? (
            <div className="flex justify-center p-10 col-span-full">
              <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="bg-[#1C1C1C] rounded-2xl p-8 lg:p-12 text-center shadow-sm border border-white/5 flex flex-col items-center mt-2 col-span-full">
              <div className="w-20 h-20 bg-white/5 rounded-full flex justify-center items-center text-[#F4511E] mb-5">
                <Briefcase size={32} />
              </div>
              <p className="text-white font-black mb-2 text-xl tracking-tight">No {tab} gigs found</p>
              <p className="text-base font-medium text-white/50 max-w-sm">
                {tab === 'active' ? "No active gigs — browse available jobs" : "You haven't completed any gigs yet."}
              </p>
              {tab === 'active' && (
                <button
                  onClick={() => navigate('/worker/home')}
                  className="mt-8 px-8 py-3.5 min-h-[44px] bg-[#F4511E] text-white text-sm font-black tracking-wide rounded-xl shadow-lg hover:bg-[#D84315] transition-colors btn-tap"
                >
                  Browse Live Gigs
                </button>
              )}
            </div>
          ) : (
            filteredApps.map(app => {
              if (!app.gig) return null;
              const sParams = getStatusParams(app);
              const totalPay = app.gig.pay_rate * app.gig.duration_hrs;
              const canCancel = app.status === 'accepted' || (app.status === 'pending' && app.waitlist_position != null);

              return (
                <div
                  key={app.id}
                  onClick={() => navigate(`/gigs/${app.gig.id}`)}
                  className="bg-[#1C1C1C] rounded-2xl p-5 lg:p-6 shadow-sm border border-white/5 flex flex-col btn-tap cursor-pointer group hover:border-[#F4511E]/30 transition-all hover:shadow-md mt-4 lg:mt-0"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex pr-3 flex-1 min-w-0">
                      {(() => {
                        const thumb = gigCoverUrl(app.gig, 200);
                        return thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-12 h-12 rounded-xl object-cover mr-4 shrink-0"
                          />
                        ) : (
                          // Hirer chose no cover — a neutral tile keeps the row aligned
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mr-4 shrink-0">
                            <Briefcase size={18} className="text-white/25" />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <h3 className="font-black text-white text-lg lg:text-xl leading-tight mb-0.5 truncate">{app.gig.title}</h3>
                        <p className="text-white/50 font-medium text-sm truncate">{app.gig.location_text}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shadow-sm shrink-0 flex items-center gap-1.5 ${sParams.color}`}>
                      {app.status === 'pending' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
                      )}
                      {sParams.label}
                    </div>
                  </div>

                  {/* Penalty info */}
                  {(app.status === 'cancelled' || app.status === 'no_show') && app.cancellation_penalty > 0 && (
                    <div className="mb-3 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400/80 font-semibold flex items-center gap-1.5">
                      <XCircle size={12} className="shrink-0" />
                      −{app.cancellation_penalty} reliability pts
                      {app.status === 'no_show' && ' · ₹100 deducted from next payout'}
                    </div>
                  )}

                  {/* Attendance lives inside the card but must not open the gig
                      page — a stray tap while checking in would lose the camera. */}
                  {(app.status === 'accepted' || app.status === 'completed') && (
                    <div onClick={(e) => e.stopPropagation()} role="presentation">
                      <AttendanceCheckIn
                        applicationId={app.id}
                        workerId={user.id}
                        onChanged={fetchApplications}
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-end mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center text-white/60 text-sm font-bold bg-[#111111] px-3 py-1.5 rounded-lg border border-white/5">
                      <Calendar size={14} className="mr-2 text-[#F4511E]" />
                      {formatRelativeDate(app.gig.event_date)}
                    </div>
                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openCancelModal(app); }}
                          title="Cancel this gig"
                          className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors btn-tap shrink-0"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      <span className="font-black text-[#F4511E] text-2xl tracking-tight">₹{totalPay}</span>
                      <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center group-hover:bg-[#F4511E]/10 transition-colors border border-white/5 group-hover:border-[#F4511E]/20">
                        <ChevronRight size={16} className="text-white/40 group-hover:text-[#F4511E] transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
