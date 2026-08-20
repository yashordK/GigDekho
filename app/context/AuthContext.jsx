/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase.client';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth state changes.
    //
    // Only a real sign-out clears the user. Supabase emits events constantly —
    // notably a token refresh every time a tab becomes visible again — and
    // some carry a momentarily empty session. Treating those as "signed out"
    // used to blank `user`, which unmounted the whole page under
    // ProtectedRoute. On a phone that happened on the way back from the native
    // file picker, destroying the file input mid-upload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        // Refresh in the background; the existing profile stays on screen so
        // nothing downstream sees a null gap.
        fetchProfile(session.user.id, { keepExisting: true });
      }
      // Any other event without a session is transient — leave state alone.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId, { keepExisting = false } = {}) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      } else if (!keepExisting) {
        // On a background refresh a failed read means the network blipped, not
        // that the profile vanished — clearing it would unmount the page.
        setProfile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
