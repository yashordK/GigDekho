import { useState } from 'react';
import { ShieldCheck, GraduationCap, BadgeCheck, Crown, Building2 } from 'lucide-react';

// Level tier ring colors — progression system, distinct from badges
export const LEVEL_RING: Record<string, { ring: string; label: string; text: string }> = {
  bronze:   { ring: '#CD7F32', label: 'Bronze',   text: 'text-[#CD7F32]' },
  silver:   { ring: '#C0C0C0', label: 'Silver',   text: 'text-[#C0C0C0]' },
  gold:     { ring: '#FFD700', label: 'Gold',     text: 'text-[#FFD700]' },
  platinum: { ring: '#B9F2FF', label: 'Platinum', text: 'text-[#B9F2FF]' },
};

export function levelRing(level?: string | null) {
  return LEVEL_RING[level || 'bronze'] ?? LEVEL_RING.bronze;
}

interface Badge {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  /** 'trust' = accent color; 'recognition' = amber/gold — kept visually distinct */
  kind: 'trust' | 'recognition';
}

export function badgesFor(profile: any, view: 'worker' | 'organizer'): Badge[] {
  if (!profile) return [];
  const badges: Badge[] = [];
  if (profile.id_verified) {
    badges.push({ id: 'id', label: 'ID Verified', icon: <ShieldCheck size={12} />, kind: 'trust',
      tooltip: 'Government ID (Aadhaar) reviewed and approved by GigDekho.' });
  }
  if (view === 'organizer' && profile.business_verified) {
    badges.push({ id: 'business', label: 'Verified Business', icon: <Building2 size={12} />, kind: 'trust',
      tooltip: 'Business registration (GST / shop license) verified — higher trust tier than ID Verified.' });
  }
  if (view === 'worker' && profile.student_status === 'student_verified') {
    badges.push({ id: 'student', label: 'Student Verified', icon: <GraduationCap size={12} />, kind: 'trust',
      tooltip: 'College ID verified — unlocks student-only Perks.' });
  }
  if (view === 'worker' && profile.basics_certified) {
    badges.push({ id: 'basics', label: 'Basics Certified', icon: <BadgeCheck size={12} />, kind: 'trust',
      tooltip: 'Completed the GigDekho Basics training module.' });
  }
  if (profile.campus_ambassador) {
    badges.push({ id: 'ambassador', label: 'Campus Ambassador', icon: <Crown size={12} />, kind: 'recognition',
      tooltip: 'Recognized GigDekho Campus Ambassador — awarded by the GigDekho team.' });
  }
  return badges;
}

/** Row of badge chips under the user's name; tap a chip to reveal its meaning. */
export default function BadgeRow({ profile, view, className = '' }: { profile: any; view: 'worker' | 'organizer'; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const badges = badgesFor(profile, view);
  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap justify-center gap-1.5 ${className}`}>
      {badges.map((b) => (
        <div key={b.id} className="relative">
          <button
            type="button"
            onClick={() => setOpenId(openId === b.id ? null : b.id)}
            aria-expanded={openId === b.id}
            aria-label={`${b.label} badge — tap for details`}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              b.kind === 'trust'
                ? 'bg-[#F4511E]/10 text-[#F4511E] border-[#F4511E]/25 hover:bg-[#F4511E]/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            style={{ minHeight: '26px' }}
          >
            {b.icon} {b.label}
          </button>
          {openId === b.id && (
            <div
              role="tooltip"
              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-52 bg-[#111111] border border-white/15 rounded-xl p-3 text-[11px] font-medium text-white/80 leading-relaxed shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {b.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
