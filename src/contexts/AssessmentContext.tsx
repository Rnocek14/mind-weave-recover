import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AssessmentResult } from '@/lib/capabilityAssessor';
import { smoothScore } from '@/lib/capabilityScoreSmoothing';

interface AssessmentContextValue {
  loading: boolean;
  currentAssessment: any | null;
  previousAssessment: any | null;
  fetchLatestAssessment: () => Promise<any>;
  saveAssessment: (result: AssessmentResult, clinicalSnapshot?: any) => Promise<any>;
  markForRetry: (assessmentId: string, reason: string) => Promise<void>;
}

const AssessmentContext = createContext<AssessmentContextValue | null>(null);

export function AssessmentProvider({ 
  children, 
  userId, 
  profileId 
}: { 
  children: ReactNode;
  userId: string | undefined;
  profileId: string | undefined;
}) {
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
      console.error('[AssessmentContext] Error fetching assessment:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, profileId]);

  // Auto-fetch on mount or when userId/profileId changes
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
      // Apply score smoothing
      const smoothedVision = smoothScore(result.scores.vision, previousAssessment?.vision_score ?? null);
      const smoothedMotor = smoothScore(result.scores.motor, previousAssessment?.motor_score ?? null);
      const smoothedAttention = smoothScore(result.scores.attention, previousAssessment?.attention_score ?? null);

      console.log('[AssessmentContext] Score smoothing applied:', {
        vision: { raw: result.scores.vision, smoothed: smoothedVision },
        motor: { raw: result.scores.motor, smoothed: smoothedMotor },
        attention: { raw: result.scores.attention, smoothed: smoothedAttention },
      });

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

      // Immediately refresh context state
      await fetchLatestAssessment();
      
      toast({
        title: "Assessment Complete",
        description: "Your capability profile has been updated.",
      });

      return data;
    } catch (error: any) {
      console.error('[AssessmentContext] Error saving assessment:', error);
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
      console.error('[AssessmentContext] Error marking for retry:', error);
    }
  };

  return (
    <AssessmentContext.Provider
      value={{
        loading,
        currentAssessment,
        previousAssessment,
        fetchLatestAssessment,
        saveAssessment,
        markForRetry,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessmentContext() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessmentContext must be used within AssessmentProvider');
  }
  return context;
}
