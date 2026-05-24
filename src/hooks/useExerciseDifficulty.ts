import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useExerciseGating } from "./useExerciseGating";
import { useRuntimeConfig } from "./useRuntimeConfig";
import { getCapabilityDifficultyBounds, clampToBounds } from "@/lib/difficultyBounds";
import { normalizeExerciseSlug } from "@/lib/exerciseSlugNormalizer";

type ExerciseDifficulty = {
  level: number;
  loading: boolean;
  saveLevel: (newLevel: number) => Promise<void>;
  stepDown: (sessionId?: string) => Promise<number>;
  bounds: { floor: number; ceiling: number; suggestedStart: number };
};

export const useExerciseDifficulty = (
  userId: string | undefined,
  profileId: string | undefined,
  exerciseSlug: string
): ExerciseDifficulty => {
  const [level, setLevel] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const { capabilityScores } = useExerciseGating(userId, profileId);
  const { getDifficulty } = useRuntimeConfig();

  // Calculate capability-based bounds
  const bounds = useMemo(
    () => getCapabilityDifficultyBounds(exerciseSlug, capabilityScores),
    [exerciseSlug, capabilityScores]
  );

  useEffect(() => { void loadLevel(); }, [userId, exerciseSlug]);

  const loadLevel = async (): Promise<void> => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('accessibility_prefs')
        .eq('user_id', userId)
        .single();
      const prefs = (data?.accessibility_prefs as any) ?? {};
      const difficulties = (prefs.difficulties ?? {}) as Record<string, number>;
      const savedLevel = difficulties[exerciseSlug] ?? bounds.suggestedStart;
      
      // Apply clinician runtime_config offset, then clamp to capability bounds
      const runtimeOffset = getDifficulty(exerciseSlug);
      setLevel(clampToBounds(savedLevel + runtimeOffset, bounds));
    } catch (e) {
      console.error('Error loading difficulty:', e);
      setLevel(bounds.suggestedStart);
    } finally {
      setLoading(false);
    }
  };

  const saveLevel = async (newLevel: number): Promise<void> => {
    if (!userId) return;
    
    // Clamp to capability bounds before saving
    const clampedLevel = clampToBounds(newLevel, bounds);
    setLevel(clampedLevel);
    
    try {
      await supabase.rpc('merge_profile_pref', {
        p_key: 'difficulties',
        p_subkey: exerciseSlug,
        p_value: clampedLevel
      });
    } catch (e) {
      console.error('Error saving difficulty:', e);
    }
  };

  const stepDown = async (sessionId?: string): Promise<number> => {
    // Step down but respect floor
    const next = Math.max(bounds.floor, level - 1);
    await saveLevel(next);
    
    try {
      await supabase.from('exercise_events').insert({
        session_id: sessionId ?? null,
        profile_id: profileId ?? null,
        exercise_slug: normalizeExerciseSlug(exerciseSlug),
        round: 0,
        score: null,
        error_type: 'system_step_down',
        inputs: { action: 'step_down', from_level: level, to_level: next },
        outputs: {}
      });
    } catch (e) {
      console.error('Error logging step-down:', e);
    }
    
    toast({ 
      title: "We've made it easier", 
      description: "The next round will be more manageable. You're doing great!" 
    });
    return next;
  };

  return { level, loading, saveLevel, stepDown, bounds };
};
