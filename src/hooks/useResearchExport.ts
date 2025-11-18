import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CohortStats {
  totalUsers: number;
  totalSessions: number;
  totalTrials: number;
  avgSessionsPerUser: number;
  avgTrialsPerSession: number;
  lesionDistribution: Record<string, number>;
  mechanismDistribution: Record<string, number>;
  chronicityDistribution: Record<string, number>;
  avgLearningRates: Record<string, number>;
}

export const useResearchExport = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getCohortStatistics = async (): Promise<CohortStats | null> => {
    try {
      setLoading(true);

      // Fetch all necessary data
      const [usersRes, sessionsRes, trialsRes, profilesRes, learningRatesRes] = await Promise.all([
        supabase.from('profiles').select('user_id'),
        supabase.from('sessions').select('id, user_id'),
        supabase.from('exercise_events').select('id'),
        supabase.from('profiles').select('clinical_profile'),
        supabase.from('learning_rates').select('domain, accuracy_slope'),
      ]);

      if (usersRes.error || sessionsRes.error || trialsRes.error || profilesRes.error) {
        throw new Error('Failed to fetch cohort data');
      }

      const totalUsers = usersRes.data?.length || 0;
      const totalSessions = sessionsRes.data?.length || 0;
      const totalTrials = trialsRes.data?.length || 0;

      // Calculate distributions
      const lesionDistribution: Record<string, number> = {};
      const mechanismDistribution: Record<string, number> = {};
      const chronicityDistribution: Record<string, number> = {};

      profilesRes.data?.forEach((profile) => {
        const cp = profile.clinical_profile as any;
        if (cp?.stroke_location) {
          const location = Array.isArray(cp.stroke_location) ? cp.stroke_location[0] : cp.stroke_location;
          lesionDistribution[location] = (lesionDistribution[location] || 0) + 1;
        }
        if (cp?.stroke_mechanism) {
          mechanismDistribution[cp.stroke_mechanism] = (mechanismDistribution[cp.stroke_mechanism] || 0) + 1;
        }
        if (cp?.chronicity) {
          chronicityDistribution[cp.chronicity] = (chronicityDistribution[cp.chronicity] || 0) + 1;
        }
      });

      // Calculate average learning rates by domain
      const avgLearningRates: Record<string, number> = {};
      const domainCounts: Record<string, number> = {};

      learningRatesRes.data?.forEach((lr) => {
        if (lr.accuracy_slope !== null) {
          avgLearningRates[lr.domain] = (avgLearningRates[lr.domain] || 0) + Number(lr.accuracy_slope);
          domainCounts[lr.domain] = (domainCounts[lr.domain] || 0) + 1;
        }
      });

      Object.keys(avgLearningRates).forEach((domain) => {
        avgLearningRates[domain] = avgLearningRates[domain] / domainCounts[domain];
      });

      return {
        totalUsers,
        totalSessions,
        totalTrials,
        avgSessionsPerUser: totalUsers > 0 ? totalSessions / totalUsers : 0,
        avgTrialsPerSession: totalSessions > 0 ? totalTrials / totalSessions : 0,
        lesionDistribution,
        mechanismDistribution,
        chronicityDistribution,
        avgLearningRates,
      };
    } catch (error) {
      console.error('Error fetching cohort statistics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch cohort statistics',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deIdentifyData = (data: any[]): any[] => {
    return data.map((row) => {
      const deidentified = { ...row };
      
      // Remove direct identifiers
      delete deidentified.user_id;
      delete deidentified.display_name;
      delete deidentified.assessed_by;
      delete deidentified.created_by;
      delete deidentified.rated_by;
      
      // Hash any remaining IDs for linkage
      if (row.user_id) {
        deidentified.participant_id = hashUserId(row.user_id);
      }
      if (row.id) {
        deidentified.record_id = hashUserId(row.id);
      }
      if (row.session_id) {
        deidentified.session_hash = hashUserId(row.session_id);
      }
      if (row.goal_id) {
        deidentified.goal_hash = hashUserId(row.goal_id);
      }
      
      return deidentified;
    });
  };

  const hashUserId = (id: string): string => {
    // Simple hash for de-identification (for research, use a consistent hash)
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash;
    }
    return 'P' + Math.abs(hash).toString(16).padStart(8, '0');
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: 'No data',
        description: 'No data available to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export successful',
      description: `${filename} downloaded`,
    });
  };

  const exportDemographics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, clinical_profile, stroke_date, created_at');

      if (error) throw error;

      const formatted = data?.map((p) => {
        const cp = p.clinical_profile as any;
        return {
          user_id: p.user_id,
          stroke_date: p.stroke_date,
          account_created: p.created_at,
          stroke_mechanism: cp?.stroke_mechanism,
          stroke_location: Array.isArray(cp?.stroke_location) ? cp.stroke_location.join(';') : cp?.stroke_location,
          affected_side: cp?.affected_side,
          chronicity: cp?.chronicity,
          severity_motor: cp?.severity?.motor,
          severity_speech: cp?.severity?.speech,
          severity_cognitive: cp?.severity?.cognitive,
        };
      }) || [];

      const deidentified = deIdentifyData(formatted);
      exportToCSV(deidentified, 'demographics');
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const exportSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sessions')
        .select('id, user_id, started_at, ended_at, duration_sec, summary, mood_rating');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'sessions');
    } finally {
      setLoading(false);
    }
  };

  const exportTrials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercise_events')
        .select('id, session_id, exercise_slug, round, score, reaction_time_ms, cue_level, error_type, created_at');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'exercise_trials');
    } finally {
      setLoading(false);
    }
  };

  const exportLearningRates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('learning_rates')
        .select('*');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'learning_rates');
    } finally {
      setLoading(false);
    }
  };

  const exportGoals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('functional_goals')
        .select('*');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'functional_goals');
    } finally {
      setLoading(false);
    }
  };

  const exportGoalRatings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('goal_progress_ratings')
        .select('*');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'goal_progress_ratings');
    } finally {
      setLoading(false);
    }
  };

  const exportAssessments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('standardized_assessments')
        .select('*');

      if (error) throw error;
      const deidentified = deIdentifyData(data || []);
      exportToCSV(deidentified, 'standardized_assessments');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getCohortStatistics,
    exportDemographics,
    exportSessions,
    exportTrials,
    exportLearningRates,
    exportGoals,
    exportGoalRatings,
    exportAssessments,
  };
};
