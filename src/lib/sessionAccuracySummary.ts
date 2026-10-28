/**
 * Session accuracy from actual persisted clinical exercise events.
 *
 * Both this client and the privileged stale-session sweeper import the same
 * pure canonical reducer from supabase/functions/_shared/sessionAccuracySummary.
 * This prevents different completion paths from fabricating different metrics.
 * "accuracy" remains TASK correctness, not ASR quality.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  reduceAccuracy,
  accuracySummaryToSummaryFields,
  EMPTY_SESSION_ACCURACY,
  type ScoredRow,
  type SessionAccuracySummary,
} from '../../supabase/functions/_shared/sessionAccuracySummary';

export { reduceAccuracy, accuracySummaryToSummaryFields };
export type { ScoredRow, SessionAccuracySummary };

/** Fetch the session's scored trials and reduce them. Never throws. */
export async function computeSessionAccuracySummary(
  sessionId: string | null,
): Promise<SessionAccuracySummary> {
  if (!sessionId) return { ...EMPTY_SESSION_ACCURACY };
  try {
    const { data, error } = await supabase
      .from('exercise_events')
      .select('score, cue_level, counts_toward_score, validity_label, exercise_slug, task_parameters, engagement_flags, whisper_transcript, browser_transcript')
      .eq('session_id', sessionId);
    if (error || !data) return { ...EMPTY_SESSION_ACCURACY };
    return reduceAccuracy(data as ScoredRow[]);
  } catch {
    return { ...EMPTY_SESSION_ACCURACY };
  }
}
