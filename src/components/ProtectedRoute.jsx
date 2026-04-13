import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Authenticated but no profile, redirect to setup
  if (!profile?.full_name && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // Role based access restrictions
  const workerOnlyRoutes = ['/dashboard', '/earnings', '/profile'];
  if (profile?.role === 'organizer' && workerOnlyRoutes.includes(location.pathname)) {
    return <Navigate to="/organizer" replace />;
  }

  if (profile?.role === 'worker' && location.pathname === '/organizer') {
    return <Navigate to="/" replace />;
  }

  return children;
}
