import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ExerciseDifficulty = {
  level: number;
  loading: boolean;
  saveLevel: (newLevel: number) => Promise<void>;
  stepDown: (sessionId?: string) => Promise<number>;
};

export const useExerciseDifficulty = (userId: string | undefined, exerciseSlug: string): ExerciseDifficulty => {
  const [level, setLevel] = useState<number>(1); // 1..10
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadLevel();
  }, [userId, exerciseSlug]);

  const loadLevel = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("profiles")
        .select("accessibility_prefs")
        .eq("user_id", userId)
        .single();
      
      const prefs = data?.accessibility_prefs as any;
      const difficulties = prefs?.difficulties || {};
      const savedLevel = difficulties[exerciseSlug] ?? 1;
      setLevel(savedLevel);
    } catch (error) {
      console.error("Error loading difficulty:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveLevel = async (newLevel: number) => {
    if (!userId) return;

    setLevel(newLevel);
    try {
      await supabase.rpc("merge_profile_pref", {
        p_key: "difficulties",
        p_subkey: exerciseSlug,
        p_value: newLevel
      });
    } catch (error) {
      console.error("Error saving difficulty:", error);
    }
  };

  const stepDown = async (sessionId?: string) => {
    const next = Math.max(1, level - 1);
    await saveLevel(next);

    // Log the step-down event (privacy-safe)
    try {
      await supabase.from("exercise_events").insert({
        session_id: sessionId || null,
        exercise_slug: exerciseSlug,
        round: 0,
        score: null,
        inputs: { action: "step_down", from_level: level, to_level: next },
        outputs: {}
      });
    } catch (error) {
      console.error("Error logging step-down:", error);
    }

    toast({
      title: "We've made it easier",
      description: "The next round will be more manageable. You're doing great!",
    });

    return next;
  };

  return { level, loading, saveLevel, stepDown };
};
