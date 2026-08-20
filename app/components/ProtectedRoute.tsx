import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#111111]">
    <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div>
  </div>
);

/**
 * Auth gate.
 *
 * The critical rule here: once the page has been shown, it stays mounted.
 *
 * This used to swap the whole tree for a spinner whenever `loading` was true
 * or `profile` was momentarily absent. Auth state churns constantly — supabase
 * refreshes the token whenever a tab becomes visible again, and each refresh
 * briefly re-ran the profile fetch. On a desktop that is invisible. On a phone
 * it was fatal: returning from the native file picker made the tab visible,
 * which refreshed the token, which unmounted the entire page — destroying the
 * file input holding the file the user had just chosen. The change event never
 * fired, so there was no upload, no error, and nothing in any log, because the
 * component that would have reported it no longer existed.
 *
 * So the spinner is now only for the FIRST resolution of auth. After that,
 * revalidation happens underneath a page that stays put, and we only redirect
 * on a settled signed-out state rather than a transient one.
 */
export default function ProtectedRoute({ children }: { children: any }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublicRoute = location.pathname === '/worker/home';

  // Flips once the gate has been passed, and never flips back.
  const hasRendered = useRef(false);

  useEffect(() => {
    if (loading || isPublicRoute) return;

    if (!user) {
      navigate('/auth', { state: { from: location }, replace: true });
      return;
    }

    if (!profile?.full_name && location.pathname !== '/setup-profile') {
      navigate('/setup-profile', { replace: true });
    }
  }, [loading, user, profile, location, navigate, isPublicRoute]);

  if (isPublicRoute) {
    hasRendered.current = true;
    return children;
  }

  const allowed = !loading && !!user && (!!profile?.full_name || location.pathname === '/setup-profile');

  if (allowed) {
    hasRendered.current = true;
    return children;
  }

  // Already past the gate once — this is revalidation, not a fresh load. Keep
  // the page exactly where it is; anything genuinely wrong is handled by the
  // redirect effect above.
  if (hasRendered.current) return children;

  return <Spinner />;
}
