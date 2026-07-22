import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { SignupErrorState } from "@/lib/auth";

export type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  neon_account_id: string | null;
  member_status: string | null;
  points: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (args: { email: string; password: string }) => Promise<{ error: string | null }>;
  signUp: (args: {
    email: string;
    password: string;
    displayName?: string;
    username?: string;
  }) => Promise<{
    error: string | null;
    errorKind?: SignupErrorState;
  }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
