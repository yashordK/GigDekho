import { useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { useEffect, useState } from 'react';
import AuthModal from '~/components/AuthModal';

export default function AuthScreen() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [intent, setIntent] = useState<'worker' | 'organizer'>('worker');

  useEffect(() => {
    // Detect if we redirected with a mode parameter
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "organizer") {
      setIntent("organizer");
    } else {
      const savedIntent = localStorage.getItem("userIntent");
      if (savedIntent === "organizer") {
        setIntent("organizer");
      }
    }
  }, []);

  // Handle redirects in useEffect if already authenticated
  useEffect(() => {
    if (authLoading) return;
    if (user && profile) {
      if (!profile.full_name) {
        navigate('/setup-profile');
      } else {
        const lastView = localStorage.getItem('activeView');
        if (lastView === 'organizer') {
          navigate('/organizer/home');
        } else if (lastView === 'worker') {
          navigate('/worker/home');
        } else {
          navigate(profile.role === 'organizer' ? '/organizer/home' : '/worker/home');
        }
      }
    }
  }, [user, profile, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#111111] overflow-hidden flex flex-col font-sans">
      {/* Background decoration matching landing screen */}
      <div className="absolute top-0 left-0 w-full p-6 lg:p-10 flex flex-col items-center justify-center z-0 opacity-40">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
          Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
        </h1>
        <p className="text-xs font-black uppercase tracking-widest mt-1 text-white/40">
          Indore's #1 gig platform
        </p>
      </div>

      <div className="absolute top-[20%] left-[-10%] w-[300px] h-[300px] bg-[#F4511E]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl pointer-events-none" />

      {/* Auth Modal centered in full-screen view. Dismissing it goes to landing page */}
      <AuthModal 
        isOpen={true} 
        onClose={() => navigate('/')} 
        defaultIntent={intent} 
      />
    </div>
  );
}
