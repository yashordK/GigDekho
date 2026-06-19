import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { Mail, MailCheck, X, ChevronLeft, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultIntent?: 'worker' | 'organizer';
}

export default function AuthModal({ isOpen, onClose, defaultIntent = 'worker' }: AuthModalProps) {
  const [intent, setIntent] = useState<'worker' | 'organizer'>(defaultIntent);
  const [authMethod, setAuthMethod] = useState<'options' | 'email' | 'waiting'>('options');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuth();

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setIntent(defaultIntent);
      setAuthMethod('options');
      setEmail('');
      setError('');
      setCountdown(0);
      setLoading(false);
    }
  }, [isOpen, defaultIntent]);

  // Countdown timer for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Redirect if logged in
  useEffect(() => {
    if (user && isOpen) {
      const checkRoleAndRedirect = async () => {
        if (profile) {
          if (!profile.full_name) {
            navigate('/setup-profile');
          } else {
            // If they signed in, redirect to correct home
            navigate(profile.role === 'organizer' ? '/organizer/home' : '/worker/home');
          }
          if (onClose) onClose();
        }
      };
      checkRoleAndRedirect();
    }
  }, [user, profile, isOpen, navigate, onClose]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      // Check intent to set in user metadata or local storage if needed
      localStorage.setItem('userIntent', intent);
      
      // Store starting origin to restore it in callback if Supabase redirects to a different domain/protocol
      if (typeof window !== 'undefined') {
        localStorage.setItem('authOrigin', window.location.origin);
      }

      let redirectTo = `${window.location.origin}/auth/callback`;
      if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        redirectTo = redirectTo.replace('http://', 'https://');
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google OAuth error:", err);
      setError(err.message || 'Failed to authenticate with Google.');
      setLoading(false);
    }
  };

  const handleSendLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      localStorage.setItem('userIntent', intent);
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
      });

      if (error) throw error;
      setAuthMethod('waiting');
      setCountdown(30);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSessionCheck = async () => {
    setLoading(true);
    setError('');
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      window.location.reload(); 
    } else {
      setLoading(false);
      setError("Still waiting... make sure you're on the same device or try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop (clickable to dismiss, only if onClose is provided) */}
      <div 
        className={`absolute inset-0 bg-[#111111]/85 backdrop-blur-[4px] ${onClose ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (onClose) onClose();
        }}
      />
      
      {/* Auth Card Box */}
      <div className="relative bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-sm shadow-2xl z-10 animate-in zoom-in duration-300">
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap"
          >
            <X size={18} />
          </button>
        )}

        {/* Back Button */}
        {authMethod !== 'options' && (
          <button
            onClick={() => {
              if (authMethod === 'waiting') {
                setAuthMethod('email');
              } else {
                setAuthMethod('options');
              }
              setError('');
            }}
            className="absolute top-4 left-4 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Emoji & Header */}
        <div className="text-center mb-6 mt-2">
          {authMethod === 'waiting' ? (
            <div className="w-16 h-16 bg-[#F4511E]/10 text-[#F4511E] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F4511E]/20 shadow-sm animate-bounce">
              <MailCheck size={28} />
            </div>
          ) : (
            <span className="text-4xl mb-3 block">
              {intent === 'organizer' ? '🎪' : '💼'}
            </span>
          )}

          <h2 className="text-xl font-black text-white tracking-tight mb-2">
            {authMethod === 'waiting' 
              ? 'Check your email' 
              : intent === 'organizer' 
                ? 'Ready to hire local staff?' 
                : 'Ready to start earning?'}
          </h2>
          <p className="text-white/50 text-xs font-semibold leading-relaxed">
            {authMethod === 'waiting'
              ? `We sent a link to ${email} — tap it on this device to sign in.`
              : intent === 'organizer'
                ? 'Post a gig in 2 minutes. Workers apply instantly.'
                : 'Browse local gigs in Indore. Get paid the same day.'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Render Options Panel */}
        {authMethod === 'options' && (
          <div className="space-y-4">
            {/* Benefits list */}
            <div className="space-y-2.5 bg-[#111111]/45 p-4 rounded-2xl border border-white/5 text-left">
              {(intent === 'organizer'
                ? [
                    "Post any role — waiters, DJs, coordinators",
                    "Workers apply within minutes",
                    "Pay securely after the event",
                  ]
                : [
                    "Dozens of gigs posted daily in Indore",
                    "FCFS auto-accept — apply and work",
                    "Instant payouts directly to your account",
                  ]
              ).map((benefit) => (
                <div key={benefit} className="flex items-start gap-2.5 text-xs font-bold text-white/80">
                  <span className="text-[#F4511E] font-black shrink-0">✓</span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Google sign in button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 
                         font-semibold py-3 px-4 rounded-xl hover:bg-gray-100 
                         transition-all min-h-[44px] shadow-md btn-tap cursor-pointer text-sm disabled:opacity-50"
            >
              <img src="/google-icon.svg" alt="" width={18} height={18} className="shrink-0" />
              Continue with Google
            </button>

            {/* Email option */}
            <button
              onClick={() => setAuthMethod('email')}
              className="w-full py-3 px-4 rounded-xl border border-white/20 
                         text-white font-bold hover:border-[#F4511E] hover:text-[#F4511E]
                         transition-all min-h-[44px] text-sm btn-tap cursor-pointer bg-transparent"
            >
              Sign up with Email
            </button>

            {/* Toggle Intent link */}
            <div className="border-t border-white/5 pt-3 text-center">
              <button
                onClick={() => setIntent(intent === 'organizer' ? 'worker' : 'organizer')}
                className="text-white/40 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                {intent === 'organizer' 
                  ? 'Looking for work? Sign up as a Worker →' 
                  : 'Need to hire staff? Sign up as an Organizer →'}
              </button>
            </div>
          </div>
        )}

        {/* Render Email Form */}
        {authMethod === 'email' && (
          <form onSubmit={handleSendLink} className="space-y-4 text-left">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[11px] font-black text-white/60 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-[#F4511E] text-white rounded-xl font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {loading ? 'Sending link...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Render Waiting State */}
        {authMethod === 'waiting' && (
          <div className="space-y-4">
            <div className="hidden lg:block text-white/40 text-[11px] font-bold bg-[#111111]/30 border border-white/5 px-3 py-2 rounded-xl text-center">
              💡 Opening the link will automatically sign you in.
            </div>
            
            <button 
              onClick={handleSendLink} 
              disabled={loading || countdown > 0}
              className="w-full h-11 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-colors btn-tap disabled:opacity-50 cursor-pointer"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend link'}
            </button>

            <button 
              onClick={handleManualSessionCheck}
              disabled={loading}
              className="w-full text-center text-xs font-bold text-[#F4511E] py-1 hover:underline cursor-pointer bg-transparent border-0"
            >
              I opened the link on a different device
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
