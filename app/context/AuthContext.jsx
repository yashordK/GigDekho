/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase.client';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log("AuthProvider Render:", { user: user?.id, profile: !!profile, loading });

  useEffect(() => {
    // Restore session on app load
    console.log("AuthProvider mount: fetching session");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("getSession resolved:", { hasSession: !!session });
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("onAuthStateChange fired:", _event, { hasSession: !!session });
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      console.log("AuthProvider unmount: unsubscribing");
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    console.log("fetchProfile called for:", userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      console.log("fetchProfile DB result:", { data, error });
      if (!error && data) {
        setProfile(data);
      } else {
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
