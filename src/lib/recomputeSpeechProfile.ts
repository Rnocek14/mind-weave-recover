import { supabase } from '@/integrations/supabase/client';

export interface RecomputeResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  profile?: any;
  analysesProcessed?: number;
  newTrials?: number;
  previousTrialCount?: number;
  insights?: {
    avgSemanticSimilarity: number | null;
    avgPhonologicalSimilarity: number | null;
    effortfulRate: number | null;
    baselineWpm: number | null;
  };
}

/**
 * Manually trigger speech profile recomputation for a user.
 * Use this for clinician-triggered recomputes that should bypass the debounce.
 */
export async function recomputeSpeechProfileNow(
  userId: string,
  options?: { force?: boolean; profileId?: string }
): Promise<RecomputeResult> {
  const { data, error } = await supabase.functions.invoke('compute-speech-profile', {
    body: {
      user_id: userId,
      profile_id: options?.profileId,
      force: options?.force ?? true, // Default to forcing for manual recomputes
    },
  });

  if (error) {
    console.error('Failed to recompute speech profile:', error);
    throw new Error(error.message || 'Failed to recompute speech profile');
  }

  return data as RecomputeResult;
}
