/**
 * Canonical session accuracy reducer shared by browser session completion and
 * the privileged stale-session sweeper. PURE: no Supabase client, Deno globals,
 * access tokens, network calls, or runtime environment dependencies.
 *
 * "accuracy" preserves historical task-scoring semantics (recognition, speech,
 * and other scorable tasks). It is NOT evidence of ASR recognition quality.
 * "asr_accuracy" is narrowly the task correctness of speech attempts with an
 * explicit valid classifier verdict, ASR-eligible gate, AND saved transcript.
 * It is NOT WER/phoneme precision. Null means "not measured", never "0".
 *
 * This is a new-commit fix. Historic summaries remain unverified until an
 * explicitly reviewed, traceable migration; never silently rewrite patient data.
 */
export interface ScoredRow {
  score: number | null;
  cue_level: number | null;
  counts_toward_score: boolean | null;
  validity_label?: string | null;
  exercise_slug?: string | null;
  task_parameters?: Record<string, unknown> | null;
  engagement_flags?: Record<string, unknown> | null;
  whisper_transcript?: string | null;
  browser_transcript?: string | null;
}

export interface SessionAccuracySummary {
  /** Scored TASK accuracy (not necessarily speech recognition). */
  accuracy: number | null;
  /** Task accuracy without cues, excluding manual confirmations. */
  independent_accuracy: number | null;
  /** Task accuracy with cues, excluding manual confirmations. */
  cue_assisted_accuracy: number | null;
  /** Accuracy of only explicitly ASR-evidenced speech attempts; not ASR WER. */
  asr_accuracy: number | null;
  /** Practice accuracy including manually confirmed trials. */
  practice_accuracy: number | null;
  scored_trials: number;
  independent_trials: number;
  cue_assisted_trials: number;
  asr_scored_trials: number;
  manual_confirmed_trials: number;
  participation_trials: number;
}

const ACCURACY_EXCLUDED_SLUGS = new Set([
  'conversation_partner', 'conversation_coach', 'conversation_turn',
  'voice_practice',
]);

export const EMPTY_SESSION_ACCURACY: Readonly<SessionAccuracySummary> = {
  accuracy: null,
  independent_accuracy: null,
  cue_assisted_accuracy: null,
  asr_accuracy: null,
  practice_accuracy: null,
  scored_trials: 0,
  independent_trials: 0,
  cue_assisted_trials: 0,
  asr_scored_trials: 0,
  manual_confirmed_trials: 0,
  participation_trials: 0,
};

function hasAuditableSpeechEvidence(row: ScoredRow): boolean {
  // Do not conflate a tap/selection with audio even if the client provides
  // a generic score or a browser transcript from unrelated context.
  const mode = row.task_parameters?.trial_mode;
  if (['recognition', 'tap', 'manual', 'typing', 'selection'].includes(String(mode))) {
    return false;
  }
  if (row.validity_label !== 'valid_attempt') return false;
  // Explicit ASR-eligibility must be present, not guessed from a game slug
  // (legacy rows without provenance remain unmeasured on this axis).
  const gate = row.task_parameters?.speech_validity;
  const inTaskGate = gate && typeof gate === 'object'
    ? (gate as Record<string, unknown>).counts_toward_asr_accuracy === true
    : false;
  const inEventGate = row.engagement_flags?.counts_toward_asr_accuracy === true;
  if (!inTaskGate && !inEventGate) return false;
  // A validity label without a recorded recognized utterance is not proof
  // that an ASR system processed speech.
  return Boolean(
    (typeof row.whisper_transcript === 'string' && row.whisper_transcript.trim())
      || (typeof row.browser_transcript === 'string' && row.browser_transcript.trim()),
  );
}

/** One reducer for both the foreground session and Edge Function timeout path. */
export function reduceAccuracy(rows: ScoredRow[]): SessionAccuracySummary {
  const mean = (values: number[]): number | null =>
    values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
      : null;
  const excluded = (row: ScoredRow) =>
    typeof row.exercise_slug === 'string' && ACCURACY_EXCLUDED_SLUGS.has(row.exercise_slug);
  const manual = (row: ScoredRow) => row.validity_label === 'manual_confirmed';
  const hasScore = (row: ScoredRow) =>
    typeof row.score === 'number' && Number.isFinite(row.score);
  const scored = rows.filter(row =>
    hasScore(row) && row.counts_toward_score !== false && !manual(row) && !excluded(row)
  );
  const manualRows = rows.filter(row => hasScore(row) && manual(row) && !excluded(row));
  const all = scored.map(row => row.score as number);
  const independent = scored.filter(row => (row.cue_level ?? 0) === 0).map(row => row.score as number);
  const cued = scored.filter(row => (row.cue_level ?? 0) > 0).map(row => row.score as number);
  const speech = scored.filter(hasAuditableSpeechEvidence).map(row => row.score as number);
  return {
    accuracy: mean(all),
    independent_accuracy: mean(independent),
    cue_assisted_accuracy: mean(cued),
    asr_accuracy: mean(speech),
    practice_accuracy: mean([...all, ...manualRows.map(row => row.score as number)]),
    scored_trials: all.length,
    independent_trials: independent.length,
    cue_assisted_trials: cued.length,
    asr_scored_trials: speech.length,
    manual_confirmed_trials: manualRows.length,
    participation_trials: all.length + manualRows.length,
  };
}

/** Explicit nulls clear stale/cross-mode summary values upon recomputation. */
export function accuracySummaryToSummaryFields(
  summary: SessionAccuracySummary
): Record<string, number | null> {
  return {
    accuracy: summary.accuracy,
    independent_accuracy: summary.independent_accuracy,
    cue_assisted_accuracy: summary.cue_assisted_accuracy,
    asr_accuracy: summary.asr_accuracy,
    asr_scored_trials: summary.asr_scored_trials,
    practice_accuracy: summary.practice_accuracy,
    scored_trials: summary.scored_trials,
    manual_confirmed_trials: summary.manual_confirmed_trials,
    participation_trials: summary.participation_trials,
  };
}
