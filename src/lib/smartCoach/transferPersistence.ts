/**
 * Transfer Check Persistence
 * 
 * Logs transfer scoring events to exercise_events table
 * using the existing schema with structured JSON fields.
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import type { TransferCheckResult, TransferTarget } from './transferScoring';

export interface TransferCheckEvent {
  sessionId: string;
  drillSlug: string;
  targets: TransferTarget[];
  result: TransferCheckResult;
  mayaTransferPrompt: string;
  userResponse: string;
  turnNumber: number;
}

/**
 * Persist a transfer check as an exercise_event with subtype 'transfer_check'.
 * Fire-and-forget — errors are logged but don't block UI.
 */
export async function persistTransferCheck(event: TransferCheckEvent): Promise<boolean> {
  try {
    const passed = event.result.transferScore >= 2; // pass = score 2-4 of 4
    const resolvedErrorType: string = passed
      ? 'correct'
      : (event.result.targetResults.every(r => !r.found) ? 'no_target_use' : 'partial_transfer');

    const { error } = await supabase.from('exercise_events').insert([{
      session_id: event.sessionId,
      exercise_slug: normalizeExerciseSlug(event.drillSlug),
      round: event.turnNumber,
      score: passed ? 100 : 0, // 0–100 scale (canonical exercise_events.score)
      error_type: resolvedErrorType,
      browser_transcript: event.userResponse,
      
      inputs: JSON.parse(JSON.stringify({
        transfer_targets: event.targets.map(t => ({
          value: t.value,
          type: t.type,
          functional_context: t.functionalContext,
        })),
        maya_transfer_prompt: event.mayaTransferPrompt,
      })),
      
      outputs: JSON.parse(JSON.stringify({
        transfer_score: event.result.transferScore,
        raw_score: event.result.rawScore,
        label: event.result.label,
        target_results: event.result.targetResults,
        components: event.result.components,
      })),
      
      task_parameters: JSON.parse(JSON.stringify({
        event_subtype: 'transfer_check',
        drill_slug: event.drillSlug,
      })),
      
      engagement_flags: JSON.parse(JSON.stringify({
        event_subtype: 'transfer_check',
        transfer_score: event.result.transferScore,
        any_target_found: event.result.targetResults.some(r => r.found),
        spontaneous: event.result.transferScore >= 4,
        functional: event.result.transferScore >= 3,
      })),
    }]);

    if (error) {
      console.warn('[TransferPersistence] Insert failed:', error.message);
      return false;
    }

    if (import.meta.env.DEV) {
      console.debug('[TransferPersistence] Score:', event.result.transferScore,
        '| Targets:', event.targets.map(t => t.value).join(', '),
        '| Label:', event.result.label);
    }

    return true;
  } catch (err) {
    console.warn('[TransferPersistence] Unexpected error:', err);
    return false;
  }
}
