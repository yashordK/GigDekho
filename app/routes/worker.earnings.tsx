import { useState, useEffect, useMemo } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useAuth } from '~/context/AuthContext';
import { useNavigate } from 'react-router';
import { Banknote, Wallet, Calendar, AlertCircle, TrendingUp } from 'lucide-react';
import { formatRelativeDate } from '~/lib/utils';
import WalletCard from '~/components/WalletCard';

const WEEKS_SHOWN = 8;

export default function EarningsScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchCompletedGigs();
    }
  }, [user]);

  const fetchCompletedGigs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('applications')
        .select(`*, gig:gigs(*)`)
        .eq('worker_id', user.id)
        .eq('status', 'completed')
        .order('applied_at', { ascending: false });

      if (fetchError) throw fetchError;

      const fetchedApps = (data || []).filter(a => a.gig);
      setApps(fetchedApps);
      setTotalEarned(fetchedApps.reduce((acc, app) => acc + app.gig.pay_rate * app.gig.duration_hrs, 0));
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Weekly buckets for the last N weeks (by gig date) — the "growing graph"
  const weekly = useMemo(() => {
    const now = new Date();
    const buckets: { label: string; total: number }[] = [];
    for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay() - i * 7); // week starts Sunday
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const total = apps.reduce((acc, app) => {
        const d = new Date(app.gig.event_date);
        return d >= start && d < end ? acc + app.gig.pay_rate * app.gig.duration_hrs : acc;
      }, 0);
      buckets.push({
        label: i === 0 ? 'This wk' : start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        total,
      });
    }
    return buckets;
  }, [apps]);

  const thisWeek = weekly[weekly.length - 1]?.total ?? 0;
  const maxWeek = Math.max(1, ...weekly.map(w => w.total));
  const hasAnyWeeklyData = weekly.some(w => w.total > 0);

  return (
    <div className="pb-24 lg:pb-12 bg-background min-h-screen">

      {/* Edge to Edge Earnings Header */}
      <div className="relative w-full pt-12 pb-20 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-8">
        <div className="absolute top-10 right-[30%] w-[300px] h-[300px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-40"></div>
        <div className="absolute bottom-0 left-[10%] w-[400px] h-[200px] floating-glass-rect rotate-6 z-0 hidden lg:block opacity-30"></div>

        <h1 className="text-3xl lg:text-5xl font-black text-white mb-8 tracking-tight relative z-10 drop-shadow-md">Earnings Dashboard</h1>

        <div className="flex flex-col items-center justify-center text-center relative z-10 w-full">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white/20 rounded-full flex items-center justify-center text-white mb-4 shadow-xl backdrop-blur-md border border-white/40">
               <Wallet size={28} className="lg:w-8 lg:h-8" />
            </div>
            <h2 className="text-cyan-100 font-extrabold uppercase tracking-widest text-[11px] lg:text-xs mb-2">Lifetime Earned</h2>
            <div className="text-6xl lg:text-[100px] font-black text-white tracking-tighter leading-none drop-shadow-xl">
              ₹{totalEarned.toLocaleString('en-IN')}
            </div>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur px-4 py-1.5 rounded-full">
              <TrendingUp size={14} className="text-[#00e5ff]" />
              <span className="text-white/90 text-xs font-bold">₹{thisWeek.toLocaleString('en-IN')} this week</span>
            </div>
        </div>
      </div>

      <div className="px-4 xl:px-12 w-full mx-auto relative z-10 lg:grid lg:grid-cols-3 lg:gap-8 items-start">

         <div className="lg:col-span-1 space-y-6 mb-8 lg:mb-0">
            {/* Wallet — balance, withdraw, activity log */}
            {user && <WalletCard userId={user.id} />}

            {/* Gigs completed */}
            <div className="bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 p-6 lg:p-8 flex justify-between items-center">
             <div>
                <p className="text-xs lg:text-sm font-black uppercase tracking-widest text-white/40 mb-1">Gigs Completed</p>
                <p className="text-4xl lg:text-5xl font-black text-white tracking-tight">{apps.length}</p>
             </div>
             <div className="w-14 h-14 lg:w-16 lg:h-16 bg-green-500/10 text-green-400 rounded-full flex justify-center items-center shadow-inner border border-green-500/20">
                <Banknote size={24} className="lg:w-8 lg:h-8" />
             </div>
            </div>

            {/* Weekly bar chart */}
            <div className="bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 p-6 lg:p-8">
              <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-5">Last {WEEKS_SHOWN} Weeks</p>
              {hasAnyWeeklyData ? (
                <div className="flex items-end justify-between gap-2 h-32" role="img" aria-label="Weekly earnings bar chart">
                  {weekly.map((w, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end">
                      {w.total > 0 && (
                        <span className="text-[9px] font-black text-white/60 mb-1">₹{w.total >= 1000 ? (w.total / 1000).toFixed(1) + 'k' : w.total}</span>
                      )}
                      <div
                        className={`w-full max-w-[26px] rounded-t-md transition-all duration-700 ${i === weekly.length - 1 ? 'bg-[#F4511E]' : 'bg-white/15'}`}
                        style={{ height: `${Math.max(w.total > 0 ? 8 : 2, (w.total / maxWeek) * 100)}%` }}
                      />
                      <span className="text-[8px] font-bold text-white/30 mt-1.5 truncate w-full text-center">{w.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-white/40">
                  Your weekly earnings graph appears here after your first completed gig.
                </p>
              )}
            </div>
         </div>

         <div className="lg:col-span-2">
            <h2 className="text-xl lg:text-2xl font-black text-white mb-5 tracking-tight px-2">Payout History</h2>

            {error && (
              <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm font-bold border border-red-500/20 mb-5 flex items-center justify-between">
                <span className="flex items-center"><AlertCircle size={18} className="mr-2" />{error}</span>
                <button type="button" onClick={fetchCompletedGigs} className="underline text-red-300">Retry</button>
              </div>
            )}

            {loading ? (
               <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div></div>
            ) : apps.length === 0 && !error ? (
               <div className="bg-[#1C1C1C] border border-white/5 rounded-3xl p-8 lg:p-12 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 text-[#F4511E] shadow-inner">
                  <Banknote size={32} />
                </div>
                <p className="text-white font-black mb-2 text-xl tracking-tight">No earnings yet</p>
                <p className="text-base font-medium text-white/50 max-w-xs mb-6">Complete your first gig to watch your earnings grow here.</p>
                <button
                  type="button"
                  onClick={() => navigate('/worker/home')}
                  className="px-8 py-3 bg-[#F4511E] text-white text-sm font-black rounded-xl shadow-lg hover:bg-[#D84315] transition-colors btn-tap"
                >
                  Find a Gig
                </button>
              </div>
            ) : (
               <div className="space-y-3 lg:space-y-4">
                 {apps.map(app => (
                   <div key={app.id} className="bg-[#1C1C1C] rounded-2xl p-5 shadow-sm border border-white/5 flex items-center justify-between hover:border-[#F4511E]/20 transition-all animate-in fade-in duration-300">
                      <div className="flex items-center min-w-0">
                          <div className="w-12 h-12 bg-[#F4511E]/10 text-[#F4511E] rounded-full flex items-center justify-center mr-4 lg:mr-5 border border-[#F4511E]/20 shrink-0">
                            <Banknote size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-white leading-tight lg:text-lg mb-1 tracking-tight truncate">{app.gig.title}</h3>
                            <div className="flex items-center text-xs lg:text-sm font-bold text-white/40">
                               <Calendar size={12} className="mr-1.5" />
                               {formatRelativeDate(app.gig.event_date)}
                            </div>
                          </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                         <div className="font-black text-green-400 text-xl lg:text-2xl tracking-tighter">
                           +₹{(app.gig.pay_rate * app.gig.duration_hrs).toLocaleString('en-IN')}
                         </div>
                      </div>
                   </div>
                 ))}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
