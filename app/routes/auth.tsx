import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { Mail, MailCheck } from 'lucide-react';
import AuthLeftPanel from '~/components/AuthLeftPanel';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // email, waiting
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  console.log("AuthScreen Render:", { user: user?.id, profile: !!profile, authLoading });

  // Handle redirects in a useEffect to prevent render-phase navigation loops
  useEffect(() => {
    console.log("AuthScreen redirect useEffect triggered:", { user: !!user, profile: !!profile, authLoading });
    if (authLoading) return;

    if (user) {
      if (profile?.full_name) {
        console.log("AuthScreen: profile complete, redirecting");
        localStorage.removeItem('userIntent');
        const nextUrl = localStorage.getItem('redirectAfterLogin');
        if (nextUrl) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(nextUrl);
        } else {
          navigate(profile.role === 'organizer' ? '/organizer/home' : '/worker/home');
        }
      } else {
        console.log("AuthScreen: no profile full name, redirecting to setup-profile");
        navigate('/setup-profile');
      }
    }
  }, [user, profile, authLoading, navigate]);

  // Countdown timer for resend — must be above any conditional return to satisfy Rules of Hooks
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleSendLink = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
      });

      if (error) throw error;
      setStep('waiting');
      setCountdown(30);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://gigdekho.com/auth/callback"
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
      setLoading(false);
    }
  };

  const handleManualSessionCheck = async () => {
    setLoading(true);
    setError('');
    
    // Check if the user authorized on a separate device/tab
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Force reload to allow AuthContext to evaluate natively and redirect
      window.location.reload(); 
    } else {
      setLoading(false);
      setError("Still waiting... make sure you're on the same device or try again.");
    }
  };

  return (
    <div className="min-h-screen lg:flex bg-background">
      
      {/* Desktop Left Branding Panel */}
      <AuthLeftPanel />
      
      {/* Right Interaction Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-[480px] bg-white p-8 lg:p-10 lg:rounded-3xl rounded-2xl border border-slate-100 shadow-sm lg:shadow-xl">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-800 mb-2">
              {step === 'email' ? 'Welcome back' : 'Check your email'}
            </h1>
            <p className="text-sm font-medium text-slate-500">
              {step === 'email' 
                ? 'Enter your email to sign in or create an account.' 
                : `We sent a link to ${email} — tap it on this device to sign in`}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100">
              {error}
            </div>
          )}

          {step === 'email' && (
            <>
              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <label htmlFor="email-address" className="sr-only">Email Address</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail size={18} />
                    </span>
                    <input 
                      id="email-address"
                      type="email"
                      placeholder="you@gmail.com"
                      aria-label="Email Address"
                      className="w-full pl-11 pr-4 py-3 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-800 font-medium transition-colors"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading || !email}
                  className={`min-h-[44px] w-full py-3.5 bg-urgency text-white rounded-xl font-bold text-base mt-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all btn-tap ${(!email || loading) ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {loading ? 'Sending link...' : 'Continue'}
                </button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="min-h-[44px] w-full py-3.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-colors btn-tap"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </>
          )}

          {step === 'waiting' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="w-24 h-24 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-6">
                 <MailCheck size={48} />
              </div>

              <div className="hidden lg:block text-slate-500 text-sm font-bold bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg mb-6">
                💡 Opening the link will automatically sign you in.
              </div>
              
              <button 
                onClick={handleSendLink} 
                disabled={loading || countdown > 0}
                className={`min-h-[44px] w-full py-3 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors btn-tap ${countdown > 0 ? 'cursor-not-allowed' : ''}`}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend link'}
              </button>

              <button 
                onClick={handleManualSessionCheck}
                disabled={loading}
                className="mt-4 text-sm font-bold text-primary min-h-[44px] py-1 hover:underline"
              >
                 I opened the link on a different device
              </button>

              <button 
                onClick={() => { setStep('email'); setError(''); }} 
                className="mt-2 text-xs font-bold text-slate-400 py-2 hover:text-slate-600"
              >
                Wrong email?
              </button>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
