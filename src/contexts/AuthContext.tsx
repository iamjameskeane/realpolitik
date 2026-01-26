"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: "free" | "pro" | "enterprise";
  daily_briefings_used: number;
  last_briefing_reset: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BriefingUsage {
  used: number;
  remaining: number;
  resets_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getBriefingUsage: () => Promise<BriefingUsage | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const supabase = getSupabaseClient();

  // Fetch user profile from database
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        setProfile(data as Profile);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
      }
    },
    [supabase]
  );

  // Get briefing usage for current user
  const getBriefingUsage = useCallback(async (): Promise<BriefingUsage | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.rpc("get_briefing_usage", {
        user_uuid: user.id,
      });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error("Error fetching briefing usage:", error);
      return null;
    }
  }, [user, supabase]);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // Sign out with timeout to prevent hanging
  const signOut = useCallback(async () => {
    const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error("Sign out timed out")), 5000);
    });

    try {
      await Promise.race([supabase.auth.signOut(), timeoutPromise]);
    } catch (error) {
      console.error("[Auth] Sign out error:", error);
    }

    // Always clear local state, even if Supabase call fails
    setUser(null);
    setProfile(null);
    setSession(null);
  }, [supabase]);

  // Open/close auth modal
  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      // Only update user if ID actually changes (prevents unnecessary re-renders)
      setUser((prevUser) => {
        const newUserId = session?.user?.id ?? null;
        const prevUserId = prevUser?.id ?? null;
        if (newUserId === prevUserId) {
          return prevUser; // Keep same reference
        }
        return session?.user ?? null;
      });

      if (session?.user) {
        // Only refetch profile if user ID changed
        setProfile((prevProfile) => {
          if (prevProfile?.id === session.user.id) {
            return prevProfile; // Keep existing profile
          }
          // Fetch new profile (but don't await to avoid blocking)
          fetchProfile(session.user.id);
          return prevProfile;
        });
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    authModalOpen,
    openAuthModal,
    closeAuthModal,
    signOut,
    refreshProfile,
    getBriefingUsage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
