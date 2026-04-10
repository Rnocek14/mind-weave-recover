/**
 * Hook for Shadow Mode analytics data.
 * Fetches and computes all metrics for the shadow analytics console.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format } from "date-fns";

export interface ShadowEvent {
  id: string;
  user_id: string;
  profile_id: string | null;
  session_id: string | null;
  attempt_id: string | null;
  created_at: string;
  task_type: string;
  domain: string | null;
  interaction_mode: string | null;
  target_word: string | null;
  target_phrase: string | null;
  system_guess: string | null;
  system_action: string | null;
  system_confidence: number | null;
  user_spoke: boolean | null;
  user_transcript: string | null;
  outcome_correct: boolean | null;
  outcome_error_type: string | null;
  latency_ms: number | null;
  analysis_data: any;
  task_data: any;
  model_version: string | null;
  source_type: string;
  review_status: string;
  cue_type_candidate: string | null;
  trigger_reason: string | null;
  asr_confidence: number | null;
  user_self_recovered: boolean | null;
  environment: string | null;
}

export interface ShadowHealthStats {
  total: number;
  last7Days: number;
  activeProfiles: number;
  withTranscript: number;
  withTargetWord: number;
  withTargetPhrase: number;
  withTriggerReason: number;
  withCueCandidate: number;
  withModelVersion: number;
  selfRecovered: number;
}

export interface FieldCompleteness {
  field: string;
  filled: number;
  total: number;
  pct: number;
  status: 'strong' | 'partial' | 'weak' | 'missing';
}

function computeHealth(events: ShadowEvent[]): ShadowHealthStats {
  const now = new Date();
  const weekAgo = subDays(now, 7);
  const profiles = new Set<string>();

  let last7 = 0, withTranscript = 0, withTargetWord = 0, withTargetPhrase = 0;
  let withTrigger = 0, withCue = 0, withModel = 0, selfRecovered = 0;

  for (const e of events) {
    if (e.profile_id) profiles.add(e.profile_id);
    if (new Date(e.created_at) >= weekAgo) last7++;
    if (e.user_transcript) withTranscript++;
    if (e.target_word) withTargetWord++;
    if (e.target_phrase) withTargetPhrase++;
    if (e.trigger_reason) withTrigger++;
    if (e.cue_type_candidate) withCue++;
    if (e.model_version) withModel++;
    if (e.user_self_recovered === true) selfRecovered++;
  }

  return {
    total: events.length,
    last7Days: last7,
    activeProfiles: profiles.size,
    withTranscript,
    withTargetWord,
    withTargetPhrase,
    withTriggerReason: withTrigger,
    withCueCandidate: withCue,
    withModelVersion: withModel,
    selfRecovered,
  };
}

function computeFieldCompleteness(events: ShadowEvent[]): FieldCompleteness[] {
  const total = events.length;
  if (total === 0) return [];

  const fields: { field: string; key: keyof ShadowEvent }[] = [
    { field: 'user_transcript', key: 'user_transcript' },
    { field: 'system_guess', key: 'system_guess' },
    { field: 'system_action', key: 'system_action' },
    { field: 'system_confidence', key: 'system_confidence' },
    { field: 'trigger_reason', key: 'trigger_reason' },
    { field: 'cue_type_candidate', key: 'cue_type_candidate' },
    { field: 'model_version', key: 'model_version' },
    { field: 'review_status', key: 'review_status' },
    { field: 'user_self_recovered', key: 'user_self_recovered' },
    { field: 'latency_ms', key: 'latency_ms' },
    { field: 'asr_confidence', key: 'asr_confidence' },
    { field: 'task_type', key: 'task_type' },
    { field: 'environment', key: 'environment' },
  ];

  return fields.map(({ field, key }) => {
    const filled = events.filter(e => e[key] != null && e[key] !== '').length;
    const pct = Math.round((filled / total) * 100);
    let status: FieldCompleteness['status'] = 'missing';
    if (pct >= 80) status = 'strong';
    else if (pct >= 50) status = 'partial';
    else if (pct > 0) status = 'weak';
    return { field, filled, total, pct, status };
  });
}

export function useShadowAnalytics(filters?: {
  dateFrom?: string;
  dateTo?: string;
  taskType?: string;
  triggerReason?: string;
  reviewStatus?: string;
  selfRecovered?: boolean | null;
  environment?: string;
}) {
  const query = useQuery({
    queryKey: ['shadow-analytics', filters],
    queryFn: async () => {
      let q = supabase
        .from('shadow_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) q = q.lte('created_at', filters.dateTo);
      if (filters?.taskType) q = q.eq('task_type', filters.taskType);
      if (filters?.triggerReason) q = q.eq('trigger_reason', filters.triggerReason);
      if (filters?.reviewStatus) q = q.eq('review_status', filters.reviewStatus);
      if (filters?.selfRecovered != null) q = q.eq('user_self_recovered', filters.selfRecovered);
      if (filters?.environment) q = q.eq('environment', filters.environment);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ShadowEvent[];
    },
    staleTime: 30_000,
  });

  const events = query.data || [];
  const health = computeHealth(events);
  const fieldCompleteness = computeFieldCompleteness(events);

  // Aggregate: trigger reasons
  const triggerReasonCounts: Record<string, number> = {};
  const cueTypeCounts: Record<string, number> = {};
  const taskTypeCounts: Record<string, number> = {};
  const errorTypeCounts: Record<string, number> = {};
  const confidenceBuckets: Record<string, number> = { 'high(≥0.8)': 0, 'mid(0.5-0.8)': 0, 'low(<0.5)': 0, 'none': 0 };

  let selfRecoveredCount = 0;
  let unresolvedCount = 0;
  let wouldHaveCuedCount = 0;

  for (const e of events) {
    if (e.trigger_reason) triggerReasonCounts[e.trigger_reason] = (triggerReasonCounts[e.trigger_reason] || 0) + 1;
    if (e.cue_type_candidate) cueTypeCounts[e.cue_type_candidate] = (cueTypeCounts[e.cue_type_candidate] || 0) + 1;
    if (e.task_type) taskTypeCounts[e.task_type] = (taskTypeCounts[e.task_type] || 0) + 1;
    if (e.outcome_error_type) errorTypeCounts[e.outcome_error_type] = (errorTypeCounts[e.outcome_error_type] || 0) + 1;

    if (e.system_confidence != null) {
      if (e.system_confidence >= 0.8) confidenceBuckets['high(≥0.8)']++;
      else if (e.system_confidence >= 0.5) confidenceBuckets['mid(0.5-0.8)']++;
      else confidenceBuckets['low(<0.5)']++;
    } else {
      confidenceBuckets['none']++;
    }

    if (e.user_self_recovered === true) selfRecoveredCount++;
    if (e.outcome_correct === false && e.user_self_recovered !== true) unresolvedCount++;
    if (e.cue_type_candidate && e.system_confidence && e.system_confidence >= 0.5) wouldHaveCuedCount++;
  }

  return {
    events,
    health,
    fieldCompleteness,
    triggerReasonCounts,
    cueTypeCounts,
    taskTypeCounts,
    errorTypeCounts,
    confidenceBuckets,
    selfRecoveredCount,
    unresolvedCount,
    wouldHaveCuedCount,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
