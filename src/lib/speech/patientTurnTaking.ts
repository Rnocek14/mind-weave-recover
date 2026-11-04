/**
 * Patient-paced end-of-turn policy for aphasia speech exercises.
 *
 * A browser SpeechRecognition "final" result ends one ASR segment, not
 * necessarily the patient's answer. Silence is also not a failure signal.
 * These are conservative product defaults for engineering validation, NOT
 * clinical timing thresholds. Never use this policy to assign correctness.
 */
import { detectUtteranceComplete } from '@/lib/completionDetector';

export type PatientSpeechTask =
  | 'photo_naming'
  | 'two_clues'
  | 'thought_continuation'
  | 'describe_guess'
  | 'narrative_retell';

interface TurnTiming {
  baseMs: number;
  incompleteMs: number;
  maxMs: number;
}

const TIMING: Record<PatientSpeechTask, TurnTiming> = {
  photo_naming: { baseMs: 4_000, incompleteMs: 4_000, maxMs: 8_000 },
  two_clues: { baseMs: 5_500, incompleteMs: 5_500, maxMs: 10_000 },
  thought_continuation: { baseMs: 9_000, incompleteMs: 11_500, maxMs: 15_000 },
  describe_guess: { baseMs: 9_000, incompleteMs: 11_000, maxMs: 15_000 },
  narrative_retell: { baseMs: 12_000, incompleteMs: 14_000, maxMs: 18_000 },
};

/**
 * An explicit trailing connector/filler is a reason to keep listening,
 * not to automatically mark the response wrong or unfinished.
 */
export function isExplicitlyUnfinishedSpeech(transcript: string): boolean {
  return detectUtteranceComplete(transcript).reasons.includes('Trailing off pattern detected');
}

/** At most six in-session, observed *between-speech* pauses. No patient ID/data is stored. */
export interface PatientPauseHistory {
  lastTranscript: string;
  lastUpdateMs: number | null;
  pausesMs: number[];
}

export function createPatientPauseHistory(): PatientPauseHistory {
  return { lastTranscript: '', lastUpdateMs: null, pausesMs: [] };
}

/** Start the next item with a clean transcript clock, retaining recent pacing samples. */
export function resetPatientPauseHistory(history: PatientPauseHistory): PatientPauseHistory {
  return { ...history, lastTranscript: '', lastUpdateMs: null };
}

/**
 * Learn only when NEW words arrive after an observed pause. A long period
 * without any recognition data cannot be presumed to mean patient silence.
 * Interim ASR rewrites are not reliable evidence of a real pause.
 */
export function observePatientSpeech(
  history: PatientPauseHistory,
  transcript: string,
  nowMs: number,
): PatientPauseHistory {
  const text = transcript.trim();
  if (!text) return resetPatientPauseHistory(history);
  if (text === history.lastTranscript) return history;

  const previous = history.lastTranscript;
  const isGrowth = previous.length > 0 &&
    text.length > previous.length &&
    text.toLowerCase().startsWith(previous.toLowerCase());
  const elapsed = history.lastUpdateMs === null ? 0 : nowMs - history.lastUpdateMs;
  const observedPause = isGrowth && elapsed >= 900 && elapsed <= 16_000;

  return {
    lastTranscript: text,
    lastUpdateMs: nowMs,
    pausesMs: observedPause ? [...history.pausesMs, elapsed].slice(-6) : history.pausesMs,
  };
}

/**
 * The observed longest recent pause extends, never shortens, the base window.
 * A trailing incomplete sentence gets extra time in discourse tasks, but a
 * one-word naming answer is not penalized for lacking sentence structure.
 */
export function getPatientTurnSilenceMs(
  task: PatientSpeechTask,
  transcript: string,
  pausesMs: readonly number[] = [],
): number {
  const timing = TIMING[task];
  const isDiscourse = task === 'thought_continuation' ||
    task === 'describe_guess' ||
    task === 'narrative_retell';
  const incomplete = isDiscourse && !detectUtteranceComplete(transcript).isComplete;
  const observedMax = pausesMs.reduce((max, ms) =>
    Number.isFinite(ms) && ms > 0 ? Math.max(max, ms) : max, 0);

  return Math.min(
    timing.maxMs,
    Math.max(timing.baseMs, incomplete ? timing.incompleteMs : 0, observedMax + 2_500),
  );
}
