import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  points: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (args: { email: string; password: string }) => Promise<{ error: string | null }>;
  signUp: (args: { email: string; password: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

const PROFILE_FIELDS =
  "id, username, full_name, avatar_url, bio, points, created_at, updated_at";

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const initialiseAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Failed to load auth session", error);
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setInitializing(false);
    };

    void initialiseAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchOrCreateProfile = useCallback(async (targetUser: User): Promise<Profile | null> => {
    const { data, error, status } = await supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", targetUser.id)
      .maybeSingle();

    if (error && status !== 406) {
      console.error("Failed to load profile", error);
      return null;
    }

    if (data) {
      return data;
    }

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: targetUser.id,
        username: targetUser.email?.split("@")[0] ?? null,
        full_name:
          (targetUser.user_metadata?.full_name as string | undefined) ??
          targetUser.email ??
          null,
        avatar_url:
          (targetUser.user_metadata?.avatar_url as string | undefined) ?? null,
        bio: null,
        points: 0,
      })
      .select(PROFILE_FIELDS)
      .single();

    if (insertError) {
      console.error("Failed to create placeholder profile", insertError);
      return null;
    }

    return insertedProfile ?? null;
  }, []);

  const loadProfile = useCallback(
    async (overrideUser?: User | null) => {
      const activeUser = overrideUser ?? user;

      if (!activeUser) {
        setProfile(null);
        setProfileLoading(false);
        return null;
      }

      setProfileLoading(true);

      try {
        const nextProfile = await fetchOrCreateProfile(activeUser);
        setProfile(nextProfile);
        return nextProfile;
      } finally {
        setProfileLoading(false);
      }
    },
    [fetchOrCreateProfile, user],
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Subscribe to profile changes (including points updates) via Supabase realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          // Refresh profile when it's updated (e.g., when points change)
          void loadProfile();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadProfile]);

  const signIn: AuthContextValue["signIn"] = useCallback(
    async ({ email, password }) => {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login failed", error);
        return { error: error.message };
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        await loadProfile(data.session.user);
      }

      return { error: null };
    },
    [loadProfile],
  );

  const signUp: AuthContextValue["signUp"] = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });

    if (error) {
      console.error("Sign up failed", error);
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out failed", error);
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading: initializing || profileLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile: loadProfile,
    }),
    [session, user, profile, initializing, profileLoading, signIn, signUp, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
