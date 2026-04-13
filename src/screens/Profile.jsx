import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MapPin, Star, Award, Shield, Lock, X, LogOut, Edit2, Check } from 'lucide-react';

const ALL_SKILLS = ['Waiter', 'Bartender', 'Event Helper', 'Singer', 'Dancer', 'Sketch Artist', 'Photographer', 'DJ', 'Emcee', 'Security'];

const MOCK_TROPHIES = [
  { id: 1, title: 'First Gig', icon: '🌟', date: 'Earned Mar 12' },
  { id: 2, title: '5-Star Streak', icon: '🔥', date: 'Earned Mar 18' },
  { id: 3, title: 'Weekend Hustler', icon: '⚡', date: 'Earned Mar 25' },
];

export default function ProfileScreen() {
  const { user, profile, setProfile, signOut } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ completedGigs: 0, avgRating: 0, totalEarned: 0 });
  const [skills, setSkills] = useState([]);
  const [ratings, setRatings] = useState([]);
  
  // Profile inline edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Modal state
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [tempSkills, setTempSkills] = useState([]);
  const [savingSkills, setSavingSkills] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(profile?.full_name || '');
      setEditCity(profile?.city || 'Indore');
      fetchWorkerData();
    }
  }, [user, profile]);

  const fetchWorkerData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Completed Gigs & Total Earnings
      const { data: appsData, count } = await supabase
        .from('applications')
        .select('*, gig:gigs(*)', { count: 'exact' })
        .eq('worker_id', user.id)
        .eq('status', 'completed');
      
      const completedGigs = count || 0;
      const totalEarned = (appsData || []).reduce((acc, app) => {
         if (!app.gig) return acc;
         return acc + (app.gig.pay_rate * app.gig.duration_hrs);
      }, 0);

      // 2. Fetch Ratings
      const { data: ratingData, error: ratingError } = await supabase
        .from('ratings')
        .select(`
          score,
          comment,
          rater:profiles!ratings_rater_id_fkey(full_name)
        `)
        .eq('ratee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      
      let fetchedRatings = [];
      let avgRating = 0;
      
      if (!ratingError && ratingData) {
        fetchedRatings = ratingData.map(r => ({
          score: r.score,
          comment: r.comment,
          reviewer_name: r.rater?.full_name || 'Verified Organizer'
        }));
        
        if (fetchedRatings.length > 0) {
          avgRating = (fetchedRatings.reduce((acc, r) => acc + r.score, 0) / fetchedRatings.length).toFixed(1);
        }
      }

      // 3. Fetch Skills
      const { data: skillsData } = await supabase
        .from('worker_skills')
        .select('skill')
        .eq('worker_id', user.id);
        
      const fetchedSkills = (skillsData || []).map(s => s.skill);

      setStats({ completedGigs, avgRating, totalEarned });
      setRatings(fetchedRatings);
      setSkills(fetchedSkills);
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
        // First delete removed skills safely
        await supabase
          .from('worker_skills')
          .delete()
          .eq('worker_id', user.id)
          .not('skill', 'in', `(${tempSkills.join(',')})`);
          
        // Then upsert current selection
        const inserts = tempSkills.map(s => ({ worker_id: user.id, skill: s }));
        await supabase
          .from('worker_skills')
          .upsert(inserts, { onConflict: 'worker_id,skill' });
      } else {
        // If entirely empty, just clear all
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

  const handleSaveProfile = async () => {
    if (!editName) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, city: editCity })
        .eq('id', user.id);
      
      if (error) throw error;
      setProfile({ ...profile, full_name: editName, city: editCity });
      setIsEditingProfile(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  // Level Logic
  const gigs = stats.completedGigs;
  let level = 'Beginner';
  let nextLevelGigs = 5;
  let progress = (gigs / 5) * 100;
  let levelColor = 'text-slate-500';

  if (gigs > 30) {
    level = 'Elite';
    nextLevelGigs = gigs;
    progress = 100;
    levelColor = 'text-amber-500';
  } else if (gigs > 15) {
    level = 'Pro';
    nextLevelGigs = 30;
    progress = ((gigs - 15) / 15) * 100;
    levelColor = 'text-accent';
  } else if (gigs > 5) {
    level = 'Intermediate';
    nextLevelGigs = 15;
    progress = ((gigs - 5) / 10) * 100;
    levelColor = 'text-primary';
  }

  const reliability = 97; // Mock
  const relColorClass = reliability > 80 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700';

  if (loading) {
    return <div className="min-h-screen flex justify-center pt-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="pb-24 lg:pb-12 bg-background min-h-screen relative lg:px-12 lg:pt-10 lg:max-w-7xl lg:mx-auto">
      
      {/* 1. Modals Overlay */}
      {showSkillsModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center sm:justify-center animate-in fade-in">
           <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-12 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-4 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-black text-slate-800">Edit Skills</h2>
                 <button onClick={() => setShowSkillsModal(false)} className="p-2 bg-slate-100 text-slate-500 rounded-full btn-tap"><X size={18} /></button>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-8">
                {ALL_SKILLS.map(skill => (
                  <button
                    key={skill}
                    onClick={() => {
                      if (tempSkills.includes(skill)) {
                        setTempSkills(tempSkills.filter(s => s !== skill));
                      } else {
                        setTempSkills([...tempSkills, skill]);
                      }
                    }}
                    className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-bold border btn-tap transition-colors ${
                      tempSkills.includes(skill) 
                        ? 'bg-primary border-primary text-white' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={handleSaveSkills} 
                disabled={savingSkills}
                className="w-full min-h-[44px] py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 btn-tap disabled:opacity-50"
              >
                {savingSkills ? 'Saving...' : 'Confirm Edits'}
              </button>
           </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[30%_70%] lg:gap-10 items-start">
        
        {/* LEFT COLUMN: Identity Block */}
        <div className="w-full lg:sticky lg:top-24 space-y-4 lg:space-y-6 font-sans">
          
          <div className="bg-white lg:rounded-3xl pt-10 pb-6 px-5 border-b lg:border border-slate-100 flex flex-col items-center relative lg:shadow-sm">
            <button 
              onClick={signOut}
              className="absolute top-6 right-5 p-2 text-slate-400 lg:hidden hover:text-red-500 hover:bg-red-50 rounded-full transition-colors btn-tap"
            >
              <LogOut size={20} />
            </button>

            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-black mb-3 shadow-md lg:w-32 lg:h-32 lg:text-5xl lg:mb-5">
              {profile?.full_name?.charAt(0) || 'W'}
            </div>
            
            {isEditingProfile ? (
              <div className="flex flex-col items-center w-full max-w-[250px] mb-3">
                 <input 
                   type="text" 
                   value={editName}
                   onChange={(e) => setEditName(e.target.value)}
                   className="w-full text-center text-lg lg:text-xl font-black text-slate-800 border-b-2 border-primary focus:outline-none mb-2 pb-1 bg-transparent"
                   placeholder="Your Name"
                 />
                 <div className="flex items-center w-full border-b-2 border-primary pb-1 mb-3">
                   <MapPin size={14} className="text-slate-400 mr-2" />
                   <input 
                     type="text" 
                     value={editCity}
                     onChange={(e) => setEditCity(e.target.value)}
                     className="w-full text-sm font-medium text-slate-600 focus:outline-none bg-transparent"
                     placeholder="Your City"
                   />
                 </div>
                 <div className="flex space-x-2">
                   <button onClick={() => setIsEditingProfile(false)} className="px-4 min-h-[44px] rounded-full text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 btn-tap">Cancel</button>
                   <button onClick={handleSaveProfile} disabled={savingProfile} className="px-4 min-h-[44px] rounded-full text-xs font-bold bg-accent text-white shadow-sm flex items-center btn-tap">
                     {savingProfile ? 'Saving...' : <><Check size={16} className="mr-1" /> Save</>}
                   </button>
                 </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl lg:text-3xl font-black text-slate-800 mb-1 lg:mb-2 flex items-center tracking-tight">
                  {profile?.full_name || 'Worker'}
                  <button onClick={() => setIsEditingProfile(true)} className="ml-2 text-slate-300 hover:text-primary btn-tap">
                    <Edit2 size={16} />
                  </button>
                </h1>
                <div className="flex items-center text-slate-500 text-sm lg:text-base font-medium mb-3 lg:mb-5">
                  <MapPin size={16} className="mr-1" /> {profile?.city || 'Indore'}
                </div>
              </>
            )}

            <div className={`px-4 py-1.5 rounded-full text-xs lg:text-sm font-bold ${relColorClass}`}>
              {reliability}% Reliable
            </div>
          </div>

          <div className="px-5 lg:px-0 lg:hidden">
             
          </div>

          {/* Level Block */}
          <div className="mx-5 lg:mx-0 bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-3 lg:mb-4">
                <div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-0.5">Current Status</h3>
                   <div className={`text-xl lg:text-2xl font-black ${levelColor}`}>{level}</div>
                </div>
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 border border-slate-100 shadow-inner">
                   <Award size={24} className="lg:w-8 lg:h-8" />
                </div>
             </div>
             
             <div className="w-full bg-slate-100 rounded-full h-3 lg:h-4 overflow-hidden mb-2">
                <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
             </div>
             <p className="text-xs lg:text-sm font-bold text-slate-400 text-right">
                {nextLevelGigs - gigs} gigs to next level
             </p>
          </div>

        </div>


        {/* RIGHT COLUMN: Data Arrays */}
        <div className="px-5 lg:px-0 mt-6 lg:mt-0 space-y-6 lg:space-y-8">
          
          <div className="hero-gradient-overlay rounded-2xl p-6 lg:p-8 text-white shadow-lg space-y-4">
            <div className="text-cyan-100 text-xs lg:text-sm font-bold uppercase tracking-wider mb-2">Total Earned</div>
            <div className="text-4xl lg:text-6xl font-black mb-5 lg:mb-8 flex items-baseline">
               <span>₹{stats.totalEarned.toLocaleString('en-IN')}</span> 
               <span className="text-sm lg:text-base font-medium text-blue-200 ml-2 lg:ml-4">lifetime</span>
            </div>
            
            <div className="flex justify-between border-t border-white/20 pt-5 lg:pt-6">
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1">{stats.completedGigs}</p>
                 <p className="text-[10px] lg:text-xs text-cyan-200 font-bold uppercase tracking-widest">Gigs Done</p>
               </div>
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1 flex items-center justify-center">
                   {stats.avgRating > 0 ? stats.avgRating : '-'} <Star size={14} className="ml-1 text-amber-300 fill-current" />
                 </p>
                 <p className="text-[10px] lg:text-xs text-cyan-200 font-bold uppercase tracking-widest">Avg Rating</p>
               </div>
               <div className="text-center">
                 <p className="text-xl lg:text-2xl font-black mb-1 text-cyan-100">{'2024'}</p>
                 <p className="text-[10px] lg:text-xs text-cyan-200 font-bold uppercase tracking-widest">Member</p>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 lg:p-8">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
               <h3 className="font-bold text-slate-800 lg:text-xl">My Skills</h3>
               <button 
                 onClick={() => {
                   setTempSkills([...skills]);
                   setShowSkillsModal(true);
                 }} 
                 className="text-primary text-sm font-bold hover:underline btn-tap min-h-[44px] flex items-center"
               >
                 Edit
               </button>
            </div>
            
            {skills.length > 0 ? (
               <div className="flex flex-wrap gap-2 lg:gap-3">
                 {skills.map(skill => (
                   <div key={skill} className="px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-50 text-primary border border-blue-100 rounded-lg text-sm lg:text-base font-bold shadow-sm">
                     {skill}
                   </div>
                 ))}
               </div>
            ) : (
               <div className="text-sm font-medium text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 border-dashed">
                 No skills added yet. Tap edit to select some.
               </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-slate-100 overflow-hidden">
             <h3 className="font-bold text-slate-800 mb-4 lg:mb-6 lg:text-xl">Trophies <span className="text-slate-400 font-medium text-xs ml-2">({MOCK_TROPHIES.length})</span></h3>
             
             <div className="flex space-x-3 overflow-x-auto pb-2 hide-scrollbar">
                {MOCK_TROPHIES.map(trophy => (
                   <div key={trophy.id} className="min-w-[120px] lg:min-w-[150px] bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                      <div className="text-3xl lg:text-4xl mb-3 mt-1 bg-white w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-sm border border-slate-50">
                        {trophy.icon}
                      </div>
                      <p className="font-bold text-slate-800 text-sm leading-tight mb-1">{trophy.title}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{trophy.date}</p>
                   </div>
                ))}
                
                <div className="min-w-[120px] lg:min-w-[150px] bg-white rounded-2xl p-4 border border-slate-200 border-dashed flex flex-col items-center justify-center text-center opacity-70">
                    <div className="text-3xl mb-3 mt-1 text-slate-300 bg-slate-50 w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center shadow-inner">
                      <Lock size={20} />
                    </div>
                    <p className="font-bold text-slate-400 text-sm leading-tight mb-1">Locked</p>
                    <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Do 50 gigs</p>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 lg:p-8 mb-8">
            <div className="flex justify-between items-center mb-4 lg:mb-6">
              <h3 className="font-bold text-slate-800 lg:text-xl">Reviews</h3>
              <div className="flex items-center">
                 <Star size={16} className="text-amber-400 fill-current mr-1" />
                 <span className="font-black text-slate-800">{stats.avgRating > 0 ? stats.avgRating : 'New'}</span>
              </div>
            </div>

            {ratings.length > 0 ? (
              <div className="space-y-4 lg:space-y-6">
                {ratings.map((r, i) => (
                   <div key={i} className="border-b border-slate-50 pb-4 lg:pb-6 last:border-0 last:pb-0">
                      <div className="flex mb-2 text-amber-400">
                        {Array.from({length: r.score}).map((_, idx) => (
                           <Star key={idx} size={14} className="fill-current" />
                        ))}
                      </div>
                      <p className="text-slate-600 font-medium text-sm lg:text-base leading-relaxed mb-3">
                         "{r.comment}"
                      </p>
                      <div className="flex items-center text-xs font-bold text-slate-400">
                         <div className="w-5 h-5 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mr-2">
                            {r.reviewer_name?.charAt(0)}
                         </div>
                         {r.reviewer_name}
                      </div>
                   </div>
                ))}
              </div>
            ) : (
               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 lg:p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-amber-300 shadow-sm mb-3">
                    <Star size={20} />
                  </div>
                  <p className="text-slate-500 font-medium text-sm lg:text-base">No reviews yet. Complete your first gig to get rated.</p>
               </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
