import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ExerciseDifficulty = {
  level: number;
  loading: boolean;
  saveLevel: (newLevel: number) => Promise<void>;
  stepDown: (sessionId?: string) => Promise<number>;
};

export const useExerciseDifficulty = (
  userId: string | undefined,
  exerciseSlug: string
): ExerciseDifficulty => {
  const [level, setLevel] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

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
      setLevel(difficulties[exerciseSlug] ?? 1);
    } catch (e) {
      console.error('Error loading difficulty:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveLevel = async (newLevel: number): Promise<void> => {
    if (!userId) return;
    setLevel(newLevel);
    try {
      await supabase.rpc('merge_profile_pref', {
        p_key: 'difficulties',
        p_subkey: exerciseSlug,
        p_value: newLevel
      });
    } catch (e) {
      console.error('Error saving difficulty:', e);
    }
  };

  const stepDown = async (sessionId?: string): Promise<number> => {
    const next = Math.max(1, level - 1);
    await saveLevel(next);
    try {
      await supabase.from('exercise_events').insert({
        session_id: sessionId ?? null,
        exercise_slug: exerciseSlug,
        round: 0,
        score: null,
        inputs: { action: 'step_down', from_level: level, to_level: next },
        outputs: {}
      });
    } catch (e) {
      console.error('Error logging step-down:', e);
    }
    toast({ title: "We've made it easier", description: "The next round will be more manageable. You're doing great!" });
    return next;
  };

  return { level, loading, saveLevel, stepDown };
};
