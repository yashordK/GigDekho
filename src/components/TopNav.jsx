import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronDown, Bell, MapPin, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function TopNav() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut();
  };

  return (
    <nav className="hidden lg:flex fixed top-0 w-full h-[64px] bg-background border-b border-slate-200 z-50 justify-center">
      <div className="w-full px-6 xl:px-12 flex justify-between items-center h-full">
        
        {/* Left Side: Logo */}
        <div className="flex items-center space-x-8">
          <div 
            className="text-[24px] tracking-tight flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
          >
            <span className="text-slate-900 font-bold tracking-tight">Gig<span className="text-primary italic font-black">Dekho</span></span>
          </div>
        </div>

        {/* Center: Links */}
        <div className="flex space-x-8 items-center h-full absolute left-1/2 -translate-x-1/2">
           <NavLink to="/" end className={({ isActive }) => `text-sm flex items-center h-full border-b-[3px] font-bold px-1 transition-all mt-[3px] ${isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
             Home
           </NavLink>
           <NavLink to="/dashboard" className={({ isActive }) => `text-sm flex items-center h-full border-b-[3px] font-bold px-1 transition-all mt-[3px] ${isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
             My Gigs
           </NavLink>
           <NavLink to="/earnings" className={({ isActive }) => `text-sm flex items-center h-full border-b-[3px] font-bold px-1 transition-all mt-[3px] ${isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
             Earnings
           </NavLink>
        </div>

        {/* Right Side: Actions & Profile */}
        <div className="flex items-center space-x-4">
          
          {user ? (
            <>
              <div className="bg-[#E0F7FA] px-4 py-1.5 rounded-full text-[13px] font-black text-[#0097A7] tracking-tight">
                 ₹{((profile?.total_earned || 0) / 100).toLocaleString('en-IN')}
              </div>

              <div className="flex items-center space-x-2 mr-2">
                <div className="relative cursor-pointer p-2 hover:bg-slate-50 rounded-full transition-colors group">
                   <Bell size={18} className="text-slate-500 group-hover:text-slate-900 transition-colors" fill="currentColor" />
                </div>
                
                <div className="relative cursor-pointer p-2 hover:bg-slate-50 rounded-full transition-colors group">
                   <Settings size={18} className="text-slate-500 group-hover:text-slate-900 transition-colors" fill="currentColor" />
                </div>
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                 <button 
                   onClick={() => setMenuOpen(!menuOpen)} 
                   className="flex items-center p-0.5 hover:ring-2 hover:ring-slate-100 rounded-full transition-all"
                 >
                    <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-sm shadow-sm overflow-hidden border border-slate-200">
                      {profile?.full_name?.charAt(0) || 'W'}
                    </div>
                 </button>
                 
                 {menuOpen && (
                   <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 shadow-xl rounded-xl py-2 animate-in fade-in slide-in-from-top-2">
                      <div className="px-4 py-3 border-b border-slate-100 mb-1">
                        <p className="text-sm font-bold text-slate-800 truncate leading-none mb-1">{profile?.full_name || 'Worker'}</p>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Worker View</p>
                      </div>
                      <button 
                        onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary flex items-center"
                      >
                        <User size={16} className="mr-2" /> View Profile
                      </button>
                      <button 
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center mt-1"
                      >
                        <LogOut size={16} className="mr-2" /> Sign Out
                      </button>
                   </div>
                 )}
              </div>
            </>
          ) : (
            <button 
              onClick={() => navigate('/auth')}
              className="bg-primary hover:bg-[#00BCD4]/90 text-white font-bold px-6 py-2 rounded-full shadow-md transition-all text-[13px] tracking-wide"
            >
              Log in / Sign up
            </button>
          )}

        </div>

      </div>
    </nav>
  );
}
