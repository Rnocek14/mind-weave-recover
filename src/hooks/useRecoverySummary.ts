import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export type SummaryType = 'progress' | 'education';

export interface RecoverySummary {
  id: string;
  user_id: string;
  summary_type: SummaryType;
  generated_at: string;
  data_snapshot: any;
  ai_summary: string;
  key_insights: string[];
  model_used: string | null;
  generation_duration_ms: number | null;
  confidence_score: number | null;
  created_at: string;
  trial_count_at_generation?: number;
}

export const useRecoverySummary = (userId: string | undefined, summaryType?: SummaryType) => {
  const [summaries, setSummaries] = useState<RecoverySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();
  const activeProfileId = useActiveProfileId();

  const fetchSummaries = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('recovery_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false });

      if (activeProfileId) {
        query = query.eq('profile_id', activeProfileId);
      }

      if (summaryType) {
        query = query.eq('summary_type', summaryType);
      }


      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setSummaries((data || []) as RecoverySummary[]);
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('Error fetching recovery summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (type: SummaryType, silent = false) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "User ID is required to generate summary",
        variant: "destructive",
      });
      return null;
    }

    setGenerating(true);
    setError(null); // Clear previous errors

    try {
      // Get all session IDs for this user
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId);

      const sessionIds = sessions?.map(s => s.id) || [];

      // Get current trial count for tracking
      const { count: trialCount } = await supabase
        .from('exercise_events')
        .select('*', { count: 'exact', head: true })
        .in('session_id', sessionIds);

      const { data, error: invokeError } = await supabase.functions.invoke(
        'generate-recovery-summary',
        {
          body: {
            userId,
            summaryType: type,
            trialCount: trialCount || 0,
          },
        }
      );

      if (invokeError) throw invokeError;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error('Failed to generate summary');
      }

      if (!silent) {
        toast({
          title: "Summary Generated",
          description: `Your ${type} summary has been created successfully.`,
        });
      }

      // Clear error state on success
      setError(null);
      
      // Refresh summaries list
      await fetchSummaries();

      return data.summary as RecoverySummary;
    } catch (err) {
      const error = err as Error;
      setError(error);
      
      // Handle specific error cases - Don't show toast, let UI handle it
      console.error('Error generating recovery summary:', error);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const getLatestSummary = (type: SummaryType) => {
    return summaries.find(s => s.summary_type === type);
  };

  const needsRegeneration = (summary: RecoverySummary | undefined, daysThreshold = 7) => {
    if (!summary) return true;
    
    const generatedDate = new Date(summary.generated_at);
    const daysSinceGeneration = (Date.now() - generatedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceGeneration > daysThreshold;
  };

  useEffect(() => {
    fetchSummaries();
  }, [userId, summaryType]);

  return {
    summaries,
    loading,
    generating,
    error,
    fetchSummaries,
    generateSummary,
    getLatestSummary,
    needsRegeneration,
  };
};
