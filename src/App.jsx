import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function MainLayout() {
  const location = useLocation();
  const hideBottomNav = location.pathname.startsWith('/auth') || location.pathname.startsWith('/setup') || location.pathname.startsWith('/gig/');
  const hideTopNav = location.pathname.startsWith('/auth') || location.pathname.startsWith('/setup');

  return (
    <div className="bg-background min-h-screen relative w-full font-sans pb-24 lg:pb-0">
      {!hideTopNav && <div className="hidden lg:block pt-[64px] z-50 relative border-b"><TopNav /></div>}
      <div className={`${!hideTopNav ? 'lg:h-[calc(100vh-64px)]' : 'lg:h-screen'} lg:overflow-y-auto hide-scrollbar relative w-full`}>
        <Outlet />
      </div>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}

function IndexRoute() {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/>
      </div>
    );
  }
  
  if (!user) {
    const intent = localStorage.getItem('userIntent');
    if (intent === 'worker') return <HomeScreen />;
    return <LandingScreen />;
  }
  
  if (profile?.role === 'organizer') return <OrganizerHomeScreen />;
  
  return <HomeScreen />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthScreen />} />
          
          <Route element={<MainLayout />}>
            <Route path="/setup" element={
              <ProtectedRoute>
                <SetupProfileScreen />
              </ProtectedRoute>
            } />
            <Route path="/" element={<IndexRoute />} />
            <Route path="/organizer" element={
              <ProtectedRoute>
                <OrganizerHomeScreen />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardScreen />
              </ProtectedRoute>
            } />
            <Route path="/gig/:id" element={<GigDetailScreen />} />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfileScreen />
              </ProtectedRoute>
            } />
            <Route path="/earnings" element={
              <ProtectedRoute>
                <EarningsScreen />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
