import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, MailCheck } from 'lucide-react';
import AuthLeftPanel from '../components/AuthLeftPanel';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // email, waiting
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  // Redirect if session exists natively
  if (user && profile?.full_name) {
    // If they logged into an existing profile, any intent to sign up is stale and should be cleared.
    localStorage.removeItem('userIntent');
    
    const nextUrl = localStorage.getItem('redirectAfterLogin');
    if (nextUrl) {
      localStorage.removeItem('redirectAfterLogin');
      navigate(nextUrl);
    } else {
      navigate(profile.role === 'organizer' ? '/organizer' : '/');
    }
    return null;
  }
  
  if (user && !profile?.full_name) {
    navigate('/setup');
    return null;
  }

  // Handle countdown rendering for Resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

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
            <form onSubmit={handleSendLink} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail size={18} />
                  </span>
                  <input 
                    type="email"
                    placeholder="you@gmail.com"
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
