import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useNavigate, Navigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import AuthLeftPanel from '~/components/AuthLeftPanel';
import SkillSelector from '~/components/SkillSelector';

export default function SetupProfileScreen() {
  const [intent] = useState(() => localStorage.getItem('userIntent') || 'worker');
  const [fullName, setFullName] = useState('');
  const [city] = useState('Indore');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const navigate = useNavigate();
  const { user, setProfile, loading: authLoading } = useAuth();

  // Load Google OAuth metadata on mount
  useEffect(() => {
    async function loadGoogleMetadata() {
      try {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        if (supabaseUser) {
          const googleName = supabaseUser?.user_metadata?.full_name ?? "";
          const googleAvatar = supabaseUser?.user_metadata?.avatar_url ?? "";
          if (googleName) {
            setFullName(googleName);
          }
          if (googleAvatar) {
            setAvatarUrl(googleAvatar);
          }
        }
      } catch (err) {
        console.error("Error loading Google metadata:", err);
      }
    }
    if (user) {
      loadGoogleMetadata();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111111]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Upsert Profile
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          city: city,
          email: user.email,
          role: intent,
          avatar_url: avatarUrl || null,
          // Asked once at setup, persisted — never re-asked if "no"
          ...(intent === 'worker' && isStudent !== null
            ? { student_status: isStudent ? 'student_unverified' : 'not_student' }
            : {}),
        })
        .select()
        .single();

      if (profileError) throw profileError;
      
      // 2. Insert Skills
      if (selectedSkills.length > 0) {
        const skillsRows = selectedSkills.map(s => ({
          worker_id: user.id,
          skill: s // Configured to exactly match requested UPSERT constraint target "worker_id,skill"
        }));
        
        const { error: skillsError } = await supabase
          .from('worker_skills')
          .upsert(skillsRows, { onConflict: 'worker_id,skill' });
          
        if (skillsError) throw skillsError;
      }

      setProfile(newProfile);
      
      localStorage.removeItem('userIntent');
      const nextUrl = localStorage.getItem('redirectAfterLogin');
      
      if (nextUrl) {
         localStorage.removeItem('redirectAfterLogin');
         navigate(nextUrl);
      } else {
         navigate(intent === 'organizer' ? '/organizer/home' : '/worker/home');
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:flex bg-[#111111]">

      <AuthLeftPanel />

      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
        <div className="w-full max-w-[480px] bg-[#1C1C1C] p-8 lg:p-10 lg:rounded-3xl rounded-2xl border border-white/10 shadow-xl my-auto">
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-white/5 text-white/60 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4 border border-white/10 shadow-sm">
               Setting up your {intent === 'organizer' ? 'Hirer' : 'Worker'} profile
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Create Profile</h1>
            <p className="text-sm font-medium text-white/50">
               {intent === 'worker' ? "Worker — I want to earn" : "Hirer — I need people"}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium border border-red-500/20">
              {error}
            </div>
          )}

        <form onSubmit={handleCompleteSetup} className="space-y-5">
            <div>
               <label htmlFor="full-name" className="block text-sm font-bold text-white/70 mb-2">Full Name</label>
               <input
                  id="full-name"
                  type="text"
                  placeholder="Rahul Kumar"
                  className="w-full px-4 py-3 min-h-[44px] bg-[#111111] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] focus:ring-1 focus:ring-[#F4511E] font-medium"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
            </div>

            <div>
               <label htmlFor="city-read-only" className="block text-sm font-bold text-white/70 mb-2">City</label>
               <input
                  id="city-read-only"
                  type="text"
                  className="w-full px-4 py-3 min-h-[44px] bg-[#111111]/60 text-white/50 border border-white/5 rounded-xl font-medium cursor-not-allowed"
                  value={city}
                  readOnly
                />
            </div>

            {intent === 'worker' && (
              <>
                <div>
                   <span className="block text-sm font-bold text-white/70 mb-3">Your Skills (Select all that apply)</span>
                   <SkillSelector selected={selectedSkills} onChange={setSelectedSkills} />
                </div>

                <div>
                   <span className="block text-sm font-bold text-white/70 mb-2">Are you a student?</span>
                   <p className="text-xs font-medium text-white/40 mb-3">Students can verify a college ID later to unlock exclusive Perks.</p>
                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => setIsStudent(true)}
                       className={`flex-1 py-2.5 rounded-xl border text-sm font-bold btn-tap transition-colors ${
                         isStudent === true ? 'bg-[#F4511E] border-[#F4511E] text-white' : 'border-white/15 text-white/60 hover:border-[#F4511E]'
                       }`}
                     >
                       Yes 🎓
                     </button>
                     <button
                       type="button"
                       onClick={() => setIsStudent(false)}
                       className={`flex-1 py-2.5 rounded-xl border text-sm font-bold btn-tap transition-colors ${
                         isStudent === false ? 'bg-[#F4511E] border-[#F4511E] text-white' : 'border-white/15 text-white/60 hover:border-[#F4511E]'
                       }`}
                     >
                       No
                     </button>
                   </div>
                </div>
              </>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !fullName}
                className="min-h-[44px] w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-bold text-base hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 btn-tap shadow-sm"
              >
                {loading ? 'Saving...' : (intent === 'worker' ? 'Start Earning' : 'Go to Dashboard')}
              </button>
            </div>
        </form>
        </div>
      </div>
    </div>
  );
}
