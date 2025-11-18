import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AssessmentResult } from '@/lib/capabilityAssessor';

export const useCapabilityAssessment = (userId: string | undefined) => {
  const [loading, setLoading] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState<any | null>(null);
  const { toast } = useToast();

  const fetchLatestAssessment = async () => {
    if (!userId) return null;

    try {
      // Type workaround until types are regenerated after migration
      const { data, error } = await (supabase as any)
        .from('capability_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('assessed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentAssessment(data);
      return data;
    } catch (error) {
      console.error('Error fetching capability assessment:', error);
      return null;
    }
  };

  const saveAssessment = async (result: AssessmentResult, clinicalSnapshot: any = {}) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);
    try {
      // Type workaround until types are regenerated after migration
      const { data, error } = await (supabase as any)
        .from('capability_assessments')
        .insert({
          user_id: userId,
          vision_score: result.scores.vision,
          motor_score: result.scores.motor,
          attention_score: result.scores.attention,
          can_orient: result.behavioralFlags.canOrient,
          can_tap: result.behavioralFlags.canTap,
          understands_cause_effect: result.behavioralFlags.understandsCauseEffect,
          can_match_patterns: result.behavioralFlags.canMatchPatterns,
          trial_data: {
            level0: result.level0,
            level1: result.level1,
            level2: result.level2,
          },
          completed: result.completed,
          needs_retry: result.needsRetry,
          retry_reason: result.retryReason,
          confidence_score: result.scores.confidence,
          clinical_snapshot: clinicalSnapshot,
        })
        .select()
        .single();

      if (error) throw error;

      // Update profile with latest assessment reference
      await (supabase as any)
        .from('profiles')
        .update({ capability_profile_id: data.id })
        .eq('user_id', userId);

      setCurrentAssessment(data);
      
      toast({
        title: "Assessment Complete",
        description: "Your capability profile has been updated.",
      });

      return data;
    } catch (error: any) {
      console.error('Error saving capability assessment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save assessment",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const markForRetry = async (assessmentId: string, reason: string) => {
    try {
      // Type workaround until types are regenerated after migration
      const { error } = await (supabase as any)
        .from('capability_assessments')
        .update({
          needs_retry: true,
          retry_reason: reason,
        })
        .eq('id', assessmentId);

      if (error) throw error;
      
      toast({
        title: "Assessment Paused",
        description: "We'll try again when you're ready.",
      });
    } catch (error) {
      console.error('Error marking assessment for retry:', error);
    }
  };

  return {
    loading,
    currentAssessment,
    fetchLatestAssessment,
    saveAssessment,
    markForRetry,
  };
};
