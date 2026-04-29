/**
 * Conversation Turn Telemetry — P0 Bridge
 * 
 * Emits structured exercise_events from conversation turns,
 * bridging freeform therapeutic conversation into the clinical
 * outcome measurement pipeline.
 * 
 * Event subtype: 'conversation-turn'
 * Distinct from photo_naming / minimal_pairs — different confidence
 * and interpretation rules, but feeds the same 7 recovery metrics.
 * 
 * Success criteria:
 * - Cue independence trackable across sessions
 * - Latency/recovery trends computable
 * - Stuck patterns quantifiable over time
 * - Cue effectiveness measurable per type
 */

import { supabase } from '@/integrations/supabase/client';
import type { StuckType } from '@/lib/stuckTypeClassifier';
import type { SupportLevel } from '@/lib/conversationDifficultyController';

// ═══════════════════════════════════════════════════════════════
// Event Contract — what a conversation turn captures
// ═══════════════════════════════════════════════════════════════

export interface ConversationTurnOutcome {
  /** How the turn resolved */
  resolution: 
    | 'completed_independently'  // Spoke meaningfully without cue
    | 'completed_with_cue'       // Spoke after receiving a cue
    | 'recovered_after_cue'      // Initially struggled, cue helped
    | 'abandoned'                // Did not produce meaningful speech
    | 'minimal_response';        // Spoke but very little (1-2 words)
  
  /** Repair quality — was the cue the right type for the error? */
  repairQuality?: 'correct_type' | 'wrong_type' | 'unnecessary' | 'not_applicable';
  /** Did the user's output improve after the cue on THIS turn? */
  cueResolvedBlock?: boolean;
}

export interface ConversationTurnEvent {
  // ── Identity ──
  sessionId: string;
  turnNumber: number;

  // ── Speech capture ──
  transcript: string;
  wordCount: number;
  
  // ── Timing ──
  latencyToFirstWordMs: number | null;
  totalDurationMs: number | null;
  speechRateWpm: number | null;

  // ── Clinical classification ──
  stuckType: StuckType;
  effortfulSpeech: boolean;
  circumlocutionDetected: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  
  // ── Fluency metrics ──
  fluencyScore: number;           // 0-100
  filledPauseCount: number;
  
  // ── Cue context ──
  cueLevel: number;               // 0 = no cue, 1-4 escalating
  cueTypeOffered: string | null;  // 'semantic' | 'phonemic' | 'full_word' | null
  cueAccepted: boolean;           // Did user speak after cue?
  
  // ── Support level ──
  supportLevel: SupportLevel;     // Current difficulty tier
  
  // ── Turn outcome ──
  outcome: ConversationTurnOutcome;
  
  // ── Pronunciation (when available) ──
  pronunciationScore: number | null;
  challengingSounds: string[];
  
  // ── ASR confidence ──
  asrConfidence: number | null;
}

// ═══════════════════════════════════════════════════════════════
// Outcome classification — derives turn outcome from signals
// ═══════════════════════════════════════════════════════════════

export function classifyTurnOutcome(
  wordCount: number,
  cueLevel: number,
  stuckType: StuckType,
  effortfulSpeech: boolean,
  previousStuckType?: StuckType | null,
): ConversationTurnOutcome {
  // No speech at all
  if (wordCount === 0 || stuckType === 'no_speech') {
    return { 
      resolution: 'abandoned',
      repairQuality: cueLevel > 0 ? 'wrong_type' : 'not_applicable',
      cueResolvedBlock: false,
    };
  }

  // Minimal speech (1-2 words)
  if (wordCount <= 2 && effortfulSpeech) {
    return { 
      resolution: 'minimal_response',
      repairQuality: cueLevel > 0 ? 'wrong_type' : 'not_applicable',
      cueResolvedBlock: false,
    };
  }

  // Had a cue active
  if (cueLevel > 0) {
    // Determine if the cue actually resolved the block
    const wasStuck = previousStuckType === 'word_search_stall' || 
                     previousStuckType === 'prompt_overload' || 
                     previousStuckType === 'thought_abandonment' ||
                     previousStuckType === 'no_speech';
    const cueResolvedBlock = wasStuck && wordCount >= 3;
    
    // User recovered after struggling
    if (stuckType === 'word_search_stall' || stuckType === 'prompt_overload') {
      return { 
        resolution: 'recovered_after_cue',
        repairQuality: cueResolvedBlock ? 'correct_type' : 'wrong_type',
        cueResolvedBlock,
      };
    }
    return { 
      resolution: 'completed_with_cue',
      repairQuality: wasStuck ? 'correct_type' : 'unnecessary',
      cueResolvedBlock,
    };
  }

  // No cue, meaningful speech
  return { 
    resolution: 'completed_independently',
    repairQuality: 'not_applicable',
    cueResolvedBlock: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// Score mapping — maps outcome to 0/1 for metrics pipeline
// ═══════════════════════════════════════════════════════════════

function outcomeToScore(outcome: ConversationTurnOutcome): number {
  switch (outcome.resolution) {
    case 'completed_independently': return 1;
    case 'completed_with_cue': return 1;
    case 'recovered_after_cue': return 1;
    case 'minimal_response': return 0;
    case 'abandoned': return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// Emitter — fire-and-forget write to exercise_events
// ═══════════════════════════════════════════════════════════════

export async function emitConversationTurnEvent(
  event: ConversationTurnEvent
): Promise<boolean> {
  try {
    const outcome = event.outcome;
    const score = outcomeToScore(outcome);

    const { error } = await supabase.from('exercise_events').insert({
      session_id: event.sessionId,
      exercise_slug: 'conversation_turn',
      round: event.turnNumber,
      score,
      reaction_time_ms: event.latencyToFirstWordMs,
      recording_duration_ms: event.totalDurationMs,
      cue_level: event.cueLevel,
      cue_type_given: event.cueTypeOffered,
      cue_was_effective: event.cueLevel > 0 && event.cueAccepted,
      error_type: (event.stuckType && String(event.stuckType).trim()) || (score === 1 ? 'correct' : 'incorrect_unspecified'),

      // CRITICAL: Persist transcript for session review and debugging
      browser_transcript: event.transcript || null,

      // Structured inputs — what the user produced
      inputs: {
        transcript: event.transcript,
        word_count: event.wordCount,
        speech_rate_wpm: event.speechRateWpm,
      },

      // Structured outputs — system analysis
      outputs: {
        outcome: outcome.resolution,
        support_level: event.supportLevel,
        pronunciation_score: event.pronunciationScore,
        challenging_sounds: event.challengingSounds,
      },

      // Clinical classification
      error_classification: {
        stuck_type: event.stuckType,
        effortful_speech: event.effortfulSpeech,
        circumlocution_detected: event.circumlocutionDetected,
        pause_pattern: event.pausePattern,
        fluency_score: event.fluencyScore,
        filled_pause_count: event.filledPauseCount,
      },

      // Engagement signals
      engagement_flags: {
        did_speak: event.wordCount > 0,
        meaningful_response: event.wordCount >= 3,
        independent: event.cueLevel === 0 && event.wordCount >= 3,
        cue_independent: outcome.resolution === 'completed_independently',
        event_subtype: 'conversation_turn',
        // Repair quality tracking
        repair_quality: outcome.repairQuality || 'not_applicable',
        cue_resolved_block: outcome.cueResolvedBlock ?? false,
      },

      // Task parameters for analytics context
      task_parameters: {
        event_subtype: 'conversation_turn',
        support_level: event.supportLevel,
        fluency_unavailable_reason: 'discourse_task',
      },
    });

    if (error) {
      console.warn('[ConvTurnTelemetry] Insert failed:', error.message);
      return false;
    }

    if (import.meta.env.DEV) {
      console.debug('[ConvTurnTelemetry] Turn', event.turnNumber, 
        '→', outcome.resolution, 
        '| cue:', event.cueLevel,
        '| words:', event.wordCount,
        '| fluency:', event.fluencyScore);
    }

    return true;
  } catch (err) {
    console.warn('[ConvTurnTelemetry] Unexpected error:', err);
    return false;
  }
}
