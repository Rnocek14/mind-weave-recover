import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AssessmentResult } from '@/lib/capabilityAssessor';
import { smoothScore } from '@/lib/capabilityScoreSmoothing';

export const useCapabilityAssessment = (userId: string | undefined, profileId: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [currentAssessment, setCurrentAssessment] = useState<any | null>(null);
  const [previousAssessment, setPreviousAssessment] = useState<any | null>(null);
  const { toast } = useToast();

  const fetchLatestAssessment = useCallback(async () => {
    if (!userId || !profileId) {
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      // Fetch top 2 assessments to enable drop detection and smoothing
      const { data, error } = await (supabase as any)
        .from('capability_assessments')
        .select('*')
        .eq('user_id', userId)
        .eq('profile_id', profileId)
        .order('assessed_at', { ascending: false })
        .limit(2);

      if (error) throw error;
      
      setCurrentAssessment(data?.[0] ?? null);
      setPreviousAssessment(data?.[1] ?? null);
      
      return data?.[0] ?? null;
    } catch (error) {
      console.error('Error fetching capability assessment:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, profileId]);

  // Auto-fetch latest assessment on mount or userId change
  useEffect(() => {
    let isMounted = true;
    
    const loadAssessment = async () => {
      if (isMounted) {
        await fetchLatestAssessment();
      }
    };
    
    loadAssessment();
    
    return () => {
      isMounted = false;
    };
  }, [fetchLatestAssessment]);

  const saveAssessment = async (result: AssessmentResult, clinicalSnapshot: any = {}) => {
    if (!userId || !profileId) {
      toast({
        title: "Error",
        description: "User not authenticated or profile not selected",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);
    try {
      // Apply score smoothing to prevent wild swings from a single tired/distracted session
      const smoothedVision = smoothScore(result.scores.vision, previousAssessment?.vision_score ?? null);
      const smoothedMotor = smoothScore(result.scores.motor, previousAssessment?.motor_score ?? null);
      const smoothedAttention = smoothScore(result.scores.attention, previousAssessment?.attention_score ?? null);

      console.log('[CapabilityAssessment] Score smoothing applied:', {
        vision: { raw: result.scores.vision, smoothed: smoothedVision, previous: previousAssessment?.vision_score },
        motor: { raw: result.scores.motor, smoothed: smoothedMotor, previous: previousAssessment?.motor_score },
        attention: { raw: result.scores.attention, smoothed: smoothedAttention, previous: previousAssessment?.attention_score },
      });

      // Type workaround until types are regenerated after migration
      const { data, error } = await (supabase as any)
        .from('capability_assessments')
        .insert({
          user_id: userId,
          profile_id: profileId,
          vision_score: smoothedVision,
          motor_score: smoothedMotor,
          attention_score: smoothedAttention,
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
    previousAssessment,
    fetchLatestAssessment,
    saveAssessment,
    markForRetry,
  };
};
