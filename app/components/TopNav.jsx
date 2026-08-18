import { NavLink, useNavigate } from 'react-router';
import { useActiveView, setActiveView } from '~/hooks/useActiveView';
import { useAuth } from '~/context/AuthContext';
import { supabase } from '~/lib/supabase.client';
import { formatRelativeDate } from '~/lib/utils';
import { User, LogOut, Bell, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const STATUS_LABELS = {
  pending: { text: 'Pending', cls: 'text-orange-400' },
  accepted: { text: 'Confirmed', cls: 'text-green-400' },
  completed: { text: 'Completed', cls: 'text-white/60' },
  cancelled: { text: 'Cancelled', cls: 'text-white/40' },
  no_show: { text: 'No Show', cls: 'text-red-400' },
  unread: { text: 'New', cls: 'text-[#F4511E]' },
};

export default function TopNav() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const { isOrganizerView } = useActiveView(profile?.role);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Unread badge for real in-app notifications (announcements, Q&A)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [user]);

  const openNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setMenuOpen(false);
    if (!next || !user) return;
    setNotifLoading(true);
    try {
      // Real notifications first (announcements, Q&A, system)
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, title, body, link, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (notifs && notifs.length > 0) {
        setNotifItems(notifs.map(n => ({
          id: n.id,
          title: n.title,
          subtitle: n.body || new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          status: n.is_read ? null : 'unread',
          onClick: () => { if (n.link) navigate(n.link); },
        })));
        // Mark all as read now that they've been seen
        supabase.from('notifications').update({ is_read: true })
          .eq('user_id', user.id).eq('is_read', false)
          .then(() => setUnreadCount(0));
        return;
      }

      // Fallback: recent application activity
      if (isOrganizerView) {
        // Recent applicants to my gigs
        const { data: myGigs } = await supabase
          .from('gigs')
          .select('id, title')
          .eq('organizer_id', user.id);
        const gigIds = (myGigs || []).map(g => g.id);
        if (gigIds.length === 0) { setNotifItems([]); return; }
        const { data: apps } = await supabase
          .from('applications')
          .select('id, gig_id, status, applied_at, profiles(full_name)')
          .in('gig_id', gigIds)
          .order('applied_at', { ascending: false })
          .limit(5);
        const titleById = Object.fromEntries((myGigs || []).map(g => [g.id, g.title]));
        setNotifItems((apps || []).map(a => ({
          id: a.id,
          title: `${a.profiles?.full_name || 'A worker'} applied`,
          subtitle: titleById[a.gig_id] || 'Your gig',
          status: a.status,
          onClick: () => navigate('/organizer/home'),
        })));
      } else {
        // My recent application updates
        const { data: apps } = await supabase
          .from('applications')
          .select('id, status, applied_at, gig:gigs(id, title, event_date)')
          .eq('worker_id', user.id)
          .order('applied_at', { ascending: false })
          .limit(5);
        setNotifItems((apps || []).filter(a => a.gig).map(a => ({
          id: a.id,
          title: a.gig.title,
          subtitle: formatRelativeDate(a.gig.event_date),
          status: a.status,
          onClick: () => navigate(`/gigs/${a.gig.id}`),
        })));
      }
    } catch (e) {
      console.error('Notifications fetch error:', e);
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  };

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
    const next = isOrganizerView ? 'worker' : 'organizer';
    setActiveView(next);
    navigate(next === 'organizer' ? '/organizer/home' : '/worker/home');
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
              <NavLink prefetch="intent" to="/organizer/home" end className={({ isActive }) =>
                `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
              }>Home</NavLink>
            ) : (
              <>
                <NavLink prefetch="intent" to="/worker/home" end className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>Home</NavLink>

                <NavLink prefetch="intent" to="/worker/dashboard" className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>My Gigs</NavLink>

                <NavLink prefetch="intent" to="/worker/earnings" className={({ isActive }) =>
                  `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
                }>Earnings</NavLink>
              </>
            )}
            <NavLink prefetch="intent" to="/about" className={({ isActive }) =>
              `text-sm font-bold px-1 py-1 transition-all ${isActive ? activeLinkClass : defaultLinkClass}`
            }>About Us</NavLink>
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
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                  onClick={openNotifications}
                  className="relative p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#F4511E] rounded-full animate-pulse border-2 border-[#111111]" aria-label={`${unreadCount} unread notifications`} />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-[#1C1C1C] border border-white/10 shadow-2xl rounded-xl py-2 animate-in fade-in slide-in-from-top-2 z-50">
                    <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/40 font-black border-b border-white/10">
                      {isOrganizerView ? 'Recent Applicants' : 'Your Recent Activity'}
                    </p>
                    {notifLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-white/10 border-t-[#F4511E] rounded-full animate-spin" />
                      </div>
                    ) : notifItems.length === 0 ? (
                      <p className="px-4 py-5 text-xs font-semibold text-white/40">
                        {isOrganizerView
                          ? 'No applicants yet — post a gig to start receiving applications.'
                          : "Nothing here yet — apply to a gig and updates will show up here."}
                      </p>
                    ) : (
                      notifItems.map(item => {
                        const s = item.status ? (STATUS_LABELS[item.status] || { text: item.status, cls: 'text-white/50' }) : null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => { setNotifOpen(false); item.onClick(); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-white truncate">{item.title}</span>
                              <span className="block text-[10px] font-semibold text-white/40 truncate">{item.subtitle}</span>
                            </span>
                            {s && <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider ${s.cls}`}>{s.text}</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

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
                    {profile?.is_admin && (
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); navigate('/admin'); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white flex items-center transition-colors"
                      >
                        <ShieldCheck size={15} className="mr-2 text-[#F4511E]" /> Admin Panel
                      </button>
                    )}
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
                onClick={() => navigate('/about')}
                className="hidden lg:block text-white/60 hover:text-white font-bold px-4 py-2 text-[13px] tracking-wide transition-colors"
              >
                About Us
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="hidden lg:block text-white/60 hover:text-white font-bold px-4 py-2 text-[13px] tracking-wide transition-colors"
              >
                Hire People
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.location.pathname.includes('/worker')) {
                    localStorage.setItem('userIntent', 'worker');
                    navigate('/auth?mode=worker');
                  } else {
                    navigate('/auth');
                  }
                }}
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
