import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { localYYYYMMDD } from "@/lib/localDate";

export interface DailyReadiness {
  id: string;
  checkin_date: string;
  fatigue_rating: number;
  fatigue_limited_practice: boolean;
  sleep_quality: number | null;
  pain_level: number | null;
  mood_rating: number | null;
  notes: string | null;
}

interface UpsertReadinessInput {
  fatigue_rating: number;
  fatigue_limited_practice?: boolean;
  sleep_quality?: number | null;
  pain_level?: number | null;
  mood_rating?: number | null;
  notes?: string | null;
}

export function useDailyReadiness(profileId: string | undefined) {
  const { user } = useAuth();
  const [todayCheckin, setTodayCheckin] = useState<DailyReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = localYYYYMMDD();

  const fetchToday = useCallback(async () => {
    if (!user?.id || !profileId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("daily_readiness")
        .select("*")
        .eq("profile_id", profileId)
        .eq("checkin_date", today)
        .maybeSingle();

      if (error) throw error;
      setTodayCheckin(data || null);
    } catch (err) {
      console.error("[useDailyReadiness] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profileId, today]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const upsertReadiness = useCallback(
    async (input: UpsertReadinessInput) => {
      if (!user?.id || !profileId) return null;

      setIsSaving(true);
      try {
        const { data, error } = await (supabase as any)
          .from("daily_readiness")
          .upsert(
            {
              user_id: user.id,
              profile_id: profileId,
              checkin_date: today,
              fatigue_rating: input.fatigue_rating,
              fatigue_limited_practice: input.fatigue_limited_practice ?? false,
              sleep_quality: input.sleep_quality ?? null,
              pain_level: input.pain_level ?? null,
              mood_rating: input.mood_rating ?? null,
              notes: input.notes ?? null,
            },
            { onConflict: "profile_id,checkin_date" }
          )
          .select()
          .single();

        if (error) throw error;
        setTodayCheckin(data);
        return data;
      } catch (err) {
        console.error("[useDailyReadiness] upsert error:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, profileId, today]
  );

  return {
    todayCheckin,
    hasCheckedInToday: !!todayCheckin,
    isLoading,
    isSaving,
    upsertReadiness,
    refetch: fetchToday,
  };
}
