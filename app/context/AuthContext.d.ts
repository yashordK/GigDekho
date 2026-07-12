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
  phone?: string | null;
  email?: string | null;
  avg_rating: number;
  is_verified: boolean;
  avatar_url?: string | null;
  worker_level?: 'bronze' | 'silver' | 'gold' | 'platinum';
  reliability_score?: number;
  total_earned?: number;
  created_at?: string;
  lat?: number | null;
  lng?: number | null;
  // Verification tiers & admin
  is_admin?: boolean;
  is_suspended?: boolean;
  id_verified?: boolean;
  business_verified?: boolean;
  basics_certified?: boolean;
  campus_ambassador?: boolean;
  student_status?: 'unknown' | 'not_student' | 'student_unverified' | 'student_verified';
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
