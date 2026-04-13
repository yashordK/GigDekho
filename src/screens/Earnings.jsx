import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Banknote, Wallet, Calendar, AlertCircle } from 'lucide-react';
import { formatRelativeDate } from '../lib/utils';

export default function EarningsScreen() {
  const { user, profile } = useAuth();
  const [apps, setApps] = useState([]);
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
      
      const fetchedApps = data || [];
      setApps(fetchedApps);
      
      const sum = fetchedApps.reduce((acc, app) => {
        if (!app.gig) return acc;
        return acc + (app.gig.pay_rate * app.gig.duration_hrs);
      }, 0);
      setTotalEarned(sum);
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 lg:pb-12 bg-background min-h-screen">
      
      {/* Edge to Edge Earnings Header */}
      <div className="relative w-full pt-12 pb-24 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6">
        <div className="absolute top-10 right-[30%] w-[300px] h-[300px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-40"></div>
        <div className="absolute bottom-0 left-[10%] w-[400px] h-[200px] floating-glass-rect rotate-6 z-0 hidden lg:block opacity-30"></div>
        
        <h1 className="text-3xl lg:text-5xl font-black text-white mb-8 tracking-tight relative z-10 drop-shadow-md">Earnings Dashboard</h1>
        
        <div className="flex flex-col items-center justify-center text-center relative z-10 w-full">
            <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white/20 rounded-full flex items-center justify-center text-white mb-4 shadow-xl backdrop-blur-md border border-white/40 group-hover:scale-110 transition-transform">
               <Wallet size={28} className="lg:w-8 lg:h-8" />
            </div>
            <h2 className="text-cyan-100 font-extrabold uppercase tracking-widest text-[11px] lg:text-xs mb-2">Lifetime Earned</h2>
            <div className="text-6xl lg:text-[100px] font-black text-white tracking-tighter leading-none drop-shadow-xl">
              ₹{totalEarned.toLocaleString('en-IN')}
            </div>
        </div>
      </div>

      <div className="px-4 xl:px-12 w-full mx-auto relative z-10 lg:grid lg:grid-cols-3 lg:gap-8 items-start">
         
         <div className="lg:col-span-1">
           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 lg:p-8 flex justify-between items-center mb-6 lg:mb-0">
            <div>
               <p className="text-xs lg:text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Missions Completed</p>
               <p className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">{apps.length}</p>
            </div>
            <div className="w-14 h-14 lg:w-16 lg:h-16 bg-green-50 text-accent rounded-full flex justify-center items-center shadow-inner border border-green-100">
               <Banknote size={24} className="lg:w-8 lg:h-8" />
            </div>
           </div>
         </div>

         <div className="lg:col-span-2">
           <h2 className="text-xl lg:text-2xl font-black text-slate-800 mb-5 tracking-tight px-2">Payout History</h2>

           {error && (
             <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 mb-5 flex items-center">
               <AlertCircle size={18} className="mr-2" />
               <span>{error}</span>
             </div>
           )}

           {loading ? (
              <div className="flex justify-center p-10"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>
           ) : apps.length === 0 && !error ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-8 lg:p-12 flex flex-col items-center justify-center text-center shadow-sm">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-300 shadow-inner border border-slate-100">
                 <Banknote size={32} />
               </div>
               <p className="text-slate-900 font-black mb-2 text-xl tracking-tight">No earnings yet</p>
               <p className="text-base font-medium text-slate-500 max-w-xs">Complete your first gig to watch your earnings grow here.</p>
             </div>
           ) : (
              <div className="space-y-3 lg:space-y-4">
                {apps.map(app => {
                   if (!app.gig) return null;
                   return (
                     <div key={app.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md hover:border-blue-100 transition-all cursor-default">
                        <div className="flex items-center">
                            <div className="w-12 h-12 bg-orange-50 text-primary rounded-full flex items-center justify-center mr-4 lg:mr-5 border border-orange-100">
                              <Banknote size={20} />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 leading-tight lg:text-lg mb-1 tracking-tight">{app.gig.title}</h3>
                              <div className="flex items-center text-xs lg:text-sm font-bold text-slate-500">
                                 <Calendar size={12} className="mr-1.5 text-slate-400" />
                                 {formatRelativeDate(app.gig.event_date)}
                              </div>
                            </div>
                        </div>
                        <div className="text-right">
                           <div className="font-black text-accent text-xl lg:text-2xl tracking-tighter">
                             +₹{app.gig.pay_rate * app.gig.duration_hrs}
                           </div>
                        </div>
                     </div>
                   );
                })}
              </div>
           )}
         </div>
      </div>
    </div>
  );
}
