import { NavLink } from 'react-router-dom';
import { Briefcase, User, Wallet, Home } from 'lucide-react';

export default function BottomNav() {
  const items = [
    { id: 'home',      icon: Home,     label: 'Home',     path: '/' },
    { id: 'dashboard', icon: Briefcase,label: 'My Gigs',  path: '/dashboard' },
    { id: 'earnings',  icon: Wallet,   label: 'Earnings', path: '/earnings' },
    { id: 'profile',   icon: User,     label: 'Profile',  path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 w-full lg:hidden bg-[#111111] border-t border-white/10 px-6 py-2 pb-safe z-50 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center max-w-2xl mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-all btn-tap ${
                  isActive ? 'text-[#F4511E]' : 'text-white/30 hover:text-white/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-[#F4511E]/15' : 'bg-transparent'}`}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  </div>
                  <span className={`text-[10px] mt-0.5 font-bold`}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
