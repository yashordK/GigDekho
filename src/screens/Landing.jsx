import { useNavigate } from 'react-router-dom';
import { Briefcase, Tent } from 'lucide-react';

export default function LandingScreen() {
  const navigate = useNavigate();

  const handleWorkerFlow = () => {
    localStorage.setItem('userIntent', 'worker');
    window.location.reload();
  };

  const handleOrganizerFlow = () => {
    localStorage.setItem('userIntent', 'organizer');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background font-sans relative flex flex-col lg:flex-row overflow-hidden">
      
      {/* Universal Branding overlay on Desktop/Mobile */}
      <div className="absolute top-0 left-0 w-full p-6 lg:p-10 flex flex-col items-center justify-center z-50 pointer-events-none">
         <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 drop-shadow-md">
           Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
         </h1>
         <p className="text-xs font-black uppercase tracking-widest text-slate-500 mt-1 drop-shadow-sm">
           Indore's #1 gig platform
         </p>
      </div>

      {/* Desktop Divider */}
      <div className="hidden lg:flex absolute inset-0 z-40 items-center justify-center pointer-events-none">
         <div className="h-full w-px bg-slate-200/50 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 font-bold text-sm shadow-md border border-slate-100">
               OR
            </div>
         </div>
      </div>

      {/* Worker Panel (Left/Top) */}
      <div className="w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#FDF0E0] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pt-32 lg:pt-20">
         <div className="w-24 h-24 lg:w-32 lg:h-32 bg-white rounded-full shadow-md flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-orange-100 transform -rotate-6">
           💼
         </div>
         <h2 className="text-4xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-4">
           Want to earn?
         </h2>
         <p className="text-slate-600 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed">
           Find gigs at events near you. Get paid the same day.
         </p>
         
         <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-[#F4511E] uppercase">
            <span className="bg-orange-100/50 px-3 py-1.5 rounded-full border border-orange-200/50">500+ workers</span>
            <span className="hidden lg:inline">•</span>
            <span className="bg-orange-100/50 px-3 py-1.5 rounded-full border border-orange-200/50">₹3,000 avg earning</span>
            <span className="hidden lg:inline">•</span>
            <span className="bg-orange-100/50 px-3 py-1.5 rounded-full border border-orange-200/50">1hr payout</span>
         </div>
         
         <button 
           onClick={handleWorkerFlow}
           className="w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-[#F4511E] hover:bg-orange-600 text-white font-black text-base lg:text-lg rounded-full shadow-lg hover:shadow-xl hover:shadow-orange-500/20 transition-all btn-tap mb-4"
         >
           Start Earning →
         </button>
         <p className="text-slate-500 font-bold text-[11px] lg:text-xs">
           Students, freelancers, artists welcome
         </p>
      </div>

      {/* Organizer Panel (Right/Bottom) */}
      <div className="w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#1A1A1A] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pb-20">
         <div className="w-24 h-24 lg:w-32 lg:h-32 bg-slate-800 rounded-full shadow-inner flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-slate-700 transform rotate-6">
           🎪
         </div>
         <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4">
           Hosting an event?
         </h2>
         <p className="text-slate-400 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed">
           Find verified staff and performers instantly. Any role, any scale.
         </p>
         
         <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-slate-300 uppercase">
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">200+ organizers</span>
            <span className="hidden lg:inline">•</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">Verified workers</span>
            <span className="hidden lg:inline">•</span>
            <span className="bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">Instant matching</span>
         </div>
         
         <button 
           onClick={handleOrganizerFlow}
           className="w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-transparent border-2 border-white hover:bg-white hover:text-[#1A1A1A] text-white font-black text-base lg:text-lg rounded-full transition-all btn-tap mb-4 shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
         >
           Post a Gig →
         </button>
         <p className="text-slate-500 font-bold text-[11px] lg:text-xs">
           Weddings, clubs, colleges, corporates
         </p>
      </div>

    </div>
  );
}
