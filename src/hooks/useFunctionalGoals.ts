import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FunctionalGoal {
  id: string;
  user_id: string;
  goal_text: string;
  target_domain: 'communication' | 'motor' | 'cognitive' | 'daily_living' | 'connected_speech';
  baseline_status: 'not_yet' | 'partial' | 'achieved';
  target_date?: string;
  created_at: string;
  archived_at?: string;
  created_by?: string;
  latest_rating?: GoalProgressRating;
}

// Suggested behavioral goals for connected speech
export const CONNECTED_SPEECH_GOAL_TEMPLATES = [
  "Finish 8 out of 10 thoughts without trailing off",
  "Start speaking within 5 seconds on most prompts",
  "Need fewer than 2 hints per session",
  "Recover after a pause at least once per session",
  "Complete a thought on a personal memory topic",
] as const;

export interface GoalProgressRating {
  id: string;
  goal_id: string;
  rated_at: string;
  status: 'not_yet' | 'partial' | 'achieved';
  notes?: string;
  rated_by?: string;
  confidence_level?: number;
}

export const useFunctionalGoals = (userId: string | null, profileId?: string | null) => {
  const [goals, setGoals] = useState<FunctionalGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch goals with latest rating
      let q = supabase
        .from('functional_goals')
        .select('*')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (profileId) q = q.eq('profile_id', profileId);
      const { data: goalsData, error: goalsError } = await q;

      if (goalsError) throw goalsError;


      // Fetch latest ratings for each goal
      const goalsWithRatings = await Promise.all(
        (goalsData || []).map(async (goal) => {
          const { data: ratings } = await supabase
            .from('goal_progress_ratings')
            .select('*')
            .eq('goal_id', goal.id)
            .order('rated_at', { ascending: false })
            .limit(1);

          return {
            ...goal,
            target_domain: goal.target_domain as FunctionalGoal['target_domain'],
            baseline_status: goal.baseline_status as FunctionalGoal['baseline_status'],
            latest_rating: ratings?.[0] as GoalProgressRating | undefined,
          };
        })
      );

      setGoals(goalsWithRatings as FunctionalGoal[]);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load goals');
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (
    goalText: string,
    targetDomain: FunctionalGoal['target_domain'],
    baselineStatus: FunctionalGoal['baseline_status'] = 'not_yet',
    targetDate?: string
  ) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('functional_goals')
        .insert({
          user_id: userId,
          goal_text: goalText,
          target_domain: targetDomain,
          baseline_status: baselineStatus,
          target_date: targetDate,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Goal created successfully');
      await fetchGoals();
      return data;
    } catch (err) {
      console.error('Error creating goal:', err);
      toast.error('Failed to create goal');
      throw err;
    }
  };

  const addProgressRating = async (
    goalId: string,
    status: GoalProgressRating['status'],
    notes?: string,
    confidenceLevel?: number
  ) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('goal_progress_ratings')
        .insert({
          goal_id: goalId,
          status,
          notes,
          confidence_level: confidenceLevel,
          rated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Progress updated');
      await fetchGoals();
      return data;
    } catch (err) {
      console.error('Error adding progress rating:', err);
      toast.error('Failed to update progress');
      throw err;
    }
  };

  const archiveGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('functional_goals')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', goalId);

      if (error) throw error;

      toast.success('Goal archived');
      await fetchGoals();
    } catch (err) {
      console.error('Error archiving goal:', err);
      toast.error('Failed to archive goal');
      throw err;
    }
  };

  const getProgressHistory = async (goalId: string) => {
    try {
      const { data, error } = await supabase
        .from('goal_progress_ratings')
        .select('*')
        .eq('goal_id', goalId)
        .order('rated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching progress history:', err);
      toast.error('Failed to load progress history');
      return [];
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [userId, profileId]);


  return {
    goals,
    loading,
    error,
    createGoal,
    addProgressRating,
    archiveGoal,
    getProgressHistory,
    refresh: fetchGoals,
  };
};
