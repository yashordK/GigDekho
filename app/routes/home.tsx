import { useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { useEffect } from 'react';
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: "GigDekho — Find Local Short-Term Work in Indore" },
  {
    name: "description",
    content:
      "GigDekho connects people who need short-term help with people who want to earn — for any kind of work, Indore's hyperlocal staffing platform.",
  },
  { property: "og:title", content: "GigDekho — Local Gigs, Real Earnings" },
  {
    property: "og:description",
    content:
      "GigDekho connects people who need short-term help with people who want to earn — for any kind of work, anywhere in the city.",
  },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://gigdekho.com" },
  {
    name: "keywords",
    content:
      "local gig work Indore, staffing Indore, part time work Indore, waiter job, helper, DJ booking Indore, short term work Madhya Pradesh, gig dekho",
  },
];

export default function LandingScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile?.full_name) {
      navigate(profile.role === 'organizer' ? '/organizer/home' : '/worker/home');
    }
  }, [user, profile, navigate]);

  const handleWorkerFlow = () => {
    localStorage.setItem('hasSeenLanding', 'true');
    navigate('/worker/home');
  };

  const handleOrganizerFlow = () => {
    localStorage.setItem('userIntent', 'organizer');
    navigate('/organizer/preview');
  };

  return (
    <main id="main-content" className="h-[100dvh] lg:h-auto lg:min-h-screen font-sans relative flex flex-col lg:flex-row overflow-hidden">

      {/* ── Brand overlay ──────────────────────────────────────── */}
      <div className="absolute top-0 left-0 w-full p-4 lg:p-10 flex flex-col items-center justify-center z-50 pointer-events-none">
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
      <div className="w-full lg:w-1/2 flex-1 min-h-0 lg:flex-none lg:min-h-screen bg-[#1A0800] px-6 py-4 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pt-20 lg:pt-20 overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute bottom-[-60px] right-[-60px] w-[300px] h-[300px] bg-[#F4511E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-14 h-14 lg:w-32 lg:h-32 bg-[#2A1000] rounded-full shadow-inner flex items-center justify-center text-2xl lg:text-6xl mb-3 lg:mb-8 border border-[#F4511E]/20 transform -rotate-6">
          💼
        </div>
        <h2 className="text-3xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-1.5 lg:mb-4">
          Want to earn?
        </h2>
        <p className="text-white/60 font-medium text-sm lg:text-xl lg:max-w-md mb-3 lg:mb-8 leading-relaxed">
          Browse local gigs and get hired today
        </p>

        <button
          onClick={handleWorkerFlow}
          className="w-full max-w-[320px] lg:max-w-[380px] min-h-[48px] lg:min-h-[56px] bg-[#F4511E] hover:bg-[#D84315] text-white font-black text-base lg:text-lg rounded-full shadow-lg hover:shadow-xl hover:shadow-[#F4511E]/30 transition-all btn-tap mb-2 lg:mb-4 mt-1 lg:mt-8"
        >
          Find Work →
        </button>
        <p className="text-white/30 font-bold text-[11px] lg:text-xs">
          Students, freelancers, artists welcome
        </p>
      </div>

      {/* ── Organizer Panel (Right / Bottom) ────────────────────── */}
      <div className="w-full lg:w-1/2 flex-1 min-h-0 lg:flex-none lg:min-h-screen bg-[#111111] px-6 py-4 lg:p-20 flex flex-col justify-center items-center text-center relative z-10 pb-6 lg:pb-20 overflow-hidden">
        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />

        <div className="w-14 h-14 lg:w-32 lg:h-32 bg-[#1C1C1C] rounded-full shadow-inner flex items-center justify-center text-2xl lg:text-6xl mb-3 lg:mb-8 border border-white/10 transform rotate-6 relative z-10">
          🎪
        </div>
        <h2 className="text-3xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-1.5 lg:mb-4 relative z-10">
          Need people?
        </h2>
        <p className="text-white/50 font-medium text-sm lg:text-xl lg:max-w-md mb-3 lg:mb-8 leading-relaxed relative z-10 text-center">
          Post any role, get workers in no time
        </p>

        <button
          onClick={handleOrganizerFlow}
          className="w-full max-w-[320px] lg:max-w-[380px] min-h-[48px] lg:min-h-[56px] bg-transparent border-2 border-white/30 hover:border-white hover:bg-white hover:text-[#111111] text-white font-black text-base lg:text-lg rounded-full transition-all btn-tap mb-2 lg:mb-4 relative z-10 mt-1 lg:mt-8"
        >
          Hire Now →
        </button>
        <p className="text-white/20 font-bold text-[11px] lg:text-xs relative z-10">
          Weddings, clubs, colleges, corporates
        </p>
      </div>

    </main>
  );
}
