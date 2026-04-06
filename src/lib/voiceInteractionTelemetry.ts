/**
 * Voice Interaction Telemetry
 * 
 * Tracks how users interact with voice input to identify:
 * - friction points (high edit/retry rates)
 * - fallback dependency (how often users bail to typing)
 * - recognition quality (confidence distribution)
 * - engagement patterns (voice vs text preference)
 * 
 * Persists session summaries to voice_session_summaries table.
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════
// Event types
// ═══════════════════════════════════════════════════════════════

export type VoiceEventType =
  | 'mic_start'           // User tapped mic
  | 'mic_success'         // Speech recognized with usable confidence
  | 'mic_low_confidence'  // Speech recognized but below threshold
  | 'mic_no_speech'       // Silence timeout
  | 'mic_error'           // Browser/permission error
  | 'mic_cancelled'       // User cancelled during listening
  | 'preview_accepted'    // User sent the transcript as-is
  | 'preview_edited'      // User chose to edit before sending
  | 'preview_retried'     // User chose to try again
  | 'fallback_chip_used'  // User tapped a fallback chip
  | 'fallback_type_used'  // User switched to typing from error state
  | 'tts_played'          // Maya voice played (manual or auto)
  | 'tts_auto_toggled'    // User toggled auto-play
  | 'text_sent';          // User sent via text input (baseline)

export interface VoiceEvent {
  type: VoiceEventType;
  timestamp: number;
  /** ASR confidence when available */
  confidence?: number;
  /** Word count of transcript */
  wordCount?: number;
  /** Session turn number */
  turnNumber?: number;
}

// ═══════════════════════════════════════════════════════════════
// In-memory accumulator (per session)
// ═══════════════════════════════════════════════════════════════

let events: VoiceEvent[] = [];

export function trackVoiceEvent(
  type: VoiceEventType,
  meta?: Partial<Omit<VoiceEvent, 'type' | 'timestamp'>>
): void {
  const event: VoiceEvent = {
    type,
    timestamp: Date.now(),
    ...meta,
  };
  events.push(event);

  if (import.meta.env.DEV) {
    console.debug('[VoiceTelemetry]', type, meta ?? '');
  }
}

// ═══════════════════════════════════════════════════════════════
// Session summary — compute at session end
// ═══════════════════════════════════════════════════════════════

export interface VoiceSessionSummary {
  totalTurns: number;
  voiceTurns: number;
  textTurns: number;
  /** voice / (voice + text) */
  voiceAdoptionRate: number;
  micStarts: number;
  micSuccesses: number;
  /** success / starts */
  recognitionSuccessRate: number;
  previewAccepted: number;
  previewEdited: number;
  previewRetried: number;
  /** accepted / (accepted + edited + retried) */
  firstAttemptAcceptRate: number;
  fallbackChipsUsed: number;
  fallbackTypeUsed: number;
  ttsPlays: number;
  avgConfidence: number | null;
}

export function getVoiceSessionSummary(): VoiceSessionSummary {
  const count = (t: VoiceEventType) => events.filter(e => e.type === t).length;

  const micStarts = count('mic_start');
  const micSuccesses = count('mic_success');
  const accepted = count('preview_accepted');
  const edited = count('preview_edited');
  const retried = count('preview_retried');
  const textSent = count('text_sent');
  const voiceTurns = accepted + count('fallback_chip_used');
  const totalTurns = voiceTurns + textSent;

  const confidences = events
    .filter(e => e.confidence != null)
    .map(e => e.confidence!);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : null;

  const previewTotal = accepted + edited + retried;

  return {
    totalTurns,
    voiceTurns,
    textTurns: textSent,
    voiceAdoptionRate: totalTurns > 0 ? voiceTurns / totalTurns : 0,
    micStarts,
    micSuccesses,
    recognitionSuccessRate: micStarts > 0 ? micSuccesses / micStarts : 0,
    previewAccepted: accepted,
    previewEdited: edited,
    previewRetried: retried,
    firstAttemptAcceptRate: previewTotal > 0 ? accepted / previewTotal : 0,
    fallbackChipsUsed: count('fallback_chip_used'),
    fallbackTypeUsed: count('fallback_type_used'),
    ttsPlays: count('tts_played'),
    avgConfidence,
  };
}

export function clearVoiceEvents(): void {
  events = [];
}

export function getVoiceEvents(): VoiceEvent[] {
  return [...events];
}

// ═══════════════════════════════════════════════════════════════
// Persistence — write summary to Supabase
// ═══════════════════════════════════════════════════════════════

export async function persistVoiceSessionSummary(
  userId: string,
  sessionId: string | null,
  topicId: string | null,
): Promise<boolean> {
  const summary = getVoiceSessionSummary();
  
  // Don't persist empty sessions
  if (summary.totalTurns === 0 && summary.micStarts === 0) return false;

  try {
    const { error } = await supabase.from('voice_session_summaries' as any).insert({
      user_id: userId,
      session_id: sessionId,
      topic_id: topicId,
      total_turns: summary.totalTurns,
      voice_turns: summary.voiceTurns,
      text_turns: summary.textTurns,
      voice_adoption_rate: summary.voiceAdoptionRate,
      mic_starts: summary.micStarts,
      mic_successes: summary.micSuccesses,
      recognition_success_rate: summary.recognitionSuccessRate,
      avg_confidence: summary.avgConfidence,
      preview_accepted: summary.previewAccepted,
      preview_edited: summary.previewEdited,
      preview_retried: summary.previewRetried,
      first_attempt_accept_rate: summary.firstAttemptAcceptRate,
      fallback_chips_used: summary.fallbackChipsUsed,
      fallback_type_used: summary.fallbackTypeUsed,
      tts_plays: summary.ttsPlays,
    });

    if (error) {
      console.warn('[VoiceTelemetry] Persist failed:', error.message);
      return false;
    }

    if (import.meta.env.DEV) {
      console.debug('[VoiceTelemetry] Session persisted:', {
        voiceAdoption: `${(summary.voiceAdoptionRate * 100).toFixed(0)}%`,
        recognitionSuccess: `${(summary.recognitionSuccessRate * 100).toFixed(0)}%`,
        firstAccept: `${(summary.firstAttemptAcceptRate * 100).toFixed(0)}%`,
      });
    }

    return true;
  } catch (err) {
    console.warn('[VoiceTelemetry] Unexpected error:', err);
    return false;
  }
}
