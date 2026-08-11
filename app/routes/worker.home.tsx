import { useState, useEffect, useMemo } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useAuth } from '~/context/AuthContext';
import { useNavigate } from 'react-router';
import GigCard from '~/components/GigCard';
import SpotlightCategories from '~/components/SpotlightCategories';
import ProfileCompletionNudge from '~/components/ProfileCompletionNudge';
import { formatRelativeDate } from '~/lib/utils';
import { Briefcase, RefreshCw, Zap, Users, SlidersHorizontal, ArrowDownAZ, Star, Wallet, Award, Gift, ChevronRight, Check } from 'lucide-react';

export const meta = () => [
  { title: "Browse gigs — GigDekho" },
  {
    name: "description",
    content:
      "Browse short-term gigs and internships across Indore — event staffing, promotions, delivery, tutoring and skilled project work. Apply in one tap and get paid to your wallet.",
  },
];

const ROLE_FILTERS = ['All Roles', 'Waitstaff', 'Artist', 'Singer', 'Security', 'Promoter', 'Hostess', 'DJ', 'Dancer', 'Photographer'];

const SORT_OPTIONS = [
  { id: 'soonest', label: 'Soonest first' },
  { id: 'pay', label: 'Highest pay' },
  { id: 'newest', label: 'Newly posted' },
] as const;

// Perk thresholds mirror the profile "Benefits" ladder
function nextPerk(completed: number) {
  if (completed < 5) return { title: 'Premium Gigs', at: 5, prev: 0 };
  if (completed < 15) return { title: '₹500 Cash Bonus', at: 15, prev: 5 };
  if (completed < 30) return { title: 'Top Tier Pro', at: 30, prev: 15 };
  return null;
}

function levelFor(completed: number) {
  if (completed > 30) return 'Elite';
  if (completed > 15) return 'Pro';
  if (completed > 5) return 'Intermediate';
  return 'Beginner';
}

export default function HomeScreen() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [trendingGigs, setTrendingGigs] = useState<any[]>([]);
  const [stats, setStats] = useState({ live: 0, topPay: 0, hiredToday: 0, sumToday: 0 });
  const [myApps, setMyApps] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]['id']>('soonest');
  const [feedTab, setFeedTab] = useState<'all' | 'event' | 'internship'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  // Logged-in worker data: one query powers earnings, applied & upcoming, and badges
  useEffect(() => {
    if (!user) { setMyApps([]); return; }
    (async () => {
      try {
        const [{ data }, { data: walletTxns }] = await Promise.all([
          supabase
            .from('applications')
            .select('id, status, waitlist_position, applied_at, gig:gigs(id, title, pay_rate, duration_hrs, event_date, location_text)')
            .eq('worker_id', user.id)
            .order('applied_at', { ascending: false }),
          supabase
            .from('wallet_transactions')
            .select('amount, status')
            .eq('worker_id', user.id)
            .neq('status', 'failed'),
        ]);
        setMyApps(data || []);
        setWalletBalance((walletTxns || []).reduce((acc, t) => acc + t.amount, 0));
      } catch (err) {
        console.error('Fetch worker activity error:', err);
      }
    })();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const nowIso = new Date().toISOString();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Only the columns the feed actually renders. `select('*')` pulled every
      // column of every open gig — descriptions, coordinates, JD links — and
      // was the single slowest request on the page.
      const FEED_FIELDS = `
        id, title, role_type, custom_role, location_text, pay_rate, duration_hrs,
        event_date, is_urgent, slots_total, slots_filled, status, gig_type,
        work_mode, commitment, duration_months, stipend_min, stipend_max,
        is_unpaid, application_deadline, cover_mode, cover_image_url
      `;

      // Run together rather than one after another — they don't depend on
      // each other, and awaiting in sequence made the page wait for the sum.
      const [gigsRes, hiredRes] = await Promise.all([
        supabase
          .from('gigs')
          .select(FEED_FIELDS)
          .eq('status', 'open')
          .gt('event_date', nowIso)
          .order('is_urgent', { ascending: false })
          .order('event_date', { ascending: true }),
        supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .gte('applied_at', startOfDay.toISOString()),
      ]);

      const { data: gigsData, error: fetchError } = gigsRes;
      const { count: hiredCount } = hiredRes;
      if (fetchError) throw fetchError;
      setGigs(gigsData || []);

      // Trending was a third request for rows we already have — same filter,
      // different sort. Derive it instead of asking the database twice.
      const trendingData = [...(gigsData || [])]
        .sort((a: any, b: any) =>
          (Number(b.is_urgent) - Number(a.is_urgent)) ||
          (b.slots_filled - a.slots_filled) ||
          (new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
        )
        .slice(0, 3);
      setTrendingGigs(trendingData);

      const open = gigsData || [];
      const totalSum = open.reduce((acc, gig) => acc + (gig.pay_rate * gig.duration_hrs), 0);
      const topPay = open.reduce((max, gig) => Math.max(max, gig.pay_rate), 0);

      setStats({
        live: open.length,
        topPay,
        hiredToday: hiredCount || 0,
        sumToday: totalSum,
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    const link = `${window.location.origin}/?ref=${user?.id ?? ''}`;
    const text = `I'm finding paid gigs in Indore on GigDekho. Join me: ${link}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'GigDekho', text, url: link }); } catch { /* user dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2500);
      } catch { /* clipboard unavailable */ }
    }
  };

  const filteredGigs = useMemo(() => {
    // Hide internships whose application deadline has passed
    let list = gigs.filter(g => !g.application_deadline || new Date(g.application_deadline) >= new Date());
    if (feedTab !== 'all') {
      list = list.filter(gig => (gig.gig_type ?? 'event') === feedTab);
    }
    if (selectedRole !== 'All Roles') {
      list = list.filter(gig => gig.role_type?.toLowerCase().includes(selectedRole.toLowerCase()));
    }
    const sorted = [...list];
    if (sortBy === 'pay') sorted.sort((a, b) => (b.pay_rate * b.duration_hrs) - (a.pay_rate * a.duration_hrs));
    else if (sortBy === 'newest') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else sorted.sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    return sorted;
  }, [gigs, selectedRole, sortBy, feedTab]);

  const internshipCount = gigs.filter(g => g.gig_type === 'internship').length;
  const eventCount = gigs.length - internshipCount;

  // Derived worker activity
  const completedApps = myApps.filter(a => a.status === 'completed' && a.gig);
  const completedCount = completedApps.length;
  const lifetimeEarned = completedApps.reduce((acc, a) => acc + a.gig.pay_rate * a.gig.duration_hrs, 0);
  const weekAgo = Date.now() - 7 * 24 * 3600000;
  const weekEarned = completedApps
    .filter(a => new Date(a.gig.event_date).getTime() >= weekAgo)
    .reduce((acc, a) => acc + a.gig.pay_rate * a.gig.duration_hrs, 0);
  const activeApps = myApps.filter(a => ['pending', 'accepted'].includes(a.status) && a.gig).slice(0, 3);
  const pendingCount = myApps.filter(a => a.status === 'pending').length;
  const avgRating = profile?.avg_rating || 0;
  const perk = nextPerk(completedCount);

  return (
    <main id="main-content" className="pb-24 lg:pb-12 bg-background min-h-screen">

      {/* Edge to Edge Faded Hero */}
      <div className="relative w-full pt-20 lg:pt-32 pb-24 lg:pb-36 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Torch reveal — hidden category words uncovered by the cursor */}
        <SpotlightCategories />
        {/* Floating Glass Rectangles */}
        <div className="absolute top-10 left-[15%] w-[250px] h-[500px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-60"></div>
        <div className="absolute top-20 right-[15%] w-[300px] h-[600px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-60"></div>

        <div data-torch-safe className="relative z-10 max-w-4xl mx-auto w-full">
          {user && (
            <div className="relative z-10 text-white/80 font-bold text-sm mb-3">
              Welcome, {profile?.full_name || 'Worker'}
            </div>
          )}
          {stats.live > 0 ? (
            <h1 className="text-5xl lg:text-[80px] font-black text-white leading-tight mb-4 tracking-tighter drop-shadow-md">
              Earn <span className="text-[#00e5ff]">₹{stats.sumToday.toLocaleString('en-IN')}</span> today
            </h1>
          ) : (
            <h1 className="text-5xl lg:text-[80px] font-black text-white leading-tight mb-4 tracking-tighter drop-shadow-md">
              Your next gig <span className="text-[#00e5ff]">starts here</span>
            </h1>
          )}
          <p className="text-white/90 font-medium text-lg lg:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            {stats.live > 0
              ? `${stats.live} gig${stats.live !== 1 ? 's' : ''} live right now. Participate, volunteer and earn through events in Indore!`
              : 'New gigs are posted daily across Indore. Set up your profile so you can apply in one tap.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-10">
             <button type="button" onClick={() => document.getElementById('available-jobs')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-8 py-3.5 rounded-full shadow-lg transition-all btn-tap w-full sm:w-auto">
               Browse Gigs
             </button>
             <button type="button" onClick={() => setShowHowItWorks(true)} className="border border-white/30 hover:bg-white hover:text-[#111111] text-white font-bold px-8 py-3.5 rounded-full glass-panel shadow-sm transition-all btn-tap w-full sm:w-auto">
               How it works
             </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 max-w-4xl mx-auto">
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Live Gigs</span>
                <span className="text-2xl font-black text-white tracking-tight">{stats.live}</span>
             </div>
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Top Pay</span>
                <span className="text-2xl font-black text-[#F4511E] tracking-tight">₹{stats.topPay >= 1000 ? (stats.topPay/1000).toFixed(1)+'k' : stats.topPay}<span className="text-xs font-bold text-white/40">/hr</span></span>
             </div>
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Hired Today</span>
                <span className="text-2xl font-black text-white tracking-tight">{stats.hiredToday}</span>
             </div>
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Payout</span>
                <span className="text-2xl font-black text-white tracking-tight">24hr</span>
             </div>
          </div>
        </div>
      </div>

      {/* How it works modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowHowItWorks(false)}>
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button type="button" aria-label="Close" onClick={() => setShowHowItWorks(false)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/10 rounded-full text-white/60 hover:text-white font-bold btn-tap">✕</button>
            <h3 className="text-2xl font-black text-white mb-6">How it works</h3>
            <div className="space-y-6">
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-[#00BCD4]/10 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4 border border-[#00BCD4]/20">1</div>
                 <div><p className="font-bold text-white">Browse gigs near you</p><p className="text-xs text-white/50 font-medium">Find verified local events.</p></div>
              </div>
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-[#00BCD4]/10 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4 border border-[#00BCD4]/20">2</div>
                 <div><p className="font-bold text-white">Apply in one tap</p><p className="text-xs text-white/50 font-medium">Zero friction application.</p></div>
              </div>
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-[#00BCD4]/10 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4 border border-[#00BCD4]/20">3</div>
                 <div><p className="font-bold text-white">Show up and get paid</p><p className="text-xs text-white/50 font-medium">Earnings hit your wallet within 24 hours.</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 xl:px-12 w-full mx-auto pt-10">
        {user && <ProfileCompletionNudge isOrganizerView={false} />}
        <div className="lg:grid lg:grid-cols-[65%_35%] lg:gap-10 items-start pb-12">

        {/* Left Column (Gigs) */}
        <section aria-label="Available Gigs" className="w-full" id="available-jobs">
          {/* List Header */}
          <div className="mb-4 flex justify-between items-start">
             <div className="flex flex-col">
                <h2 className="text-2xl font-black text-white tracking-tight mb-1">Available Gigs</h2>
                <p className="text-[13px] font-medium text-white/50">Handpicked gigs in Indore based on your profile</p>
             </div>
             <div className="flex space-x-2">
                <button
                  type="button"
                  aria-label="Filter gigs by role"
                  aria-expanded={showFilters}
                  onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}
                  className={`p-2.5 rounded-full transition-colors shadow-sm border relative ${showFilters || selectedRole !== 'All Roles' ? 'bg-[#F4511E]/15 border-[#F4511E]/30 text-[#F4511E]' : 'bg-[#1C1C1C] hover:bg-white/10 text-white/70 border-white/5'}`}
                >
                  <SlidersHorizontal size={18} />
                  {selectedRole !== 'All Roles' && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#F4511E] rounded-full" />}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Sort gigs"
                    aria-expanded={showSort}
                    onClick={() => { setShowSort(!showSort); setShowFilters(false); }}
                    className={`p-2.5 rounded-full transition-colors shadow-sm border ${showSort || sortBy !== 'soonest' ? 'bg-[#F4511E]/15 border-[#F4511E]/30 text-[#F4511E]' : 'bg-[#1C1C1C] hover:bg-white/10 text-white/70 border-white/5'}`}
                  >
                    <ArrowDownAZ size={18} />
                  </button>
                  {showSort && (
                    <div className="absolute right-0 mt-2 w-44 bg-[#1C1C1C] border border-white/10 shadow-2xl rounded-xl py-1.5 z-40 animate-in fade-in slide-in-from-top-1">
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => { setSortBy(opt.id); setShowSort(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center justify-between transition-colors ${sortBy === opt.id ? 'text-[#F4511E]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                        >
                          {opt.label}
                          {sortBy === opt.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* Feed type tabs */}
          {internshipCount > 0 && (
            <div className="flex bg-[#1C1C1C] border border-white/10 p-1 rounded-full w-full sm:w-auto sm:inline-flex mb-5">
              {([
                { id: 'all', label: `All (${gigs.length})` },
                { id: 'event', label: `Gigs (${eventCount})` },
                { id: 'internship', label: `Internships (${internshipCount})` },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFeedTab(t.id)}
                  aria-pressed={feedTab === t.id}
                  className={`flex-1 sm:flex-none sm:px-6 py-2 text-xs font-black rounded-full transition-all btn-tap min-h-0 ${
                    feedTab === t.id ? 'bg-[#F4511E] text-white shadow-md' : 'text-white/50 hover:text-white'
                  }`}
                  style={{ minHeight: '44px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Role Filter Panel */}
          {showFilters && (
            <div className="mb-5 bg-[#1C1C1C] border border-white/10 rounded-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Filter by role</p>
              <div className="flex flex-wrap gap-2">
                {ROLE_FILTERS.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`px-4 py-2 rounded-full text-xs font-bold border btn-tap transition-colors ${
                      selectedRole === role
                        ? 'bg-[#F4511E] border-[#F4511E] text-white shadow-md'
                        : 'bg-transparent border-white/10 text-white/60 hover:border-[#F4511E]/50 hover:text-white'
                    }`}
                  >
                    {role === 'All Roles' ? 'All' : role}
                  </button>
                ))}
              </div>
            </div>
          )}

        {error && (
           <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm font-bold border border-red-500/20 mb-4 flex justify-between items-center">
             <span>{error}</span>
             <button type="button" onClick={fetchData} className="underline text-red-300">Retry</button>
           </div>
        )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-[#1C1C1C] rounded-2xl p-5 lg:p-6 shadow-sm border border-white/5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/4 mb-3"></div>
                  <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                  <div className="flex justify-between">
                    <div className="h-8 bg-white/10 rounded w-1/3"></div>
                    <div className="h-8 bg-white/10 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State — always suggests a next action */}
          {!loading && filteredGigs.length === 0 && !error && (
             <div className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-8 lg:p-16 flex flex-col items-center justify-center text-center mt-6">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 text-[#F4511E]">
                  <Briefcase size={36} />
                </div>
                {selectedRole !== 'All Roles' ? (
                  <>
                    <p className="text-white font-black mb-1 text-lg">No {selectedRole} gigs right now</p>
                    <p className="text-white/50 font-medium mb-5 max-w-sm">Other roles are hiring — clear the filter to see everything available.</p>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('All Roles')}
                      className="flex items-center justify-center bg-[#F4511E] text-white px-5 py-2.5 rounded-xl font-bold min-h-[44px] text-sm shadow-sm hover:bg-[#D84315] transition-colors btn-tap"
                    >
                      Show All Gigs
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white font-black mb-1 text-lg">No open gigs at this moment</p>
                    <p className="text-white/50 font-medium mb-5 max-w-sm">
                      New gigs get posted daily — meanwhile, complete your profile and add skills so you're first in line when one drops.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={fetchData}
                        className="flex items-center justify-center bg-[#F4511E] text-white px-5 py-2.5 rounded-xl font-bold min-h-[44px] text-sm shadow-sm hover:bg-[#D84315] transition-colors btn-tap"
                      >
                        <RefreshCw size={16} className="mr-2" /> Refresh
                      </button>
                      {user && (
                        <button
                          type="button"
                          onClick={() => navigate('/worker/profile')}
                          className="flex items-center justify-center border border-white/15 text-white/80 hover:text-white hover:border-white/30 px-5 py-2.5 rounded-xl font-bold min-h-[44px] text-sm transition-colors btn-tap"
                        >
                          Update My Skills
                        </button>
                      )}
                    </div>
                  </>
                )}
             </div>
          )}

          {/* Gig List */}
          {!loading && filteredGigs.length > 0 && (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-2">
              {filteredGigs.map(gig => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  onClick={() => navigate(`/gigs/${gig.id}`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Right Column — worker sections (stacked below feed on mobile) */}
        <div className="mt-10 lg:mt-0 lg:sticky lg:top-24 space-y-6">

           {/* Earnings Tracker */}
           {user && (
              <div className="bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5 relative overflow-hidden">
                 <div className="absolute right-[-40px] top-[-40px] w-40 h-40 bg-[#F4511E]/5 rounded-full blur-2xl pointer-events-none" />
                 <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#F4511E]/10 rounded-full flex items-center justify-center text-[#F4511E] mr-3 border border-[#F4511E]/20 shadow-sm">
                        <Wallet size={18} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-[15px] leading-tight">Earnings Tracker</h3>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">This week & lifetime</span>
                      </div>
                    </div>
                 </div>
                 {/* Wallet balance front and center */}
                 <button
                   type="button"
                   onClick={() => navigate('/worker/earnings')}
                   className="w-full bg-gradient-to-r from-[#F4511E]/15 to-transparent border border-[#F4511E]/25 rounded-2xl px-4 py-3.5 mb-3 flex items-center justify-between btn-tap hover:border-[#F4511E]/50 transition-colors"
                 >
                   <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Wallet Balance</span>
                   <span className="text-2xl font-black text-[#F4511E] tracking-tight">₹{walletBalance.toLocaleString('en-IN')}</span>
                 </button>
                 <div className="grid grid-cols-2 gap-4 w-full mb-4">
                    <div className="bg-[#111111] rounded-2xl py-4 px-3 flex flex-col items-center justify-center shadow-sm border border-white/5">
                       <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">This Week</p>
                       <p className="text-2xl font-black text-white leading-none tracking-tight">₹{weekEarned.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-[#111111] rounded-2xl py-4 px-3 flex flex-col items-center justify-center shadow-sm border border-white/5">
                       <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">Lifetime</p>
                       <p className="text-2xl font-black text-white leading-none tracking-tight">₹{lifetimeEarned.toLocaleString('en-IN')}</p>
                    </div>
                 </div>
                 {completedCount === 0 ? (
                    <p className="text-xs font-medium text-white/40">Complete your first gig and watch this number grow.</p>
                 ) : (
                    <button type="button" onClick={() => navigate('/worker/earnings')} className="text-[#F4511E] text-xs font-bold hover:underline flex items-center btn-tap">
                      View full earnings history <ChevronRight size={14} className="ml-0.5" />
                    </button>
                 )}
              </div>
           )}

           {/* Applied & Upcoming */}
           {user && (
              <div className="bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5">
                 <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 mr-3 border border-blue-500/20 shadow-sm relative">
                        <Briefcase size={18} />
                        {pendingCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#F4511E] rounded-full animate-pulse border-2 border-[#1C1C1C]" />}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-[15px] leading-tight">Applied & Upcoming</h3>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                          {pendingCount > 0 ? `${pendingCount} pending` : 'All resolved'}
                        </span>
                      </div>
                    </div>
                 </div>
                 {activeApps.length === 0 ? (
                    <div className="bg-[#111111] rounded-2xl p-4 border border-white/5 border-dashed">
                      <p className="text-xs font-medium text-white/40 mb-2">No active applications — pick a gig from the feed and apply in one tap.</p>
                      <button type="button" onClick={() => document.getElementById('available-jobs')?.scrollIntoView({ behavior: 'smooth' })} className="text-[#F4511E] text-xs font-bold hover:underline btn-tap">
                        Browse gigs above →
                      </button>
                    </div>
                 ) : (
                    <div className="space-y-3">
                      {activeApps.map(app => {
                        const isPending = app.status === 'pending';
                        return (
                          <button
                            key={app.id}
                            type="button"
                            onClick={() => navigate(`/gigs/${app.gig.id}`)}
                            className="w-full text-left bg-[#111111] rounded-2xl p-3.5 border border-white/5 hover:border-[#F4511E]/30 transition-colors btn-tap flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate">{app.gig.title}</p>
                              <p className="text-[11px] font-semibold text-white/40 mt-0.5">{formatRelativeDate(app.gig.event_date)}</p>
                            </div>
                            <span className={`shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                              isPending
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-green-500/10 text-green-400 border-green-500/20'
                            }`}>
                              {isPending && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />}
                              {isPending ? (app.waitlist_position != null ? `Waitlist #${app.waitlist_position}` : 'Pending') : 'Confirmed'}
                            </span>
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => navigate('/worker/dashboard')} className="text-[#F4511E] text-xs font-bold hover:underline flex items-center btn-tap">
                        View all my gigs <ChevronRight size={14} className="ml-0.5" />
                      </button>
                    </div>
                 )}
              </div>
           )}

           {/* Ratings & Badges */}
           {user && (
              <div className="bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5">
                 <div className="flex items-center mb-5">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-400 mr-3 border border-amber-500/20 shadow-sm">
                      <Award size={18} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-[15px] leading-tight">Ratings & Badges</h3>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{levelFor(completedCount)} tier</span>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4 w-full mb-3">
                    <div className="bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5">
                       <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">Gigs Done</p>
                       <p className="text-2xl font-black text-white leading-none tracking-tight">{completedCount}</p>
                    </div>
                    <div className="bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5">
                       <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">Rating</p>
                       <p className="text-2xl font-black text-[#F4511E] leading-none tracking-tight flex items-center gap-1">
                         {avgRating > 0 ? Number(avgRating).toFixed(1) : '—'}
                         {avgRating > 0 && <Star size={14} className="fill-current text-amber-400" />}
                       </p>
                    </div>
                 </div>
                 <button type="button" onClick={() => navigate('/worker/profile')} className="text-[#F4511E] text-xs font-bold hover:underline flex items-center btn-tap">
                   View trophy case <ChevronRight size={14} className="ml-0.5" />
                 </button>
              </div>
           )}

           {/* Perks Progress */}
           {user && perk && (
              <div className="bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5">
                 <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400 mr-3 border border-purple-500/20 shadow-sm">
                      <Gift size={18} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-[15px] leading-tight">Perks Progress</h3>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Next unlock: {perk.title}</span>
                    </div>
                 </div>
                 <div className="w-full bg-[#111111] rounded-full h-3 overflow-hidden mb-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-[#F4511E] h-full rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, ((completedCount - perk.prev) / (perk.at - perk.prev)) * 100)}%` }}
                    />
                 </div>
                 <p className="text-xs font-bold text-white/40 text-right">
                   {perk.at - completedCount} gig{perk.at - completedCount !== 1 ? 's' : ''} to unlock
                 </p>
              </div>
           )}

           {/* Trending Now */}
           {trendingGigs.length > 0 && (
              <div className="bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 py-6">
                 <h3 className="font-extrabold text-white px-6 mb-6 tracking-tight text-[17px]">
                   Trending Now
                 </h3>

                 <div className="space-y-5 mt-2 px-6">
                    {trendingGigs.map((trend, i) => {
                      const trendSubtext = trend.is_urgent
                        ? "Urgent Gig — Apply immediately"
                        : (trend.slots_filled > 0
                            ? `${trend.slots_filled} worker(s) hired already`
                            : "Be the first to apply!");
                      return (
                        <div key={trend.id} className={`flex items-start ${i > 0 && 'border-t border-white/5 pt-5'}`}>
                           <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-4 border shrink-0 ${
                             i === 0 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                             i === 1 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                             'bg-purple-500/10 text-purple-400 border-purple-500/20'
                           }`}>
                             <Star size={16} fill="none" strokeWidth={3}/>
                           </div>
                           <button type="button" className="text-left cursor-pointer hover:underline bg-transparent border-0 p-0" onClick={() => navigate(`/gigs/${trend.id}`)}>
                             <p className="font-bold text-white text-sm leading-tight line-clamp-1">{trend.title}</p>
                             <p className="text-white/40 font-bold text-[11px] mt-0.5">{trendSubtext}</p>
                           </button>
                        </div>
                      );
                    })}
                 </div>
              </div>
           )}

           {/* Refer a Friend */}
           <div className="bg-gradient-to-br from-[#6231d4] to-[#4510b6] rounded-3xl p-6 relative overflow-hidden shadow-lg border border-[#7d4de2]">
             <div className="absolute right-[-30px] bottom-[-30px] opacity-20">
               <Users size={140} className="text-white"/>
             </div>

             <h3 className="font-black text-white text-lg mb-2 relative z-10 tracking-tight">Refer a Friend</h3>
             <p className="text-[13px] font-medium text-white/80 mb-6 leading-relaxed relative z-10 max-w-[200px]">
               Share GigDekho with friends who want to earn in Indore.
             </p>
             <button type="button" onClick={handleInvite} className="bg-white hover:bg-slate-50 text-[#6231d4] font-bold py-2.5 px-6 text-sm rounded-full transition-colors shadow-sm btn-tap relative z-10">
               {inviteCopied ? '✓ Link Copied!' : 'Get Invite Link'}
             </button>
           </div>

        </div>

        </div>
      </div>
    </main>
  );
}
