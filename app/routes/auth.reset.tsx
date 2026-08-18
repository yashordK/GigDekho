import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '~/lib/supabase.client';
import { consumeAuthFromUrl } from '~/lib/auth-url';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

type Stage = 'verifying' | 'form' | 'done' | 'invalid';

/**
 * Landing page for the password-recovery email link.
 * Exchanges the recovery code for a session, then lets the user set a new password.
 */
export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [invalidReason, setInvalidReason] = useState(
    'Reset links only work once and expire quickly. Request a fresh one from the sign-in screen.'
  );

  useEffect(() => {
    let settled = false;
    const ready = () => {
      if (settled) return;
      settled = true;
      // Drop the tokens from the address bar via the router. A raw
      // history.replaceState gets overwritten when React Router re-syncs its
      // own history state, which left a live access_token on screen.
      navigate('/auth/reset', { replace: true });
      setStage('form');
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      setInvalidReason(message);
      setStage('invalid');
    };

    // Recovery mails land here with the tokens in the URL hash. The browser
    // client only watches for a PKCE `?code=`, so without this the page waited
    // for a session that was never coming and called a valid link expired.
    consumeAuthFromUrl(supabase).then((res) => {
      if (res.status === 'session') ready();
      else if (res.status === 'error') fail(res.message);
    });

    // PKCE links (and an already-live session) still resolve this way.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) ready();
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) ready();
    });

    const timeout = setTimeout(
      () => fail('That link could not be verified. Reset links are single-use and expire quickly — request a fresh one.'),
      12000
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStage('done');
      setTimeout(() => navigate('/worker/home'), 2500);
    } catch (err: any) {
      setError(err.message || 'Could not update password. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]";

  return (
    <main className="min-h-screen bg-[#111111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
        {/* Brand */}
        <h1 className="text-xl font-bold tracking-tight text-white mb-8">
          Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
        </h1>

        {stage === 'verifying' && (
          <>
            <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/50 text-sm font-medium">Verifying your reset link…</p>
          </>
        )}

        {stage === 'invalid' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-lg font-black text-white mb-2">Link expired or invalid</h2>
            <p className="text-white/50 text-xs font-semibold mb-6">{invalidReason}</p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full h-11 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap transition-colors"
            >
              Back to Sign In
            </button>
          </>
        )}

        {stage === 'form' && (
          <>
            <div className="w-16 h-16 bg-[#F4511E]/10 text-[#F4511E] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F4511E]/20">
              <KeyRound size={28} />
            </div>
            <h2 className="text-lg font-black text-white mb-2">Set a new password</h2>
            <p className="text-white/50 text-xs font-semibold mb-6">Choose something strong — at least 8 characters.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold text-left flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label htmlFor="new-password" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`${inputCls} pr-11`}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
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
              <div>
                <label htmlFor="confirm-password" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={inputCls}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !password || !confirm}
                className="w-full h-11 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        {stage === 'done' && (
          <>
            <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-lg font-black text-white mb-2">Password updated!</h2>
            <p className="text-white/50 text-xs font-semibold">You're signed in — taking you to your dashboard…</p>
          </>
        )}
      </div>
    </main>
  );
}
