import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, Briefcase } from 'lucide-react';
import { formatRelativeDate } from '../lib/utils';

const getImageUrl = (role) => {
  const r = (role || '').toLowerCase();
  let url = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400';
  if (r.includes('wait') || r.includes('hostess')) url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400';
  else if (r.includes('sing') || r.includes('vocal')) url = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400';
  else if (r.includes('dj') || r.includes('disc')) url = 'https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=400';
  else if (r.includes('art') || r.includes('sketch')) url = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400';
  else if (r.includes('secur') || r.includes('guard') || r.includes('bouncer')) url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400';
  else if (r.includes('danc')) url = 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400';
  else if (r.includes('photo') || r.includes('camera')) url = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400';
  return url + '&auto=format&fit=crop';
};

export default function DashboardScreen() {
  const [tab, setTab] = useState('active'); // active, past
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchApplications();
  }, [user]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // Supabase Join syntax fetching parent gig entity
      const { data, error } = await supabase
        .from('applications')
        .select(`*, gig:gigs(*)`)
        .eq('worker_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusParams = (status) => {
    switch(status) {
      case 'pending': return { label: 'Pending', color: 'bg-orange-100 text-orange-700 border-orange-200' };
      case 'accepted': return { label: 'Accepted', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'completed': return { label: 'Completed', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'no_show': return { label: 'No Show', color: 'bg-red-100 text-red-700 border-red-200' };
      default: return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const filteredApps = apps.filter(app => {
    if (tab === 'active') return ['pending', 'accepted'].includes(app.status);
    return ['completed', 'no_show'].includes(app.status);
  });

  return (
    <div className="pb-24 lg:pb-12 bg-[#111111] min-h-screen pt-4">
      
      {/* Edge to Edge Faded Header */}
      <div className="relative w-full pt-12 pb-24 hero-gradient-overlay flex flex-col items-center justify-center text-center px-4 overflow-hidden mb-6">
        <div className="absolute top-0 right-[20%] w-[250px] h-[250px] floating-glass-rect rotate-12 z-0 hidden lg:block opacity-40"></div>
        
        <h1 className="text-4xl lg:text-5xl font-black text-white mb-3 tracking-tight relative z-10 drop-shadow-md">My Gigs</h1>
        <p className="text-white/60 font-medium text-base lg:text-lg mb-8 max-w-md relative z-10 leading-relaxed">
          Track your ongoing applications and review past events.
        </p>

        {/* Tabs */}
        <div className="flex bg-[#1C1C1C] border border-white/10 p-1.5 rounded-full w-full lg:w-[400px] shadow-lg relative z-10 overflow-x-auto hide-scrollbar">
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
        </div>
      </div>

      <div className="px-4 xl:px-12 w-full mx-auto">
        <div className="w-full lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {loading ? (
            <div className="flex justify-center p-10 col-span-full"><div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div></div>
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
                 <button onClick={() => navigate('/')} className="mt-8 px-8 py-3.5 min-h-[44px] bg-[#F4511E] text-white text-sm font-black tracking-wide rounded-xl shadow-lg hover:bg-[#D84315] transition-colors btn-tap">
                   Browse Live Gigs
                 </button>
               )}
            </div>
          ) : (
            <>
               {filteredApps.map(app => {
                 if (!app.gig) return null;
                 
                 const sParams = getStatusParams(app.status);
                 const totalPay = app.gig.pay_rate * app.gig.duration_hrs;
                 
                 return (
                   <div 
                     key={app.id} 
                     onClick={() => navigate(`/gig/${app.gig.id}`)}
                     className="bg-[#1C1C1C] rounded-2xl p-5 lg:p-6 shadow-sm border border-white/5 flex flex-col btn-tap cursor-pointer group hover:border-[#F4511E]/30 transition-all hover:shadow-md mt-4 lg:mt-0"
                   >
                     <div className="flex justify-between items-start mb-5">
                        <div className="flex pr-4">
                          <img src={getImageUrl(app.gig.role_type)} alt={app.gig.role_type} className="w-12 h-12 rounded-xl object-cover mr-4" />
                          <div>
                            <h3 className="font-black text-white text-lg lg:text-xl leading-tight mb-1">{app.gig.title}</h3>
                            <p className="text-white/50 font-medium text-sm">{app.gig.location_text}</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shadow-sm ${tab === 'active' && app.status === 'accepted' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/10 text-white/70 border-white/20'}`}>
                          {sParams.label}
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-end mt-auto pt-5 border-t border-white/5">
                        <div className="flex items-center text-white/60 text-sm font-bold bg-[#111111] px-3 py-1.5 rounded-lg border border-white/5">
                          <Calendar size={14} className="mr-2 text-[#F4511E]" /> 
                          {formatRelativeDate(app.gig.event_date)}
                        </div>
                        <div className="flex items-center">
                          <span className="font-black text-[#F4511E] text-2xl mr-2 tracking-tight">₹{totalPay}</span>
                          <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center group-hover:bg-[#F4511E]/10 transition-colors border border-white/5 group-hover:border-[#F4511E]/20">
                             <ChevronRight size={16} className="text-white/40 group-hover:text-[#F4511E] transition-colors" />
                          </div>
                        </div>
                     </div>
                   </div>
                 );
               })}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
