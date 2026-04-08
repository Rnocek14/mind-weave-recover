/**
 * Speech State Classifier
 * 
 * Real-time classification of what the user is doing while speaking.
 * Rule-based — no ML. Designed for aphasia rehab where:
 * - struggling is normal and should be supported, not penalized
 * - silence means "thinking", not "failed"
 * - reading the prompt aloud is not an answer
 * 
 * Used by speech timing/submission logic to decide:
 * - when to wait longer
 * - when to finalize
 * - when to nudge
 */

// ─── Speech States ───────────────────────────────────────────

export type SpeechState =
  | 'silence'       // No input at all
  | 'struggling'    // Fillers, restarts, fragments — user is trying
  | 'reading'       // Echoing prompt/instructions back
  | 'answering'     // Producing goal-directed speech
  | 'complete';     // Finished thought, ready to finalize

export interface SpeechStateResult {
  state: SpeechState;
  confidence: 'high' | 'medium' | 'low';
  /** Recommended silence threshold multiplier (1.0 = default, 2.0 = double patience) */
  patienceMultiplier: number;
  /** Whether to suppress auto-submission right now */
  suppressAutoSubmit: boolean;
  /** Optional nudge hint (null = no nudge appropriate) */
  nudgeHint: string | null;
  /** Debug reasons */
  reasons: string[];
}

// ─── Detection patterns ─────────────────────────────────────

const FILLED_PAUSES = /\b(um+|uh+|er+|ah+|hmm+|eh+)\b/gi;
const RESTART_PATTERNS = /\b(the|a|i|it|wait|no)\b.*\b(the|a|i|it|wait|no)\b/i;
const FRAGMENT_PATTERN = /^(\w{1,3}\s){0,2}\w{1,4}$/; // very short fragments

// Similarity threshold for "reading the prompt"
const READING_SIMILARITY_THRESHOLD = 0.7;

// ─── Helpers ─────────────────────────────────────────────────

function countFillers(text: string): number {
  return (text.match(FILLED_PAUSES) || []).length;
}

function hasRestarts(text: string): boolean {
  return RESTART_PATTERNS.test(text);
}

function getWordRate(wordCount: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (wordCount / elapsedMs) * 60000; // words per minute
}

/**
 * Simple normalized overlap for detecting prompt echo.
 * Not Levenshtein — just word overlap ratio.
 */
function promptSimilarity(transcript: string, prompt: string): number {
  if (!prompt || !transcript) return 0;
  const tWords = new Set(transcript.toLowerCase().split(/\s+/).filter(Boolean));
  const pWords = prompt.toLowerCase().split(/\s+/).filter(Boolean);
  if (pWords.length === 0) return 0;
  let matches = 0;
  for (const w of pWords) {
    if (tWords.has(w)) matches++;
  }
  return matches / pWords.length;
}

// ─── Main Classifier ────────────────────────────────────────

export interface ClassifySpeechStateInput {
  /** Current transcript (may be interim) */
  transcript: string;
  /** Time since speech/listening started (ms) */
  elapsedMs: number;
  /** Time since last transcript update (ms) — proxy for current silence */
  silenceDurationMs: number;
  /** The prompt/target text the user is responding to (for reading detection) */
  promptText?: string;
  /** Whether the browser flagged the transcript as final */
  isFinal?: boolean;
}

export function classifySpeechState(input: ClassifySpeechStateInput): SpeechStateResult {
  const { transcript, elapsedMs, silenceDurationMs, promptText, isFinal } = input;
  const cleaned = (transcript || '').trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const reasons: string[] = [];

  // ── 1. Silence ──────────────────────────────────────────
  if (wordCount === 0) {
    const longSilence = silenceDurationMs > 3000;
    return {
      state: 'silence',
      confidence: 'high',
      patienceMultiplier: 2.5,
      suppressAutoSubmit: true,
      nudgeHint: longSilence ? 'take_your_time' : null,
      reasons: ['No words detected'],
    };
  }

  // ── 2. Reading / echoing prompt ─────────────────────────
  if (promptText && wordCount >= 2) {
    const similarity = promptSimilarity(cleaned, promptText);
    if (similarity >= READING_SIMILARITY_THRESHOLD) {
      reasons.push(`Prompt echo: ${(similarity * 100).toFixed(0)}% word overlap`);
      return {
        state: 'reading',
        confidence: similarity > 0.85 ? 'high' : 'medium',
        patienceMultiplier: 1.5,
        suppressAutoSubmit: true,
        nudgeHint: 'try_own_words',
        reasons,
      };
    }
  }

  // ── 3. Struggling ───────────────────────────────────────
  const fillerCount = countFillers(cleaned);
  const hasRestart = hasRestarts(cleaned);
  const isFragment = wordCount <= 2 && FRAGMENT_PATTERN.test(cleaned);
  const wordRate = getWordRate(wordCount, elapsedMs);
  const verySlowRate = wordRate > 0 && wordRate < 30; // <30 wpm = very slow
  
  const struggleSignals = [
    fillerCount >= 2,
    hasRestart,
    isFragment && elapsedMs > 2000, // fragment after 2s = searching
    verySlowRate && wordCount >= 2,
    fillerCount >= 1 && wordCount <= 3,
  ].filter(Boolean).length;

  if (struggleSignals >= 2) {
    reasons.push(`Struggle signals: ${struggleSignals} (fillers=${fillerCount}, restart=${hasRestart}, slow=${verySlowRate})`);
    return {
      state: 'struggling',
      confidence: struggleSignals >= 3 ? 'high' : 'medium',
      patienceMultiplier: 2.0,
      suppressAutoSubmit: true,
      nudgeHint: silenceDurationMs > 4000 ? 'describe_it' : null,
      reasons,
    };
  }

  // Single filler + short = mild struggle
  if (fillerCount >= 1 && wordCount <= 2 && !isFinal) {
    reasons.push('Mild struggle: filler + short');
    return {
      state: 'struggling',
      confidence: 'low',
      patienceMultiplier: 1.5,
      suppressAutoSubmit: true,
      nudgeHint: null,
      reasons,
    };
  }

  // ── 4. Complete ─────────────────────────────────────────
  // Final transcript from browser = definitive completion signal
  if (isFinal && wordCount >= 1) {
    reasons.push('Browser flagged final');
    return {
      state: 'complete',
      confidence: 'high',
      patienceMultiplier: 0.5, // can finalize quickly
      suppressAutoSubmit: false,
      nudgeHint: null,
      reasons,
    };
  }

  // Long enough with silence = likely done
  if (wordCount >= 3 && silenceDurationMs > 800) {
    reasons.push(`${wordCount} words + ${silenceDurationMs}ms silence`);
    return {
      state: 'complete',
      confidence: 'medium',
      patienceMultiplier: 0.8,
      suppressAutoSubmit: false,
      nudgeHint: null,
      reasons,
    };
  }

  // Single word with long silence = likely their answer
  if (wordCount >= 1 && silenceDurationMs > 1500) {
    reasons.push(`Short answer + ${silenceDurationMs}ms silence`);
    return {
      state: 'complete',
      confidence: 'low',
      patienceMultiplier: 1.0,
      suppressAutoSubmit: false,
      nudgeHint: null,
      reasons,
    };
  }

  // ── 5. Answering (default active state) ─────────────────
  reasons.push('Active speech in progress');
  return {
    state: 'answering',
    confidence: 'medium',
    patienceMultiplier: 1.0,
    suppressAutoSubmit: wordCount < 2, // don't submit single mid-word
    nudgeHint: null,
    reasons,
  };
}

// ─── Nudge messages ─────────────────────────────────────────
// Kept separate so UI layer can style them independently

export const NUDGE_MESSAGES: Record<string, string> = {
  take_your_time: "Take your time…",
  describe_it: "Try describing it",
  try_own_words: "Try in your own words",
  start_with: "Start with the first sound…",
};
