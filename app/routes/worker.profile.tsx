import { useState, useEffect, useRef } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useAuth } from '~/context/AuthContext';
import { MapPin, Star, Award, Lock, X, LogOut, Edit2, Camera, Check, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router';
import BadgeRow, { levelRing } from '~/components/BadgeRow';
import VerificationPanel from '~/components/VerificationPanel';
import EditProfileModal from '~/components/EditProfileModal';
import SkillSelector from '~/components/SkillSelector';

// Badges tied to real milestones — computed from live stats, never faked
function computeTrophies(completedGigs: number, hasFiveStar: boolean) {
  const earned: { id: string; title: string; icon: string; hint: string }[] = [];
  if (completedGigs >= 1) earned.push({ id: 'first', title: 'First Gig', icon: '🌟', hint: 'Completed your first gig' });
  if (hasFiveStar) earned.push({ id: '5star', title: '5-Star Rated', icon: '🔥', hint: 'Earned a 5-star review' });
  if (completedGigs >= 5) earned.push({ id: 'five', title: 'Rising Star', icon: '⚡', hint: '5 gigs completed' });
  if (completedGigs >= 15) earned.push({ id: 'fifteen', title: 'Pro Hustler', icon: '🏆', hint: '15 gigs completed' });
  if (completedGigs >= 30) earned.push({ id: 'thirty', title: 'Elite', icon: '👑', hint: '30 gigs completed' });

  let locked: { title: string; hint: string } | null = null;
  if (completedGigs < 1) locked = { title: 'First Gig', hint: 'Complete 1 gig' };
  else if (completedGigs < 5) locked = { title: 'Rising Star', hint: `${5 - completedGigs} more gigs` };
  else if (completedGigs < 15) locked = { title: 'Pro Hustler', hint: `${15 - completedGigs} more gigs` };
  else if (completedGigs < 30) locked = { title: 'Elite', hint: `${30 - completedGigs} more gigs` };

  return { earned, locked };
}

// Level tier from completed gigs (progression system, distinct from badges)
function tierFor(gigs: number) {
  if (gigs > 30) return { level: 'platinum', next: null as number | null, prev: 30 };
  if (gigs > 15) return { level: 'gold', next: 30, prev: 15 };
  if (gigs > 5) return { level: 'silver', next: 15, prev: 5 };
  return { level: 'bronze', next: 5, prev: 0 };
}

export default function ProfileScreen() {
  const { user, profile, setProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Render by ACTIVE VIEW (what the navs use), not the DB role — fixes the
  // "switched to worker but still sees hirer profile" bug.
  const activeView = (typeof window !== 'undefined' ? localStorage.getItem('activeView') : null)
    || profile?.role
    || 'worker';
  const isOrganizerView = activeView === 'organizer';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ completedGigs: 0, avgRating: 0, totalEarned: 0 });
  const [skills, setSkills] = useState<string[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [hasFiveStar, setHasFiveStar] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchView = (toOrganizer: boolean) => {
    localStorage.setItem('activeView', toOrganizer ? 'organizer' : 'worker');
    navigate(toOrganizer ? '/organizer/home' : '/worker/home');
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user, isOrganizerView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isOrganizerView) {
        const { data: gigsData, count: gigsCount } = await supabase
          .from('gigs')
          .select('*, gig_payments(*)', { count: 'exact' })
          .eq('organizer_id', user.id);

        const completedGigs = gigsCount || 0;
        const totalEarned = (gigsData || []).reduce((acc, gig) => {
          const pay = Array.isArray(gig.gig_payments) ? gig.gig_payments[0] : gig.gig_payments;
          return pay && pay.final_paid ? acc + (pay.organizer_total || 0) : acc;
        }, 0);

        setStats({ completedGigs, avgRating: profile?.avg_rating || 0, totalEarned });
        setSkills([]);
        setRatings([]);
        return;
      }

      // Worker view
      const { data: appsData, count } = await supabase
        .from('applications')
        .select('*, gig:gigs(*)', { count: 'exact' })
        .eq('worker_id', user.id)
        .eq('status', 'completed');

      const completedGigs = count || 0;
      const totalEarned = (appsData || []).reduce((acc, app) =>
        app.gig ? acc + app.gig.pay_rate * app.gig.duration_hrs : acc, 0);

      const { data: ratingData } = await supabase
        .from('ratings')
        .select(`score, comment, rater:profiles!ratings_rater_id_fkey(full_name)`)
        .eq('ratee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const fetchedRatings = (ratingData || []).map(r => ({
        score: r.score,
        comment: r.comment,
        reviewer_name: (Array.isArray(r.rater) ? r.rater[0]?.full_name : (r.rater as any)?.full_name) || 'Verified Hirer',
      }));

      let avgRating: any = profile?.avg_rating || 0;
      if (!avgRating && fetchedRatings.length > 0) {
        avgRating = (fetchedRatings.reduce((acc, r) => acc + r.score, 0) / fetchedRatings.length).toFixed(1);
      }

      const { data: skillsData } = await supabase
        .from('worker_skills')
        .select('skill')
        .eq('worker_id', user.id);

      const { count: fiveStarCount } = await supabase
        .from('ratings')
        .select('id', { count: 'exact', head: true })
        .eq('ratee_id', user.id)
        .eq('score', 5);

      setHasFiveStar((fiveStarCount || 0) > 0);
      setStats({ completedGigs, avgRating, totalEarned });
      setRatings(fetchedRatings);
      setSkills((skillsData || []).map(s => s.skill));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSkills = async () => {
    setSavingSkills(true);
    try {
      if (tempSkills.length > 0) {
        const quotedList = `(${tempSkills.map(s => `"${s.replace(/"/g, '')}"`).join(',')})`;
        await supabase.from('worker_skills').delete().eq('worker_id', user.id).not('skill', 'in', quotedList);
        const inserts = tempSkills.map(s => ({ worker_id: user.id, skill: s }));
        await supabase.from('worker_skills').upsert(inserts, { onConflict: 'worker_id,skill' });
      } else {
        await supabase.from('worker_skills').delete().eq('worker_id', user.id);
      }
      setSkills(tempSkills);
      setShowSkillsModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSkills(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (file.size > 3 * 1024 * 1024) return;
    setUploadingAvatar(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatar_url = pub.publicUrl;
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url }).eq('id', user.id);
      if (updErr) throw updErr;
      setProfile((prev: any) => ({ ...prev, avatar_url }));
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const setStudentStatus = async (isStudent: boolean) => {
    setSavingStudent(true);
    try {
      const student_status = isStudent ? 'student_unverified' : 'not_student';
      await supabase.from('profiles').update({ student_status }).eq('id', user.id);
      setProfile((prev: any) => ({ ...prev, student_status }));
    } catch (err) {
      console.error(err);
    } finally {
      setSavingStudent(false);
    }
  };

  // Level tier + ring
  const gigs = stats.completedGigs;
  const tier = tierFor(gigs);
  const ring = levelRing(isOrganizerView ? null : tier.level);
  const progress = tier.next ? ((gigs - tier.prev) / (tier.next - tier.prev)) * 100 : 100;

  const reliability = profile?.reliability_score ?? 100;

  // Verification doc types per view
  const docTypes = isOrganizerView
    ? ['aadhaar', 'gst', 'shop_license']
    : ['aadhaar', ...(profile?.student_status === 'student_unverified' || profile?.student_status === 'student_verified' ? ['student_id'] : [])];

  if (loading) {
    return <div className="min-h-screen flex justify-center pt-20 bg-[#111111]"><div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="pb-24 lg:pb-12 bg-[#111111] min-h-screen relative lg:px-12 lg:pt-10 lg:max-w-7xl lg:mx-auto pt-16">

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        profile={profile}
        isOrganizerView={isOrganizerView}
        onSaved={(updates) => setProfile((prev: any) => ({ ...prev, ...updates }))}
      />

      {/* Skills Modal — grouped taxonomy */}
      {showSkillsModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center sm:justify-center animate-in fade-in p-0 sm:p-4">
           <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[88dvh] flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-black text-white">Edit Skills</h2>
                 <button type="button" aria-label="Close" onClick={() => setShowSkillsModal(false)} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar mb-5 -mx-1 px-1">
                <SkillSelector selected={tempSkills} onChange={setTempSkills} />
              </div>

              <button
                type="button"
                onClick={handleSaveSkills}
                disabled={savingSkills}
                className="w-full min-h-[44px] py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 btn-tap disabled:opacity-50 transition-colors"
              >
                {savingSkills ? 'Saving...' : `Save ${tempSkills.length} Skill${tempSkills.length !== 1 ? 's' : ''}`}
              </button>
           </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[32%_68%] lg:gap-10 items-start">

        {/* LEFT COLUMN: Identity Block */}
        <div className="w-full lg:sticky lg:top-24 space-y-4 lg:space-y-6 font-sans">

          <div className="bg-[#1C1C1C] lg:rounded-3xl pt-10 pb-6 px-5 border-b lg:border border-white/5 flex flex-col items-center relative lg:shadow-sm">
            <button
              type="button"
              aria-label="Sign out"
              onClick={signOut}
              className="absolute top-6 right-5 p-2 text-white/40 lg:hidden hover:text-[#F4511E] hover:bg-[#F4511E]/10 rounded-full transition-colors btn-tap"
            >
              <LogOut size={20} />
            </button>

            {/* Avatar with level-tier ring + upload */}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" aria-hidden="true" onChange={handleAvatarFile} />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Change profile picture"
              className="relative group mb-3 lg:mb-5 rounded-full btn-tap"
              style={!isOrganizerView ? { padding: '4px', background: `conic-gradient(${ring.ring}, ${ring.ring}66, ${ring.ring})`, borderRadius: '9999px' } : { padding: '4px' }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile?.full_name || 'Profile photo'} className="w-20 h-20 lg:w-32 lg:h-32 rounded-full object-cover shadow-md block" />
              ) : (
                <div className="w-20 h-20 bg-[#F4511E] rounded-full flex items-center justify-center text-white text-3xl font-black shadow-md lg:w-32 lg:h-32 lg:text-5xl">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-7 h-7 lg:w-9 lg:h-9 bg-[#111111] border border-white/20 rounded-full flex items-center justify-center text-white/70 group-hover:text-[#F4511E] transition-colors shadow-lg">
                {uploadingAvatar
                  ? <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-[#F4511E] rounded-full animate-spin" />
                  : <Camera size={14} />}
              </span>
            </button>

            {!isOrganizerView && (
              <span className={`text-[10px] font-black uppercase tracking-widest mb-2 ${ring.text}`}>
                {ring.label} Tier
              </span>
            )}

            <h1 className="text-xl lg:text-3xl font-black text-white mb-1 flex items-center tracking-tight">
              {profile?.full_name || 'User'}
              <button type="button" aria-label="Edit profile" onClick={() => setShowEditModal(true)} className="ml-2 text-white/40 hover:text-[#F4511E] btn-tap min-h-0" style={{ minHeight: '32px' }}>
                <Edit2 size={16} />
              </button>
            </h1>

            {/* Badge chips under the name */}
            <BadgeRow profile={profile} view={isOrganizerView ? 'organizer' : 'worker'} className="mb-3" />

            <div className="flex items-center text-white/50 text-sm lg:text-base font-medium mb-3">
              <MapPin size={16} className="mr-1" /> {profile?.city || 'Indore'}
            </div>

            {profile?.bio && (
              <p className="text-xs font-medium text-white/50 text-center leading-relaxed mb-3 max-w-[260px]">{profile.bio}</p>
            )}

            {isOrganizerView ? (
              <div className="px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] text-center">
                {stats.completedGigs === 0 ? "Post a gig to build reputation" : (stats.avgRating > 0 ? `${Number(stats.avgRating).toFixed(1)} Avg Rating` : 'New Hirer')}
              </div>
            ) : (
              <div className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold text-center ${
                stats.completedGigs === 0
                  ? 'bg-white/5 border border-white/10 text-white/50'
                  : (reliability > 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20')
              }`}>
                {stats.completedGigs === 0 ? "Work a gig to get a reliability score" : `${reliability}% Reliable`}
              </div>
            )}
          </div>

          {/* Level Block (worker only) */}
          {!isOrganizerView && (
            <div className="mx-5 lg:mx-0 bg-[#1C1C1C] rounded-2xl p-5 lg:p-8 shadow-sm border border-white/5">
               <div className="flex justify-between items-center mb-3 lg:mb-4">
                  <div>
                     <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-0.5">Level Tier</h3>
                     <div className={`text-xl lg:text-2xl font-black ${ring.text}`}>{ring.label}</div>
                  </div>
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white/5 rounded-full flex items-center justify-center border shadow-inner" style={{ borderColor: `${ring.ring}55`, color: ring.ring }}>
                     <Award size={24} className="lg:w-8 lg:h-8" />
                  </div>
               </div>

               <div className="w-full bg-[#111111] rounded-full h-3 lg:h-4 overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, progress)}%`, background: ring.ring }}></div>
               </div>
               <p className="text-xs lg:text-sm font-bold text-white/40 text-right">
                  {tier.next ? `${tier.next - gigs} gigs to ${levelRing(tier.level === 'bronze' ? 'silver' : tier.level === 'silver' ? 'gold' : 'platinum').label}` : 'Top tier reached'}
               </p>
            </div>
          )}

          {/* Student question — asked once, persisted (worker only) */}
          {!isOrganizerView && profile?.student_status === 'unknown' && (
            <div className="mx-5 lg:mx-0 bg-[#1C1C1C] rounded-2xl p-5 border border-white/5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap size={16} className="text-[#F4511E]" />
                <h3 className="font-bold text-white text-sm">Are you a student?</h3>
              </div>
              <p className="text-xs font-medium text-white/50 mb-4">Students can verify a college ID to unlock exclusive Perks.</p>
              <div className="flex gap-2">
                <button type="button" disabled={savingStudent} onClick={() => setStudentStatus(true)}
                  className="flex-1 py-2.5 rounded-xl bg-[#F4511E] text-white text-xs font-black btn-tap hover:bg-[#D84315] transition-colors disabled:opacity-50">
                  Yes, I'm a student
                </button>
                <button type="button" disabled={savingStudent} onClick={() => setStudentStatus(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs font-bold btn-tap hover:text-white transition-colors disabled:opacity-50">
                  No
                </button>
              </div>
            </div>
          )}

          {/* Perks ladder (worker only) */}
          {!isOrganizerView && (
            <div className="mx-5 lg:mx-0 bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
               <details className="group">
                  <summary className="font-bold text-white p-5 cursor-pointer flex justify-between items-center list-none outline-none">
                    Benefits you can unlock
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24" className="text-white/50"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </span>
                  </summary>
                  <div className="p-5 border-t border-white/5 space-y-4">
                     {/* Persistent (non-popup) student-verification nudge inside Perks */}
                     {profile?.student_status === 'student_unverified' && (
                       <div className="bg-[#F4511E]/5 border border-[#F4511E]/20 rounded-xl p-3.5 flex items-start gap-3">
                         <GraduationCap size={16} className="text-[#F4511E] shrink-0 mt-0.5" />
                         <div>
                           <p className="text-xs font-bold text-white">Student Perks are waiting</p>
                           <p className="text-[11px] text-white/50 font-medium">Upload your college ID in the Verification section to unlock student-only discounts.</p>
                         </div>
                       </div>
                     )}
                     <div className="flex items-start">
                       <div className="w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center mr-3 shrink-0"><Check size={14} /></div>
                       <div><p className="text-sm font-bold text-white">Basic Access</p><p className="text-xs text-white/50">Unlocked at 0 gigs.</p></div>
                     </div>
                     <div className="flex items-start">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 5 ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>{gigs >= 5 ? <Check size={14} /> : <Lock size={14} />}</div>
                       <div><p className={`text-sm font-bold ${gigs >= 5 ? 'text-white' : 'text-white/60'}`}>Premium Gigs</p><p className="text-xs text-white/50">Unlock exclusive high-paying gigs at 5 gigs.</p></div>
                     </div>
                     <div className="flex items-start">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 15 ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>{gigs >= 15 ? <Check size={14} /> : <Lock size={14} />}</div>
                       <div><p className={`text-sm font-bold ${gigs >= 15 ? 'text-white' : 'text-white/60'}`}>Cash Bonus</p><p className="text-xs text-white/50">Earn a ₹500 bonus upon completing 15 gigs.</p></div>
                     </div>
                     <div className="flex items-start">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 shrink-0 ${gigs >= 30 ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'}`}>{gigs >= 30 ? <Check size={14} /> : <Lock size={14} />}</div>
                       <div><p className={`text-sm font-bold ${gigs >= 30 ? 'text-white' : 'text-white/60'}`}>Top Tier Pro</p><p className="text-xs text-white/50">Priority selection & voucher rewards at 30 gigs.</p></div>
                     </div>
                  </div>
               </details>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN */}
        <div className="px-5 lg:px-0 mt-6 lg:mt-0 space-y-6 lg:space-y-8">

          <div className="hero-gradient-overlay rounded-2xl p-6 lg:p-8 text-white shadow-lg space-y-4 border border-white/10">
            <div className="text-white/60 text-xs lg:text-sm font-bold uppercase tracking-wider mb-2">
              {isOrganizerView ? 'Total Spent' : 'Total Earned'}
            </div>
            <div className="text-4xl lg:text-6xl font-black mb-5 lg:mb-8 flex items-baseline">
               <span>₹{stats.totalEarned.toLocaleString('en-IN')}</span>
               <span className="text-sm lg:text-base font-medium text-[#F4511E] ml-2 lg:ml-4">lifetime</span>
            </div>

            <div className="flex justify-between border-t border-white/20 pt-5 lg:pt-6">
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1">{stats.completedGigs}</p>
                 <p className="text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest">
                   {isOrganizerView ? 'Gigs Hosted' : 'Gigs Done'}
                 </p>
               </div>
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1 flex items-center justify-center">
                   {stats.avgRating > 0 ? stats.avgRating : '-'} <Star size={14} className="ml-1 text-amber-400 fill-current" />
                 </p>
                 <p className="text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest">Avg Rating</p>
               </div>
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1 text-white/80">
                   {profile?.created_at ? new Date(profile.created_at).getFullYear() : '—'}
                 </p>
                 <p className="text-[10px] lg:text-xs text-white/50 font-bold uppercase tracking-widest">Member</p>
               </div>
            </div>
          </div>

          {/* Verification — upload docs from the profile */}
          {user && <VerificationPanel userId={user.id} docTypes={docTypes} />}

          {!isOrganizerView ? (
            <>
              <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8">
                <div className="flex justify-between items-center mb-4 lg:mb-6">
                   <h3 className="font-bold text-white lg:text-xl">My Skills</h3>
                   <button
                     type="button"
                     onClick={() => {
                       setTempSkills([...skills]);
                       setShowSkillsModal(true);
                     }}
                     className="text-[#F4511E] text-sm font-bold hover:underline btn-tap min-h-[44px] flex items-center"
                   >
                     Edit
                   </button>
                </div>

                {skills.length > 0 ? (
                   <div className="flex flex-wrap gap-2 lg:gap-3">
                     {skills.map(skill => (
                       <div key={skill} className="px-3 py-1.5 lg:px-4 lg:py-2 bg-[#111111] text-white/80 border border-white/10 rounded-lg text-sm lg:text-base font-bold shadow-sm">
                         {skill}
                       </div>
                     ))}
                   </div>
                ) : (
                   <div className="text-sm font-medium text-white/40 bg-[#111111] p-4 rounded-xl border border-white/5 border-dashed">
                     No skills added yet. Tap edit to select some — you'll be discoverable across every category you pick.
                   </div>
                )}
              </div>

              {(() => {
                const { earned: trophies, locked: lockedTrophy } = computeTrophies(stats.completedGigs, hasFiveStar);
                return (
                  <div className="bg-[#1C1C1C] rounded-2xl p-5 lg:p-8 shadow-sm border border-white/5 overflow-hidden">
                    <h3 className="font-bold text-white mb-4 lg:mb-6 lg:text-xl">Trophies <span className="text-white/40 font-medium text-xs ml-2">({trophies.length})</span></h3>

                    <div className="flex space-x-3 overflow-x-auto pb-2 hide-scrollbar">
                      {trophies.map(trophy => (
                        <div key={trophy.id} className="min-w-[120px] lg:min-w-[150px] bg-[#111111] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                          <div className="text-3xl lg:text-4xl mb-3 mt-1 bg-[#1C1C1C] w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-sm border border-white/5">
                            {trophy.icon}
                          </div>
                          <p className="font-bold text-white text-sm leading-tight mb-1">{trophy.title}</p>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{trophy.hint}</p>
                        </div>
                      ))}

                      {lockedTrophy && (
                        <div className="min-w-[120px] lg:min-w-[150px] bg-[#1C1C1C] rounded-2xl p-4 border border-white/10 border-dashed flex flex-col items-center justify-center text-center opacity-70">
                          <div className="text-3xl mb-3 mt-1 text-white/30 bg-[#111111] w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-inner">
                            <Lock size={20} />
                          </div>
                          <p className="font-bold text-white/40 text-sm leading-tight mb-1">{lockedTrophy.title}</p>
                          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">{lockedTrophy.hint}</p>
                        </div>
                      )}
                    </div>

                    {trophies.length === 0 && (
                      <p className="text-xs font-medium text-white/40 mt-3">
                        Complete your first gig to start earning badges — your next milestone is shown above.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8 mb-8">
                <div className="flex justify-between items-center mb-4 lg:mb-6">
                  <h3 className="font-bold text-white lg:text-xl">Reviews</h3>
                  <div className="flex items-center">
                     <Star size={16} className="text-amber-400 fill-current mr-1" />
                     <span className="font-black text-white">{stats.avgRating > 0 ? stats.avgRating : 'New'}</span>
                  </div>
                </div>

                {ratings.length > 0 ? (
                  <div className="space-y-4 lg:space-y-6">
                    {ratings.map((r, i) => (
                       <div key={i} className="border-b border-white/5 pb-4 lg:pb-6 last:border-0 last:pb-0">
                          <div className="flex mb-2 text-amber-400">
                            {Array.from({length: r.score}).map((_, idx) => (
                               <Star key={idx} size={14} className="fill-current" />
                            ))}
                          </div>
                          <p className="text-white/80 font-medium text-sm lg:text-base leading-relaxed mb-3">
                             "{r.comment}"
                          </p>
                          <div className="flex items-center text-xs font-bold text-white/50">
                             <div className="w-5 h-5 bg-white/10 text-white/60 rounded-full flex items-center justify-center mr-2">
                                {r.reviewer_name?.charAt(0)}
                             </div>
                             {r.reviewer_name}
                          </div>
                       </div>
                    ))}
                  </div>
                ) : (
                   <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 lg:p-10 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-amber-400 shadow-sm mb-3">
                        <Star size={20} />
                      </div>
                      <p className="text-white/50 font-medium text-sm lg:text-base">No reviews yet. Complete your first gig to get rated.</p>
                   </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8 space-y-4 mb-8">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-white lg:text-xl">Hirer Profile Info</h3>
                <button type="button" onClick={() => setShowEditModal(true)} className="text-[#F4511E] text-sm font-bold hover:underline btn-tap min-h-[44px] flex items-center">Edit</button>
              </div>
              <div className="space-y-3 text-sm text-left">
                <div>
                  <span className="text-white/40 font-bold block uppercase text-[10px] tracking-wider mb-0.5">Company / Agency</span>
                  <span className="text-white font-semibold">{profile?.company_name || 'Individual Hirer'}</span>
                </div>
                {profile?.website && (
                  <div>
                    <span className="text-white/40 font-bold block uppercase text-[10px] tracking-wider mb-0.5">Website</span>
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-[#F4511E] font-semibold hover:underline">{profile.website}</a>
                  </div>
                )}
                <div>
                  <span className="text-white/40 font-bold block uppercase text-[10px] tracking-wider mb-0.5">Bio / Description</span>
                  <p className="text-white/70 font-medium leading-relaxed">{profile?.bio || 'This hirer has not added a bio yet.'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Switch view — mirrors the TopNav toggle, no DB role mutation */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3 mb-8 text-left">
            <h3 className="font-semibold text-white">
              {isOrganizerView ? 'Want to work gigs?' : 'Need to hire someone?'}
            </h3>
            <p className="text-white/50 text-xs font-semibold leading-relaxed">
              {isOrganizerView
                ? 'Switch to Worker Mode to browse and apply to gigs. You can switch back anytime.'
                : 'Switch to Hirer Mode to post gigs and find workers. You can switch back anytime.'}
            </p>
            <button
              onClick={() => handleSwitchView(!isOrganizerView)}
              className="btn-tap w-full py-3 rounded-xl border border-[#F4511E]
                         text-[#F4511E] font-semibold hover:bg-[#F4511E]/10 transition-all cursor-pointer text-sm"
            >
              {isOrganizerView ? 'Switch to Worker Mode' : 'Switch to Hirer Mode'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
