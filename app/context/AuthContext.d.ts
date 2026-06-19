import { ReactNode, Dispatch, SetStateAction } from 'react';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  role: 'worker' | 'organizer';
  full_name: string;
  company_name?: string;
  website?: string;
  bio?: string;
  city?: string;
  avg_rating: number;
  is_verified: boolean;
  avatar_url?: string | null;
}

export interface AuthContextType {
  user: any;
  profile: Profile | null;
  setProfile: Dispatch<SetStateAction<any>>;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthProvider: (props: { children: ReactNode }) => JSX.Element;
export const useAuth: () => AuthContextType;
