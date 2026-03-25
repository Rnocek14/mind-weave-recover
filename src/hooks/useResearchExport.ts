import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import type { Database } from '@/integrations/supabase/types';

type TableName = keyof Database['public']['Tables'];
const PAGE_SIZE = 1000;

/**
 * Paginated fetch — pulls all rows from a table in PAGE_SIZE chunks
 * so we never silently truncate at the Supabase default limit.
 */
async function fetchAllRows(
  table: TableName,
  selectCols: string = '*'
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

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

      const [users, sessions, trials, profiles, learningRates] = await Promise.all([
        fetchAllRows('profiles', 'user_id'),
        fetchAllRows('sessions', 'id, user_id'),
        fetchAllRows('exercise_events', 'id'),
        fetchAllRows('profiles', 'clinical_profile'),
        fetchAllRows('learning_rates', 'domain, accuracy_slope'),
      ]);

      const totalUsers = users.length;
      const totalSessions = sessions.length;
      const totalTrials = trials.length;

      const lesionDistribution: Record<string, number> = {};
      const mechanismDistribution: Record<string, number> = {};
      const chronicityDistribution: Record<string, number> = {};

      profiles.forEach((profile) => {
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

      const avgLearningRates: Record<string, number> = {};
      const domainCounts: Record<string, number> = {};

      learningRates.forEach((lr) => {
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
      toast({ title: 'Error', description: 'Failed to fetch cohort statistics', variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const hashId = (id: string): string => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash = hash & hash;
    }
    return 'P' + Math.abs(hash).toString(16).padStart(8, '0');
  };

  const deIdentifyData = (data: any[]): any[] => {
    return data.map((row) => {
      const d = { ...row };
      delete d.user_id;
      delete d.display_name;
      delete d.assessed_by;
      delete d.created_by;
      delete d.rated_by;

      if (row.user_id) d.participant_id = hashId(row.user_id);
      if (row.id) d.record_id = hashId(row.id);
      if (row.session_id) d.session_hash = hashId(row.session_id);
      if (row.goal_id) d.goal_hash = hashId(row.goal_id);

      return d;
    });
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({ title: 'No data', description: 'No data available to export', variant: 'destructive' });
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
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Export successful', description: `${filename} — ${data.length.toLocaleString()} rows downloaded` });
  };

  const paginatedExport = async (table: TableName, selectCols: string, filename: string, formatter?: (data: any[]) => any[]) => {
    try {
      setLoading(true);
      const data = await fetchAllRows(table, selectCols);
      const formatted = formatter ? formatter(data) : data;
      const deidentified = deIdentifyData(formatted);
      exportToCSV(deidentified, filename);
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Export failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportDemographics = () =>
    paginatedExport('profiles', 'user_id, clinical_profile, stroke_date, created_at', 'demographics', (data) =>
      data.map((p) => {
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
      })
    );

  const exportSessions = () =>
    paginatedExport('sessions', 'id, user_id, started_at, ended_at, duration_sec, summary, mood_rating', 'sessions');

  const exportTrials = () =>
    paginatedExport('exercise_events', 'id, session_id, exercise_slug, round, score, reaction_time_ms, cue_level, error_type, created_at', 'exercise_trials');

  const exportLearningRates = () =>
    paginatedExport('learning_rates', '*', 'learning_rates');

  const exportGoals = () =>
    paginatedExport('functional_goals', '*', 'functional_goals');

  const exportGoalRatings = () =>
    paginatedExport('goal_progress_ratings', '*', 'goal_progress_ratings');

  const exportAssessments = () =>
    paginatedExport('standardized_assessments', '*', 'standardized_assessments');

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
