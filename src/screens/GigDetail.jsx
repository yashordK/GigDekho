import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MapPin, Clock, Calendar, Info, CheckCircle2, ShieldAlert, AlertCircle, ShieldCheck, ChevronRight, Users } from 'lucide-react';
import { formatRelativeDate } from '../lib/utils';

const getImageUrl = (role) => {
  const r = (role || '').toLowerCase();
  let url = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200';
  if (r.includes('wait') || r.includes('hostess')) url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200';
  else if (r.includes('sing') || r.includes('vocal')) url = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200';
  else if (r.includes('dj') || r.includes('disc')) url = 'https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=1200';
  else if (r.includes('art') || r.includes('sketch')) url = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200';
  else if (r.includes('secur') || r.includes('guard') || r.includes('bouncer')) url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200';
  else if (r.includes('danc')) url = 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1200';
  else if (r.includes('photo') || r.includes('camera')) url = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1200';
  return url + '&auto=format&fit=crop';
};

export default function GigDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null); 
  const [toastMessage, setToastMessage] = useState('');
  const [isErrorToast, setIsErrorToast] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch gig details
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', id)
        .single();
        
      if (gigError) throw gigError;
      setGig(gigData);

      // 2. Check application status
      if (user) {
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('status')
          .eq('gig_id', id)
          .eq('worker_id', user.id)
          .maybeSingle();

        if (appError && appError.code !== 'PGRST116') throw appError; // PGRST116 is no rows
        if (appData) setApplicationStatus(appData.status);
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong. Try again.', true);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, isError = false) => {
    setToastMessage(msg);
    setIsErrorToast(isError);
    setTimeout(() => {
      setToastMessage('');
      setIsErrorToast(false);
    }, 3000);
  };

  const handleApply = async () => {
    if (!user) {
      localStorage.setItem('redirectAfterLogin', location.pathname);
      navigate('/auth');
      return;
    }

    setApplying(true);
    try {
      // 1. Insert application
      const { error: appError } = await supabase
        .from('applications')
        .insert({
          gig_id: id,
          worker_id: user.id,
          status: 'pending'
        });

      if (appError) throw appError;

      // 2. Increment slots safely using RPC
      const { error: rpcError } = await supabase.rpc('increment_slots_filled', { gig_id: id });
      
      if (rpcError) throw rpcError;
      
      setApplicationStatus('pending');
      
      // Update local gig slot mapping to instantly reflect without refresh
      setGig(prev => ({ ...prev, slots_filled: (prev.slots_filled || 0) + 1 }));
      showToast("Applied! We'll notify you when confirmed.");
      
    } catch (err) {
      console.error('Failed to apply:', err);
      showToast('Something went wrong. Try again.', true);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;
  }

  if (!gig) {
     return <div className="p-6 text-center text-slate-500 font-bold">Gig not found.</div>;
  }

  const payTotal = gig.pay_rate * gig.duration_hrs; 
  const imageUrl = getImageUrl(gig.role_type);
  
  return (
    <div className="bg-background min-h-screen pb-24 font-sans relative pt-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 text-white font-bold py-3 px-5 pt-3.5 pb-3 rounded-full shadow-lg flex items-center text-[13px] animate-bounce ${isErrorToast ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30'}`}>
           {isErrorToast ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
           {toastMessage}
        </div>
      )}

      <div className="bg-background z-40 py-4 px-4 lg:px-8 xl:px-12 w-full mx-auto flex items-center">
         <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase flex items-center">
           Home <ChevronRight size={14} className="inline opacity-50 mx-1"/> 
           Available Jobs <ChevronRight size={14} className="inline opacity-50 mx-1"/> 
           <span className="text-slate-800">{gig.role_type}</span>
         </span>
      </div>

      <div className="px-4 lg:px-8 xl:px-12 pb-8 w-full mx-auto">
        
        {/* Full width hero image */}
        <div className="w-full h-[240px] lg:h-[320px] rounded-3xl overflow-hidden mb-8 lg:mb-10 shadow-sm relative">
           <img src={imageUrl} className="w-full h-full object-cover" alt={gig.role_type} />
           <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
        </div>

        <div className="lg:grid lg:grid-cols-[60%_40%] lg:gap-12 items-start">
           
           <div className="w-full">
              {/* Title Block */}
              <div className="mb-8">
                 {gig.is_urgent && (
                   <div className="bg-cyan-50 text-cyan-600 inline-block px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-cyan-100">
                     URGENT REQUIREMENT
                   </div>
                 )}
                 <h1 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.05] mb-5">{gig.title}</h1>
                 
                 {/* Organizer Row */}
                 <div className="flex items-center space-x-3 mb-6 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm self-start max-w-max">
                   <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold shadow-inner">
                     P
                   </div>
                   <div className="flex flex-col pr-4">
                     <span className="font-bold text-slate-900 text-[13px] flex items-center">
                       Platform Planners <ShieldCheck size={14} className="text-accent ml-1" />
                     </span>
                     <span className="text-[11px] font-semibold text-slate-500">Verified Organizer • 4.9 Rating</span>
                   </div>
                 </div>
              </div>

              {/* 4-Column Info Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-10">
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-default flex flex-col items-start justify-center">
                    <Calendar size={18} className="text-slate-400 mb-2 bg-slate-50 p-1.5 rounded-lg box-content" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Date</p>
                    <p className="font-bold text-slate-900 text-sm leading-tight">{formatRelativeDate(gig.event_date)}</p>
                 </div>
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-default flex flex-col items-start justify-center">
                    <Clock size={18} className="text-[#00BCD4] mb-2 bg-cyan-50 p-1.5 rounded-lg box-content" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</p>
                    <p className="font-bold text-slate-900 text-sm leading-tight">{gig.duration_hrs} Hours</p>
                 </div>
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-default flex flex-col items-start justify-center">
                    <MapPin size={18} className="text-primary mb-2 bg-red-50 p-1.5 rounded-lg box-content" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Location</p>
                    <p className="font-bold text-slate-900 text-sm leading-tight truncate max-w-full">{gig.location_text.split(',')[0]}</p>
                 </div>
                 <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-default flex flex-col items-start justify-center">
                    <Users size={18} className="text-blue-500 mb-2 bg-blue-50 p-1.5 rounded-lg box-content" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Spots</p>
                    <p className="font-bold text-slate-900 text-sm leading-tight">{Math.max(0, gig.slots_total - (gig.slots_filled || 0))} Remaining</p>
                 </div>
              </div>

              {/* Description */}
              <div className="mb-10">
                <h3 className="font-black text-slate-900 text-lg mb-4">Gig Description</h3>
                <div className="text-slate-600 font-medium leading-relaxed space-y-4">
                  {gig.description ? (
                    <p>{gig.description}</p>
                  ) : (
                    <p className="italic opacity-60">This organizer hasn't added a description yet.</p>
                  )}
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="mb-10">
                  <h3 className="font-black text-slate-900 text-lg mb-4">Location Details</h3>
                  <div className="w-full bg-slate-200 rounded-[24px] h-[200px] lg:h-[280px] border-4 border-white shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
                     <div className="absolute inset-0 bg-[#E2E8F0] opacity-50"></div>
                     <div className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full flex items-center shadow-lg transform group-hover:scale-105 transition-transform z-10 border border-slate-200">
                        <MapPin size={20} className="text-primary mr-2" />
                        <span className="text-slate-900 font-bold text-sm tracking-wide">{gig.location_text}</span>
                     </div>
                  </div>
              </div>

           </div>

           {/* Right Column Action Panel */}
           <div className="relative mt-8 lg:mt-0">
             <div className="lg:sticky lg:top-24">
               
               <div className="bg-white rounded-[24px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
                  
                  <div className="p-6 lg:p-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Project Payout</p>
                    <h2 className="text-[44px] font-black text-primary tracking-tight mb-8 leading-none">₹{payTotal}</h2>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-[13px] font-bold text-slate-500">Hourly Rate ({gig.duration_hrs}hrs)</span>
                        <span className="text-[15px] font-bold text-slate-900">₹{gig.pay_rate}/hr</span>
                      </div>
                      <div className="flex justify-between items-center pb-2">
                        <span className="text-[13px] font-bold text-slate-500">Travel Allowance</span>
                        <span className="text-[15px] font-bold text-slate-900">₹0</span>
                      </div>
                    </div>

                    <div className="border border-green-100 bg-green-50 rounded-2xl p-4 flex justify-between items-center mb-2">
                      <span className="text-[13px] font-bold text-slate-900">You receive</span>
                      <span className="text-xl font-black text-accent">₹{payTotal * 0.8}</span>
                    </div>
                    
                    <p className="text-[10px] font-bold text-slate-400 text-right mb-8 pr-1">
                      *Net amount after GigDekho service fee (20%)
                    </p>

                    {applicationStatus === 'pending' || applicationStatus === 'accepted' ? (
                       <button disabled className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed uppercase tracking-wide">
                          <Info size={18} className="mr-2" /> Pending
                       </button>
                    ) : applicationStatus === 'completed' ? (
                       <button disabled className="w-full h-14 rounded-full font-black text-[15px] bg-green-50 text-green-600 border border-green-200 uppercase tracking-wide">
                          Completed
                       </button>
                    ) : (
                       <button 
                         onClick={handleApply}
                         disabled={applying || (gig.slots_total - (gig.slots_filled||0) <= 0)}
                         className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center text-white bg-primary hover:bg-[#00BCD4]/90 transition-all shadow-lg shadow-[#00BCD4]/30 btn-tap disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
                       >
                          {applying ? 'Applying...' : 'Apply Now'}
                       </button>
                    )}
                    
                    <div className="mt-8 space-y-3.5 pt-6 border-t border-slate-100 -mx-2 px-2">
                      <div className="flex items-center text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        <CheckCircle2 size={16} className="text-primary mr-2.5" /> Instant confirmation
                      </div>
                      <div className="flex items-center text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        <CheckCircle2 size={16} className="text-primary mr-2.5" /> 1hr payout after completion
                      </div>
                      <div className="flex items-center text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                        <ShieldCheck size={16} className="text-primary mr-2.5" /> Verified Gig Guarantee
                      </div>
                    </div>

                  </div>
               </div>

               {/* Organizer Reputation */}
               <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Organizer Reputation</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                     <div>
                       <p className="text-xl font-black text-slate-900 mb-0.5">142</p>
                       <p className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">Gigs Hosted</p>
                     </div>
                     <div>
                       <p className="text-xl font-black text-slate-900 mb-0.5">100%</p>
                       <p className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">Payment Rate</p>
                     </div>
                  </div>
                  <button className="text-primary text-[11px] font-bold hover:underline flex items-center transition-all btn-tap">
                    View Organizer Profile <ChevronRight size={14} className="ml-1" />
                  </button>
               </div>

             </div>
           </div>

        </div>
      </div>

    </div>
  );
}
