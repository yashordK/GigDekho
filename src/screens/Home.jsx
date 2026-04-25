import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import GigCard from '../components/GigCard';
import { Briefcase, RefreshCw, TrendingUp, Award, Clock, Zap, Calendar, Wallet, Users, SlidersHorizontal, ArrowDownAZ, Star, ChevronRight } from 'lucide-react';

export default function HomeScreen() {
  const [gigs, setGigs] = useState([]);
  const [trendingGigs, setTrendingGigs] = useState([]);
  const [stats, setStats] = useState({ live: 0, topPay: 0, hiredToday: 0, sumToday: 0 });
  const [userStats, setUserStats] = useState({ done: 0, rating: 4.9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const roleCategories = [
    { id: 'All Roles', icon: '🎯' },
    { id: 'Waitstaff', icon: '🍽️' },
    { id: 'Artist', icon: '🎨' },
    { id: 'Singer', icon: '🎤' },
    { id: 'Security', icon: '🛡️' },
    { id: 'Promoter', icon: '🔥' },
    { id: 'Hostess', icon: '✨' },
    { id: 'DJ', icon: '🎧' },
    { id: 'Dancer', icon: '💃' },
    { id: 'Photographer', icon: '📸' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: gigsData, error: fetchError } = await supabase
        .from('gigs')
        .select('*')
        .eq('status', 'open')
        .gt('event_date', new Date().toISOString())
        .order('is_urgent', { ascending: false })
        .order('event_date', { ascending: true });

      if (fetchError) throw fetchError;
      setGigs(gigsData || []);

      // Live gigs count
      const { count: liveCount } = await supabase
        .from('gigs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gt('event_date', new Date().toISOString());

      // Top pay today
      const { data: topPayData } = await supabase
        .from('gigs')
        .select('pay_rate')
        .eq('status', 'open')
        .order('pay_rate', { ascending: false })
        .limit(1);

      // Hired today — count applications created today
      const { count: hiredCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .gte('applied_at', new Date().toDateString());

      // Trending jobs
      const { data: trendingData } = await supabase
        .from('gigs')
        .select('*')
        .eq('status', 'open')
        .order('slots_filled', { ascending: false })
        .limit(3);

      setTrendingGigs(trendingData || []);

      // Calculate total potential pay
      const totalSum = (gigsData || []).reduce((acc, gig) => acc + (gig.pay_rate * gig.duration_hrs), 0);

      setStats({
        live: liveCount || 0,
        topPay: topPayData?.[0]?.pay_rate || 0,
        hiredToday: hiredCount || 0,
        sumToday: totalSum
      });
      
      // If user exists, fetch user specific stats
      if (user) {
         const { count: completedCount } = await supabase
           .from('applications')
           .select('*', { count: 'exact', head: true })
           .eq('worker_id', user.id)
           .eq('status', 'completed');
           
         // Profile avg_rating is ideal but mocking fallback for MVP if null
         setUserStats({
           done: completedCount || 0,
           rating: profile?.avg_rating || 4.9
         });
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredGigs = gigs.filter(gig => {
    if (selectedRole !== 'All Roles') {
      if (!gig.role_type) return false;
      return gig.role_type.toLowerCase().includes(selectedRole.toLowerCase());
    }
    return true;
  });

  return (
    <div className="pb-24 lg:pb-12 bg-background min-h-screen">
      
      {/* Edge to Edge Faded Hero */}
      <div className="relative w-full pt-20 lg:pt-32 pb-32 lg:pb-48 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Floating Glass Rectangles */}
        <div className="absolute top-10 left-[15%] w-[250px] h-[500px] floating-glass-rect -rotate-12 z-0 hidden lg:block opacity-60"></div>
        <div className="absolute top-20 right-[15%] w-[300px] h-[600px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-60"></div>

        <div className="relative z-10 max-w-4xl mx-auto w-full">
          <h1 className="text-5xl lg:text-[80px] font-black text-white leading-tight mb-4 tracking-tighter drop-shadow-md">
            Earn <span className="text-[#00e5ff]">₹{stats.sumToday.toLocaleString('en-IN')}</span> today
          </h1>
          <p className="text-white/90 font-medium text-lg lg:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            {stats.live} gigs live right now. Participate, volunteer and earn through events in Indore!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-10">
             <button id="browse-gigs" onClick={() => document.getElementById('available-jobs')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-8 py-3.5 rounded-full shadow-lg transition-all btn-tap w-full sm:w-auto">
               Browse Gigs
             </button>
             <button onClick={() => setShowHowItWorks(true)} className="border border-white/30 hover:bg-white hover:text-[#111111] text-white font-bold px-8 py-3.5 rounded-full glass-panel shadow-sm transition-all btn-tap w-full sm:w-auto">
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
                <span className="text-2xl font-black text-[#F4511E] tracking-tight">₹{stats.topPay >= 1000 ? (stats.topPay/1000).toFixed(1)+'k' : stats.topPay}</span>
             </div>
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Hired Today</span>
                <span className="text-2xl font-black text-white tracking-tight">{stats.hiredToday}</span>
             </div>
             <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-white/60 text-[10px] uppercase font-black tracking-widest mb-1">Payout</span>
                <span className="text-2xl font-black text-white tracking-tight">1hr</span>
             </div>
          </div>
        </div>
      </div>
      
      {/* How it works modal MVP */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowHowItWorks(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHowItWorks(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 font-bold">✕</button>
            <h3 className="text-2xl font-black text-slate-900 mb-6">How it works</h3>
            <div className="space-y-6">
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4">1</div>
                 <div><p className="font-bold text-slate-800">Browse gigs near you</p><p className="text-xs text-slate-500 font-medium">Find verified local events.</p></div>
              </div>
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4">2</div>
                 <div><p className="font-bold text-slate-800">Apply in one tap</p><p className="text-xs text-slate-500 font-medium">Zero friction application.</p></div>
              </div>
              <div className="flex items-start">
                 <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#00BCD4] font-black flex items-center justify-center shrink-0 mr-4">3</div>
                 <div><p className="font-bold text-slate-800">Show up and get paid</p><p className="text-xs text-slate-500 font-medium">Earn within 1 hour after completion.</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Strip (overlaps the fade) */}
      <div className="px-4 xl:px-12 w-full mx-auto relative z-20 -mt-16 lg:-mt-24 mb-12">
        <div className="bg-[#1C1C1C]/80 backdrop-blur-xl border border-white/10 shadow-lg rounded-full p-2 flex space-x-1 overflow-x-auto category-strip max-w-6xl mx-auto items-center">
          {roleCategories.map(cat => (
             <button 
               key={cat.id}
               onClick={() => setSelectedRole(cat.id)}
               className={`flex items-center px-6 lg:px-8 py-3 rounded-full text-[13px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                 selectedRole === cat.id 
                   ? 'bg-[#F4511E] text-white shadow-md' 
                   : 'text-white/60 hover:bg-white/5 hover:text-white'
               }`}
             >
               {cat.id === 'All Roles' ? 'All' : cat.id}
             </button>
          ))}
        </div>
      </div>
      <div className="px-4 xl:px-12 w-full mx-auto">
        <div className="lg:grid lg:grid-cols-[65%_35%] lg:gap-10 items-start pb-12">
          
        {/* Left Column (Gigs) */}
        <div className="w-full" id="available-jobs">
          {/* List Header */}
          <div className="mb-6 lg:mb-8 flex justify-between items-start">
             <div className="flex flex-col">
                <h2 className="text-2xl font-black text-white tracking-tight mb-1">Available Jobs</h2>
                <p className="text-[13px] font-medium text-white/50">Handpicked gigs in Indore based on your profile</p>
             </div>
             <div className="flex space-x-2">
                <button className="bg-[#1C1C1C] hover:bg-white/10 p-2 rounded-full text-white/70 transition-colors shadow-sm border border-white/5">
                  <SlidersHorizontal size={18} />
                </button>
                <button className="bg-[#1C1C1C] hover:bg-white/10 p-2 rounded-full text-white/70 transition-colors shadow-sm border border-white/5">
                  <ArrowDownAZ size={18} />
                </button>
             </div>
          </div>
        {error && (
           <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 mb-4 flex justify-between items-center">
             <span>{error}</span>
             <button onClick={fetchData} className="underline text-red-700">Retry</button>
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

          {/* Empty State */}
          {!loading && filteredGigs.length === 0 && !error && (
             <div className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-8 lg:p-16 flex flex-col items-center justify-center text-center mt-6">
               <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-5 text-[#F4511E]">
                 <Briefcase size={36} />
               </div>
               <p className="text-white/60 font-medium mb-5">No gigs right now — check back in a bit.</p>
               <button 
                 onClick={fetchData}
                 className="flex items-center justify-center bg-[#F4511E] text-white px-5 py-2.5 rounded-xl font-bold min-h-[44px] text-sm shadow-sm hover:bg-[#D84315] transition-colors btn-tap"
               >
                 <RefreshCw size={16} className="mr-2" /> Refresh
               </button>
             </div>
          )}

          {/* Gig List */}
          {!loading && filteredGigs.length > 0 && (
            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-5 md:space-y-0 lg:grid-cols-2">
              {filteredGigs.map(gig => (
                <GigCard 
                  key={gig.id} 
                  gig={gig} 
                  onClick={() => navigate(`/gig/${gig.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block sticky top-24 space-y-6">
           
           {/* Your Activity - Restricted to logged in users */}
           {user && (
             <div className="bg-[#1C1C1C] rounded-3xl p-6 shadow-sm border border-white/5 flex flex-col items-start relative">
                <div className="flex items-center mb-6">
                   <div className="w-10 h-10 bg-[#F4511E]/10 rounded-full flex items-center justify-center text-[#F4511E] mr-4 border border-[#F4511E]/20 shadow-sm">
                     <Zap size={20} fill="currentColor" />
                   </div>
                   <div>
                     <h3 className="font-extrabold text-white text-[15px] leading-tight">Your Activity</h3>
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Worker Performance</span>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full">
                   <div className="bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">Gigs Done</p>
                      <p className="text-2xl font-black text-white leading-none tracking-tight">{userStats.done}</p>
                   </div>
                   <div className="bg-[#111111] rounded-2xl py-4 flex flex-col items-center justify-center shadow-sm border border-white/5 relative">
                      <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1 leading-none">Rating</p>
                      <p className="text-2xl font-black text-[#F4511E] leading-none tracking-tight">{userStats.rating}</p>
                   </div>
                </div>
             </div>
           )}

           {/* Trending Now */}
           {trendingGigs.length > 0 && (
             <div className="bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 py-6">
                <h3 className="font-extrabold text-white px-6 mb-6 tracking-tight text-[17px]">
                  Trending Now
                </h3>
                
                <div className="space-y-5 mt-2 px-6">
                   {trendingGigs.map((trend, i) => (
                     <div key={trend.id} className={`flex items-start ${i > 0 && 'border-t border-white/5 pt-5'}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-4 border shrink-0 ${
                          i === 0 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                          i === 1 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}>
                          <Star size={16} fill="none" strokeWidth={3}/>
                        </div>
                        <div className="cursor-pointer hover:underline" onClick={() => navigate(`/gig/${trend.id}`)}>
                          <p className="font-bold text-white text-sm leading-tight line-clamp-1">{trend.title}</p>
                          <p className="text-white/40 font-bold text-[11px] mt-0.5">{trend.slots_filled || 0}+ applications in last hour</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}

           {/* Refer a Friend Purple Block */}
           <div className="bg-gradient-to-br from-[#6231d4] to-[#4510b6] rounded-3xl p-6 relative overflow-hidden shadow-lg border border-[#7d4de2]">
             <div className="absolute right-[-30px] bottom-[-30px] opacity-20">
               <Users size={140} className="text-white"/>
             </div>
             
             <h3 className="font-black text-white text-lg mb-2 relative z-10 tracking-tight">Refer a Friend</h3>
             <p className="text-[13px] font-medium text-white/80 mb-6 leading-relaxed relative z-10 max-w-[200px]">
               Get ₹500 for every professional you invite.
             </p>
             <button className="bg-white hover:bg-slate-50 text-[#6231d4] font-bold py-2.5 px-6 text-sm rounded-full transition-colors shadow-sm btn-tap relative z-10">
               Get Invite Link
             </button>
           </div>

        </div>

        </div>
      </div>
    </div>
  );
}
