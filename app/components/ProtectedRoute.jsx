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

  const isPublicRoute = location.pathname === '/worker/home';

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

  if (loading) return <Spinner />;
  if (isPublicRoute) return children;
  if (!user) return <Spinner />;
  if (!profile?.full_name && location.pathname !== '/setup-profile') return <Spinner />;

  return children;
}
