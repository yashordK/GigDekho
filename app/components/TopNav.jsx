import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import { User, LogOut, Bell, ArrowLeftRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function TopNav() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const activeView = (typeof window !== 'undefined' ? localStorage.getItem('activeView') : null)
    || profile?.role
    || 'worker';
  const isOrganizerView = activeView === 'organizer';

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut();
  };

  const handleLogoClick = () => {
    if (user) {
      navigate(isOrganizerView ? '/organizer/home' : '/worker/home');
    } else {
      navigate('/');
    }
  };

  const handleSwitchView = () => {
    setMenuOpen(false);
    if (isOrganizerView) {
      localStorage.setItem('activeView', 'worker');
      navigate('/worker/home');
    } else {
      localStorage.setItem('activeView', 'organizer');
      navigate('/organizer/home');
    }
  };

  const activeLinkClass  = 'border-b-2 border-[#F4511E] text-white';
  const defaultLinkClass = 'border-b-2 border-transparent text-white/50 hover:text-white';

  return (
    <nav className="fixed top-0 w-full h-[64px] bg-[#111111] border-b border-white/10 z-50 flex items-center">
      <div className="w-full px-6 xl:px-12 flex justify-between items-center">

        {/* Logo */}
        <div
          className="text-[22px] tracking-tight flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        >
          <span className="text-white font-bold">Gig<span className="text-[#F4511E] italic font-black">Dekho</span></span>
        </div>

        {/* Center Nav Links */}
        {user && (
          <div className="hidden lg:flex space-x-8 items-center h-full absolute left-1/2 -translate-x-1/2">
            {isOrganizerView ? (
              <NavLink to="/organizer/home" end className={({ isActive }) =>
                `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
              }>Home</NavLink>
            ) : (
              <>
                <NavLink to="/worker/home" end className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>Home</NavLink>

                <NavLink to="/worker/dashboard" className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>My Gigs</NavLink>

                <NavLink to="/worker/earnings" className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>Earnings</NavLink>
              </>
            )}
          </div>
        )}

        {/* Right: Auth Controls */}
        <div className="flex items-center space-x-3">
          {user ? (
            <>
              {/* Switch Mode — always visible */}
              <button
                type="button"
                onClick={handleSwitchView}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#F4511E] text-[#F4511E] hover:bg-[#F4511E]/10 font-bold text-xs transition-all btn-tap"
              >
                <ArrowLeftRight size={13} />
                {isOrganizerView ? 'Worker Mode' : 'Hirer Mode'}
              </button>

              {/* Notifications */}
              <button className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                <Bell size={18} />
              </button>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-white/10 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F4511E] text-white font-black flex items-center justify-center text-sm shadow-sm">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </div>
                  <span className="text-sm font-bold text-white hidden lg:block">{profile?.full_name?.split(' ')[0] || 'User'}</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#1C1C1C] border border-white/10 shadow-2xl rounded-xl py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-3 border-b border-white/10 mb-1">
                      <p className="text-sm font-black text-white truncate leading-none mb-0.5">{profile?.full_name || 'User'}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                        {isOrganizerView ? 'hirer' : 'worker'} mode · Indore
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); navigate('/worker/profile'); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white flex items-center transition-colors"
                    >
                      <User size={15} className="mr-2 text-[#F4511E]" /> View Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center mt-1 transition-colors"
                    >
                      <LogOut size={15} className="mr-2" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="hidden lg:block text-white/60 hover:text-white font-bold px-4 py-2 text-[13px] tracking-wide transition-colors"
              >
                Hire Professionals
              </button>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-6 py-2 rounded-full shadow-md transition-all text-[13px] tracking-wide"
              >
                Log in / Sign up
              </button>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
