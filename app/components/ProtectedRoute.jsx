import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#111111]">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
  </div>
);

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  console.log("ProtectedRoute Render:", { user: user?.id, profile: !!profile, loading, path: location.pathname });

  const isWorkerRoute = location.pathname.startsWith('/worker/');
  const isOrganizerRoute = location.pathname.startsWith('/organizer/');
  const isPublicRoute = location.pathname === '/worker/home';

  useEffect(() => {
    if (loading || isPublicRoute) return;

    if (!user) {
      navigate('/auth', { state: { from: location }, replace: true });
      return;
    }

    if (!profile?.full_name && location.pathname !== '/setup-profile') {
      navigate('/setup-profile', { replace: true });
      return;
    }

    if (profile?.role === 'organizer' && isWorkerRoute) {
      navigate('/organizer/home', { replace: true });
      return;
    }

    if (profile?.role === 'worker' && isOrganizerRoute) {
      navigate('/worker/home', { replace: true });
    }
  }, [loading, user, profile, location, navigate, isWorkerRoute, isOrganizerRoute, isPublicRoute]);

  // Always render a spinner — never null — while a redirect is pending or auth is loading.
  if (loading) return <Spinner />;
  if (isPublicRoute) return children;
  if (!user) return <Spinner />;
  if (!profile?.full_name && location.pathname !== '/setup-profile') return <Spinner />;
  if (profile?.role === 'organizer' && isWorkerRoute) return <Spinner />;
  if (profile?.role === 'worker' && isOrganizerRoute) return <Spinner />;

  return children;
}
