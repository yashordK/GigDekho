import { BrowserRouter, Routes, Route, Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';

// Screens
import AuthScreen from './screens/Auth';
import SetupProfileScreen from './screens/SetupProfile';
import HomeScreen from './screens/Home';
import LandingScreen from './screens/Landing';
import OrganizerHomeScreen from './screens/OrganizerHome';
import GigDetailScreen from './screens/GigDetail';
import DashboardScreen from './screens/Dashboard';
import ProfileScreen from './screens/Profile';
import EarningsScreen from './screens/Earnings';

import BottomNav from './components/BottomNav';
import TopNav from './components/TopNav';
import Footer from './components/Footer';

// Scrolls to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function MainLayout() {
  const location = useLocation();
  const { user } = useAuth();

  const isLanding  = (location.pathname === '/' && !user) || location.pathname === '/landing';
  const isAuth     = location.pathname.startsWith('/auth') || location.pathname.startsWith('/setup');
  const isGigDetail = location.pathname.startsWith('/gig/');

  const hideTopNav    = isLanding || isAuth;
  const hideBottomNav = isLanding || isAuth || isGigDetail;
  const hideFooter    = isAuth;

  return (
    <div className="bg-[#111111] min-h-screen relative w-full font-sans">
      {!hideTopNav && <TopNav />}
      <div className={`${!hideTopNav ? 'pt-[64px]' : ''} min-h-screen`}>
        <Outlet />
      </div>
      {!hideFooter && <Footer />}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

function IndexRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F4511E]"/>
      </div>
    );
  }

  // Not logged in → always show Landing (ignore old userIntent)
  if (!user) return <LandingScreen />;

  // Logged in → route by role
  if (profile?.role === 'organizer') return <OrganizerHomeScreen />;
  return <HomeScreen />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Auth screens (no layout) */}
          <Route path="/auth" element={<AuthScreen />} />

          {/* Landing accessible without auth (no role selected yet) */}
          <Route path="/landing" element={<LandingScreen />} />

          <Route element={<MainLayout />}>
            <Route path="/setup" element={
              <ProtectedRoute><SetupProfileScreen /></ProtectedRoute>
            } />
            <Route path="/" element={<IndexRoute />} />
            <Route path="/organizer" element={
              <ProtectedRoute><OrganizerHomeScreen /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute><DashboardScreen /></ProtectedRoute>
            } />
            <Route path="/gig/:id" element={<GigDetailScreen />} />
            <Route path="/profile" element={
              <ProtectedRoute><ProfileScreen /></ProtectedRoute>
            } />
            <Route path="/earnings" element={
              <ProtectedRoute><EarningsScreen /></ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
