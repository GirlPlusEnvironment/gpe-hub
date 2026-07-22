import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  classifySignupError,
  getAuthRedirectUrl,
  normalizeUsername,
} from "@/lib/auth";
import { AuthContext, type AuthContextValue, type Profile } from "@/contexts/auth-context";

type AuthProviderProps = {
  children: ReactNode;
};

const PROFILE_FIELDS =
  "id, email, username, full_name, first_name, last_name, avatar_url, bio, neon_account_id, member_status, points, created_at, updated_at";

const syncProfileFieldsFromMetadata = async (
  targetUser: User,
  existingProfile: Profile | null,
): Promise<Profile | null> => {
  const metadataFullName = (targetUser.user_metadata?.full_name as string | undefined)?.trim() || null;
  const metadataFirstName = (targetUser.user_metadata?.first_name as string | undefined)?.trim() || null;
  const metadataLastName = (targetUser.user_metadata?.last_name as string | undefined)?.trim() || null;
  const metadataUsernameRaw = (targetUser.user_metadata?.username as string | undefined) ?? null;
  const metadataUsername = metadataUsernameRaw ? normalizeUsername(metadataUsernameRaw) : null;
  const metadataAvatarUrl = (targetUser.user_metadata?.avatar_url as string | undefined) ?? null;

  const nextFullName = existingProfile?.full_name?.trim() || metadataFullName || null;
  const nextUsername =
    existingProfile?.username?.trim() ||
    metadataUsername ||
    targetUser.email?.split("@")[0] ||
    null;
  const nextAvatarUrl = existingProfile?.avatar_url || metadataAvatarUrl || null;
  const nextEmail = targetUser.email?.toLowerCase() || existingProfile?.email || null;
  const nextFirstName = existingProfile?.first_name || metadataFirstName;
  const nextLastName = existingProfile?.last_name || metadataLastName;

  const needsUpdate =
    !existingProfile ||
    existingProfile.email !== nextEmail ||
    existingProfile.full_name !== nextFullName ||
    existingProfile.first_name !== nextFirstName ||
    existingProfile.last_name !== nextLastName ||
    existingProfile.username !== nextUsername ||
    existingProfile.avatar_url !== nextAvatarUrl;

  if (!needsUpdate) {
    return existingProfile;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: targetUser.id,
        email: nextEmail,
        username: nextUsername,
        full_name: nextFullName,
        first_name: nextFirstName,
        last_name: nextLastName,
        avatar_url: nextAvatarUrl,
        bio: existingProfile?.bio ?? null,
        neon_account_id: existingProfile?.neon_account_id ?? null,
        member_status: existingProfile?.member_status ?? null,
        points: existingProfile?.points ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select(PROFILE_FIELDS)
    .single();

  if (error) {
    console.error("Failed to sync profile metadata", error);
    return existingProfile;
  }

  return data ?? existingProfile;
};

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
      return syncProfileFieldsFromMetadata(targetUser, data);
    }

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: targetUser.id,
        email: targetUser.email?.toLowerCase() ?? null,
        username:
          ((targetUser.user_metadata?.username as string | undefined)?.trim()
            ? normalizeUsername(targetUser.user_metadata.username as string)
            : targetUser.email?.split("@")[0]) ?? null,
        full_name:
          (targetUser.user_metadata?.full_name as string | undefined) ?? null,
        first_name:
          (targetUser.user_metadata?.first_name as string | undefined) ?? null,
        last_name:
          (targetUser.user_metadata?.last_name as string | undefined) ?? null,
        avatar_url:
          (targetUser.user_metadata?.avatar_url as string | undefined) ?? null,
        bio: null,
        neon_account_id: null,
        member_status: null,
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

  const signUp: AuthContextValue["signUp"] = useCallback(async ({
    email,
    password,
    displayName,
    username,
  }) => {
    const normalizedUsername = username?.trim() ? normalizeUsername(username) : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName?.trim() || undefined,
          username: normalizedUsername || undefined,
        },
        emailRedirectTo: getAuthRedirectUrl("/login"),
      },
    });

    if (error) {
      if (import.meta.env.DEV) {
        console.error("Sign up failed", error);
      }
      return {
        error: error.message,
        errorKind: classifySignupError(error.message),
      };
    }

    return { error: null };
  }, []);

  const resendConfirmation: AuthContextValue["resendConfirmation"] = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl("/login"),
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("/reset-password"),
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const updatePassword: AuthContextValue["updatePassword"] = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
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
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
      refreshProfile: loadProfile,
    }),
    [
      session,
      user,
      profile,
      initializing,
      profileLoading,
      signIn,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
      loadProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
