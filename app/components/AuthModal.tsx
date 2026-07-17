import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { MailCheck, X, ChevronLeft, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultIntent?: 'worker' | 'organizer';
}

type AuthMethod = 'options' | 'password' | 'magic' | 'waiting' | 'confirm-sent' | 'forgot' | 'forgot-sent';

export default function AuthModal({ isOpen, onClose, defaultIntent = 'worker' }: AuthModalProps) {
  const [intent, setIntent] = useState<'worker' | 'organizer'>(defaultIntent);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('options');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setIntent(defaultIntent);
      setAuthMethod('options');
      setIsSignUp(false);
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setError('');
      setCountdown(0);
      setLoading(false);
    }
  }, [isOpen, defaultIntent]);

  // Countdown timer for resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Redirect if logged in
  useEffect(() => {
    if (user && isOpen && profile) {
      if (!profile.full_name) {
        navigate('/setup-profile');
      } else {
        const lastView = localStorage.getItem('activeView');
        if (lastView === 'organizer') navigate('/organizer/home');
        else if (lastView === 'worker') navigate('/worker/home');
        else navigate(profile.role === 'organizer' ? '/organizer/home' : '/worker/home');
      }
      if (onClose) onClose();
    }
  }, [user, profile, isOpen, navigate, onClose]);

  if (!isOpen) return null;

  const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      localStorage.setItem('userIntent', intent);

      let redirectTo = `${redirectBase}/auth/callback`;
      if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
        redirectTo = redirectTo.replace('http://', 'https://');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, queryParams: { access_type: "offline" } },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google OAuth error:", err);
      setError(err.message || 'Failed to authenticate with Google.');
      setLoading(false);
    }
  };

  // ── Email + password ─────────────────────────────────────────────
  const handlePasswordAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('userIntent', intent);

      if (isSignUp) {
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${redirectBase}/auth/callback` },
        });
        if (error) throw error;
        // If email confirmation is enabled, there's no session yet
        if (!data.session) {
          setAuthMethod('confirm-sent');
          return;
        }
        // Session immediately available — the redirect effect takes over
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes('invalid login')) {
            throw new Error('Wrong email or password. If you signed up with Google or a magic link, use that instead — or reset your password below.');
          }
          throw error;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ──────────────────────────────────────────────
  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectBase}/auth/reset`,
      });
      if (error) throw error;
      setAuthMethod('forgot-sent');
      setCountdown(30);
    } catch (err: any) {
      setError(err.message || 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Magic link ───────────────────────────────────────────────────
  const handleSendLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('userIntent', intent);
      const { error } = await supabase.auth.signInWithOtp({ email });
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

  const inputCls = "w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/5 text-white text-sm font-semibold placeholder:text-white/30 focus-visible:outline-[#F4511E] focus-visible:outline-2";

  const headerCopy = () => {
    switch (authMethod) {
      case 'waiting': return { title: 'Check your email', sub: `We sent a link to ${email} — tap it on this device to sign in.` };
      case 'confirm-sent': return { title: 'Confirm your email', sub: `We sent a confirmation link to ${email}. Tap it to activate your account, then sign in.` };
      case 'forgot': return { title: 'Reset your password', sub: "Enter your email and we'll send you a secure reset link." };
      case 'forgot-sent': return { title: 'Reset link sent', sub: `Check ${email} for a link to set a new password.` };
      default:
        return intent === 'organizer'
          ? { title: 'Ready to find people for your work?', sub: 'Post a gig in 2 minutes. Workers apply instantly.' }
          : { title: 'Ready to start earning?', sub: 'Browse local gigs in Indore. Get paid the same day.' };
    }
  };
  const { title, sub } = headerCopy();
  const showMailIcon = ['waiting', 'confirm-sent', 'forgot-sent'].includes(authMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className={`absolute inset-0 bg-[#111111]/85 backdrop-blur-[4px] ${onClose ? 'cursor-pointer' : ''}`}
        onClick={() => { if (onClose) onClose(); }}
      />

      <div className="relative bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-sm shadow-2xl z-10 animate-in zoom-in duration-300">

        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap"
          >
            <X size={18} />
          </button>
        )}

        {authMethod !== 'options' && (
          <button
            onClick={() => {
              if (authMethod === 'waiting') setAuthMethod('magic');
              else if (authMethod === 'forgot' || authMethod === 'forgot-sent' || authMethod === 'confirm-sent') setAuthMethod('password');
              else setAuthMethod('options');
              setError('');
            }}
            aria-label="Go back"
            className="absolute top-4 left-4 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors btn-tap"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6 mt-2">
          {showMailIcon ? (
            <div className="w-16 h-16 bg-[#F4511E]/10 text-[#F4511E] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F4511E]/20 shadow-sm animate-bounce">
              <MailCheck size={28} />
            </div>
          ) : authMethod === 'forgot' ? (
            <div className="w-16 h-16 bg-[#F4511E]/10 text-[#F4511E] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F4511E]/20 shadow-sm">
              <KeyRound size={28} />
            </div>
          ) : (
            <span className="text-4xl mb-3 block">
              {intent === 'organizer' ? '🎪' : '💼'}
            </span>
          )}

          <h2 className="text-xl font-black text-white tracking-tight mb-2">{title}</h2>
          <p className="text-white/50 text-xs font-semibold leading-relaxed">{sub}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-in fade-in duration-200">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Options ── */}
        {authMethod === 'options' && (
          <div className="space-y-4">
            <div className="space-y-2.5 bg-[#111111]/45 p-4 rounded-2xl border border-white/5 text-left">
              {(intent === 'organizer'
                ? [
                    "Post any role — waiters, DJs, promoters, helpers",
                    "Workers apply within minutes",
                    "Pay securely, earnings go to worker wallets",
                  ]
                : [
                    "Dozens of gigs posted daily in Indore",
                    "FCFS auto-accept — apply and work",
                    "Paid to your wallet within 24 hours",
                  ]
              ).map((benefit) => (
                <div key={benefit} className="flex items-start gap-2.5 text-xs font-bold text-white/80">
                  <span className="text-[#F4511E] font-black shrink-0">✓</span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

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

            <button
              onClick={() => { setAuthMethod('password'); setIsSignUp(false); setError(''); }}
              className="w-full py-3 px-4 rounded-xl border border-white/20
                         text-white font-bold hover:border-[#F4511E] hover:text-[#F4511E]
                         transition-all min-h-[44px] text-sm btn-tap cursor-pointer bg-transparent"
            >
              Continue with Email & Password
            </button>

            <button
              onClick={() => { setAuthMethod('magic'); setError(''); }}
              className="w-full text-center text-xs font-bold text-white/40 hover:text-white py-1 transition-colors cursor-pointer bg-transparent border-0"
            >
              Or get a magic sign-in link instead →
            </button>

            <div className="border-t border-white/5 pt-3 text-center">
              <button
                onClick={() => setIntent(intent === 'organizer' ? 'worker' : 'organizer')}
                className="text-white/40 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                {intent === 'organizer'
                  ? 'Looking for work? Sign up as a Worker →'
                  : 'Need to hire someone? Sign up as a Hirer →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Email + Password ── */}
        {authMethod === 'password' && (
          <form onSubmit={handlePasswordAuth} className="space-y-4 text-left">
            {/* Sign in / Sign up toggle */}
            <div className="flex bg-[#111111] border border-white/5 p-1 rounded-full">
              <button type="button" onClick={() => { setIsSignUp(false); setError(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-full transition-all btn-tap min-h-0 ${!isSignUp ? 'bg-[#F4511E] text-white' : 'text-white/50'}`} style={{ minHeight: '36px' }}>
                Sign In
              </button>
              <button type="button" onClick={() => { setIsSignUp(true); setError(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-full transition-all btn-tap min-h-0 ${isSignUp ? 'bg-[#F4511E] text-white' : 'text-white/50'}`} style={{ minHeight: '36px' }}>
                Create Account
              </button>
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="auth-email" className="text-[11px] font-black text-white/60 uppercase tracking-wider">Email Address</label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label htmlFor="auth-password" className="text-[11px] font-black text-white/60 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pr-11`}
                  required
                  minLength={isSignUp ? 8 : undefined}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-white/40 hover:text-white transition-colors min-h-0"
                  style={{ minHeight: '36px' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-11 bg-[#F4511E] text-white rounded-xl font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={() => { setAuthMethod('forgot'); setError(''); }}
                className="w-full text-center text-xs font-bold text-[#F4511E] py-1 hover:underline cursor-pointer bg-transparent border-0"
              >
                Forgot your password?
              </button>
            )}
          </form>
        )}

        {/* ── Forgot password ── */}
        {authMethod === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="forgot-email" className="text-[11px] font-black text-white/60 uppercase tracking-wider">Email Address</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-[#F4511E] text-white rounded-xl font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* ── Forgot sent ── */}
        {authMethod === 'forgot-sent' && (
          <button
            onClick={handleForgotPassword}
            disabled={loading || countdown > 0}
            className="w-full h-11 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-colors btn-tap disabled:opacity-50 cursor-pointer"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend reset link'}
          </button>
        )}

        {/* ── Confirm-email sent (after password sign-up) ── */}
        {authMethod === 'confirm-sent' && (
          <button
            onClick={() => { setAuthMethod('password'); setIsSignUp(false); setError(''); }}
            className="w-full h-11 bg-white/5 text-white border border-white/10 rounded-xl font-bold text-xs hover:bg-white/10 transition-colors btn-tap cursor-pointer"
          >
            I've confirmed — back to sign in
          </button>
        )}

        {/* ── Magic link form ── */}
        {authMethod === 'magic' && (
          <form onSubmit={handleSendLink} className="space-y-4 text-left">
            <div className="flex flex-col space-y-1.5">
              <label htmlFor="magic-email" className="text-[11px] font-black text-white/60 uppercase tracking-wider">Email Address</label>
              <input
                id="magic-email"
                type="email"
                placeholder="you@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full h-11 bg-[#F4511E] text-white rounded-xl font-black text-sm hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {loading ? 'Sending link...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        {/* ── Waiting for magic link ── */}
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
