import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useNavigate, Navigate } from 'react-router';
import { useAuth } from '~/context/AuthContext';
import AuthLeftPanel from '~/components/AuthLeftPanel';

const SKILLS_LIST = ['Waiter', 'Bartender', 'Event Helper', 'Singer', 'Dancer', 'Sketch Artist', 'Photographer', 'DJ', 'Emcee', 'Security'];

export default function SetupProfileScreen() {
  const [intent] = useState(() => localStorage.getItem('userIntent') || 'worker');
  const [fullName, setFullName] = useState('');
  const [city] = useState('Indore');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

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
          avatar_url: avatarUrl || null
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
    <div className="min-h-screen lg:flex bg-background">
      
      <AuthLeftPanel />

      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
        <div className="w-full max-w-[480px] bg-white p-8 lg:p-10 lg:rounded-3xl rounded-2xl border border-slate-100 shadow-sm lg:shadow-xl my-auto">
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-4 border border-slate-200 shadow-sm">
               Setting up your {intent} profile
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Create Profile</h1>
            <p className="text-sm font-medium text-slate-500">
               {intent === 'worker' ? "Let's get you set up to start earning." : "Let's get you set up to host events."}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

        <form onSubmit={handleCompleteSetup} className="space-y-5">
            <div>
               <label htmlFor="full-name" className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
               <input 
                  id="full-name"
                  type="text"
                  placeholder="Rahul Kumar"
                  className="w-full px-4 py-3 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
            </div>

            <div>
               <label htmlFor="city-read-only" className="block text-sm font-bold text-slate-700 mb-2">City</label>
               <input 
                  id="city-read-only"
                  type="text"
                  className="w-full px-4 py-3 min-h-[44px] bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-medium cursor-not-allowed"
                  value={city}
                  readOnly
                />
            </div>

            {intent === 'worker' && (
              <div>
                 <span className="block text-sm font-bold text-slate-700 mb-3">Your Skills (Select all that apply)</span>
                 <div className="flex flex-wrap gap-2">
                   {SKILLS_LIST.map(skill => (
                     <button
                       type="button"
                       key={skill}
                       onClick={() => toggleSkill(skill)}
                       className={`px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-full border text-sm font-bold transition-colors btn-tap ${
                         selectedSkills.includes(skill)
                           ? 'bg-primary border-primary text-white'
                           : 'bg-white border-slate-300 text-slate-600 hover:border-primary hover:text-primary'
                       }`}
                     >
                       {skill}
                     </button>
                   ))}
                 </div>
              </div>
            )}
            
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading || !fullName}
                className="min-h-[44px] w-full py-3.5 bg-urgency text-white rounded-xl font-bold text-base hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 btn-tap shadow-sm"
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
