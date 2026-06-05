import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProfileContext, type Profile } from "@/contexts/profile-context-value";

interface ProfileProviderProps {
  children: ReactNode;
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const fetchProfiles = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!userId) {
      setActiveProfile(null);
      setAllProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .order("profile_created_at", { ascending: true });

      if (error) throw error;

      if (requestId !== requestIdRef.current) return;

      setAllProfiles(data || []);
      const active = data?.find(p => p.is_active) || data?.[0] || null;
      setActiveProfile(active);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [userId]);

  const switchProfile = async (profileId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase.rpc("switch_active_profile", {
        p_profile_id: profileId,
      });

      if (error) throw error;

      await fetchProfiles();
    } catch (error) {
      console.error("Error switching profile:", error);
      throw error;
    }
  };

  const createProfile = async (data: {
    profile_name: string;
    birthdate?: string;
    stroke_date?: string;
    avatar_url?: string;
    profile_notes?: string;
  }) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from("profiles").insert({
        user_id: userId,
        profile_name: data.profile_name,
        birthdate: data.birthdate || null,
        stroke_date: data.stroke_date || null,
        avatar_url: data.avatar_url || null,
        profile_notes: data.profile_notes || null,
        is_active: false,
      });

      if (error) throw error;

      await fetchProfiles();
    } catch (error) {
      console.error("Error creating profile:", error);
      throw error;
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        allProfiles,
        loading,
        switchProfile,
        createProfile,
        refreshProfiles: fetchProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
