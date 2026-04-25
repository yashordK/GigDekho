import { useNavigate } from 'react-router-dom';

export default function LandingScreen() {
  const navigate = useNavigate();

  const handleWorkerFlow = () => {
    // Clear any stale intent so landing always shows fresh
    localStorage.removeItem('userIntent');
    navigate('/auth');
  };

  const handleOrganizerFlow = () => {
    localStorage.setItem('userIntent', 'organizer');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen font-sans relative flex flex-col lg:flex-row overflow-hidden">

      {/* ── Brand overlay ──────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full p-6 lg:p-10 flex flex-col items-center justify-center z-50 pointer-events-none">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight drop-shadow-md" style={{ color: '#F5F5F5' }}>
          Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
        </h1>
        <p className="text-xs font-black uppercase tracking-widest mt-1 drop-shadow-sm" style={{ color: 'rgba(245,245,245,0.5)' }}>
          Indore's #1 gig platform
        </p>
      </div>

      {/* ── Desktop Divider ─────────────────────────────────────── */}
      <div className="hidden lg:flex absolute inset-0 z-40 items-center justify-center pointer-events-none">
        <div className="h-full w-px bg-white/10 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-[#1C1C1C] rounded-full flex items-center justify-center text-white/40 font-bold text-sm shadow-md border border-white/10">
            OR
          </div>
        </div>
      </div>

      {/* ── Worker Panel (Left / Top) ────────────────────────────── */}
      <div className="w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#1A0800] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pt-32 lg:pt-20 overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] bg-[#F4511E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-24 h-24 lg:w-32 lg:h-32 bg-[#2A1000] rounded-full shadow-inner flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-[#F4511E]/20 transform -rotate-6">
          💼
        </div>
        <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4">
          Want to earn?
        </h2>
        <p className="text-white/60 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed">
          Find gigs at events near you. Get paid the same day.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-[#F4511E] uppercase">
          <span className="bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20">500+ workers</span>
          <span className="hidden lg:inline text-white/20">•</span>
          <span className="bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20">₹3,000 avg earning</span>
          <span className="hidden lg:inline text-white/20">•</span>
          <span className="bg-[#F4511E]/10 px-3 py-1.5 rounded-full border border-[#F4511E]/20">1hr payout</span>
        </div>

        <button
          onClick={handleWorkerFlow}
          className="w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-[#F4511E] hover:bg-[#D84315] text-white font-black text-base lg:text-lg rounded-full shadow-lg hover:shadow-xl hover:shadow-[#F4511E]/30 transition-all btn-tap mb-4"
        >
          Start Earning →
        </button>
        <p className="text-white/30 font-bold text-[11px] lg:text-xs">
          Students, freelancers, artists welcome
        </p>
      </div>

      {/* ── Organizer Panel (Right / Bottom) ────────────────────── */}
      <div className="w-full lg:w-1/2 min-h-[50vh] lg:min-h-screen bg-[#111111] p-8 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pb-20 overflow-hidden">
        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />

        <div className="w-24 h-24 lg:w-32 lg:h-32 bg-[#1C1C1C] rounded-full shadow-inner flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-white/10 transform rotate-6 relative z-10">
          🎪
        </div>
        <h2 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4 relative z-10">
          Hosting an event?
        </h2>
        <p className="text-white/50 font-medium text-lg lg:text-xl lg:max-w-md mb-8 leading-relaxed relative z-10">
          Find verified staff and performers instantly. Any role, any scale.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-3 mb-10 text-[11px] lg:text-xs font-black tracking-widest text-white/40 uppercase relative z-10">
          <span className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10">200+ organizers</span>
          <span className="hidden lg:inline">•</span>
          <span className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10">Verified workers</span>
          <span className="hidden lg:inline">•</span>
          <span className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10">Instant matching</span>
        </div>

        <button
          onClick={handleOrganizerFlow}
          className="w-full max-w-[320px] lg:max-w-[380px] min-h-[56px] bg-transparent border-2 border-white/30 hover:border-white hover:bg-white hover:text-[#111111] text-white font-black text-base lg:text-lg rounded-full transition-all btn-tap mb-4 relative z-10"
        >
          Post a Gig →
        </button>
        <p className="text-white/20 font-bold text-[11px] lg:text-xs relative z-10">
          Weddings, clubs, colleges, corporates
        </p>
      </div>

    </div>
  );
}
