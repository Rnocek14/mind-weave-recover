/**
 * Speech Timing Profiles
 * 
 * Per-exercise-type timing configs for adaptive speech detection.
 * These are the tuned defaults — not universal constants.
 * 
 * Profile types:
 * - short_answer: Photo Naming, Two Clues, Fix Sentence, Phrase Practice
 * - discourse: Describe & Guess, VoicePractice, Conversation Partner
 * - cognitive_discourse: Abstract Compare, Multi-Step Planning, Narrative Retell
 * - fluency_stream: Category Fluency, Synonym Generator (timer-driven, not silence-driven)
 */

export interface SpeechTimingProfile {
  /** Profile identifier */
  type: 'short_answer' | 'discourse' | 'cognitive_discourse' | 'fluency_stream';
  /** Base silence threshold before considering finalization (ms) */
  baseSilenceMs: number;
  /** Minimum words before auto-submit is even considered */
  minWordsForSubmit: number;
  /** Patience multipliers per speech state (override defaults) */
  patienceMultipliers: {
    complete: number;
    answering: number;
    struggling_mild: number;
    struggling_strong: number;
    silence: number;
  };
  /** When to show first nudge (ms of qualifying silence) */
  nudgeDelayMs: number;
  /** Reading similarity threshold (higher = stricter detection) */
  readingSimilarityThreshold: number;
}

export const TIMING_PROFILES: Record<SpeechTimingProfile['type'], SpeechTimingProfile> = {
  short_answer: {
    type: 'short_answer',
    baseSilenceMs: 1200,
    minWordsForSubmit: 1,
    patienceMultipliers: {
      complete: 0.5,       // 600ms
      answering: 1.0,      // 1200ms
      struggling_mild: 1.4, // 1680ms
      struggling_strong: 2.0, // 2400ms
      silence: 2.2,        // 2640ms
    },
    nudgeDelayMs: 3000,
    readingSimilarityThreshold: 0.75,
  },
  discourse: {
    type: 'discourse',
    baseSilenceMs: 1800,
    minWordsForSubmit: 2,
    patienceMultipliers: {
      complete: 0.6,       // 1080ms
      answering: 1.0,      // 1800ms
      struggling_mild: 1.4, // 2520ms
      struggling_strong: 1.8, // 3240ms
      silence: 2.2,        // 3960ms
    },
    nudgeDelayMs: 4000,
    readingSimilarityThreshold: 0.65,
  },
  cognitive_discourse: {
    type: 'cognitive_discourse',
    baseSilenceMs: 2200,
    minWordsForSubmit: 2,
    patienceMultipliers: {
      complete: 0.6,       // 1320ms
      answering: 1.0,      // 2200ms
      struggling_mild: 1.4, // 3080ms
      struggling_strong: 1.8, // 3960ms
      silence: 2.0,        // 4400ms
    },
    nudgeDelayMs: 4500,
    readingSimilarityThreshold: 0.65,
  },
  fluency_stream: {
    type: 'fluency_stream',
    baseSilenceMs: 3000,
    minWordsForSubmit: 1,
    patienceMultipliers: {
      complete: 1.0,       // 3000ms — never rush between items
      answering: 1.0,      // 3000ms
      struggling_mild: 1.0, // 3000ms — pauses are normal in listing
      struggling_strong: 1.7, // 5100ms
      silence: 1.5,        // 4500ms
    },
    nudgeDelayMs: 4500,
    readingSimilarityThreshold: 0.75,
  },
};

/**
 * Get the effective patience multiplier from a profile, 
 * mapping SpeechState + confidence to the right multiplier.
 */
export function getProfileMultiplier(
  profile: SpeechTimingProfile,
  state: string,
  confidence: string,
): number {
  const m = profile.patienceMultipliers;
  switch (state) {
    case 'complete': return m.complete;
    case 'answering': return m.answering;
    case 'struggling':
      return confidence === 'high' || confidence === 'medium'
        ? m.struggling_strong
        : m.struggling_mild;
    case 'silence': return m.silence;
    case 'reading': return m.silence; // reading = suppress, but if somehow checked
    default: return m.answering;
  }
}
