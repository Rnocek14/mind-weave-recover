/**
 * adaptationNarrator — converts adaptation events into one-sentence patient-facing copy.
 *
 * Used by Maya in Full Coaching mode and shown as a quiet badge in Guided mode.
 * Suppressed entirely in Games Only mode.
 *
 * Tone: calm, supportive, purposeful. Never "let's reset", never celebratory on failure.
 */

export type AdaptationDirection = 'up' | 'down' | 'hold' | 'none';
export type AdaptationReasonKind =
  | 'fast_correct'
  | 'rolling_high'
  | 'frustration'
  | 'rolling_low'
  | 'cue_fade'
  | 'cue_dependency_hold'
  | 'plateau_novelty'
  | 'fatigue'
  | 'unknown';

export interface AdaptationNarrationInput {
  direction: AdaptationDirection;
  reasonKind: AdaptationReasonKind;
  /** Optional context for richer copy (not all reasons use it). */
  context?: {
    successRate?: number;
    cueLevel?: number;
  };
}

const COPY: Record<AdaptationDirection, Partial<Record<AdaptationReasonKind, string>>> = {
  up: {
    fast_correct: "You're getting these quickly — let's try a harder one.",
    rolling_high: "You're doing well. Stepping it up a little.",
    unknown: "Let's try one that's a bit more challenging.",
  },
  down: {
    frustration: "That one was tough. Here's a little more support.",
    rolling_low: "Let's try a different approach for the next one.",
    fatigue: "You've worked hard. The next one will be easier.",
    unknown: "Here's an easier one to keep us moving.",
  },
  hold: {
    cue_fade: "You're doing well with the hints. Let's try with fewer this time.",
    cue_dependency_hold: "Let's stay here a bit longer with less help.",
    unknown: "Holding steady — keep going.",
  },
  none: {
    plateau_novelty: "Let's try a different way to practice this.",
    unknown: "",
  },
};

export function narrateAdaptation(input: AdaptationNarrationInput): string {
  const bucket = COPY[input.direction] ?? {};
  return bucket[input.reasonKind] ?? bucket.unknown ?? '';
}

/**
 * Best-effort classifier from a free-text reason string emitted by the engine.
 * Keeps the narrator deterministic without forcing every callsite to pass a kind.
 */
export function classifyReason(reason: string | undefined): AdaptationReasonKind {
  if (!reason) return 'unknown';
  const r = reason.toLowerCase();
  if (r.includes('frustration')) return 'frustration';
  if (r.includes('fatigue')) return 'fatigue';
  if (r.includes('cue') && r.includes('fade')) return 'cue_fade';
  if (r.includes('cue') && (r.includes('dependency') || r.includes('hold'))) {
    return 'cue_dependency_hold';
  }
  if (r.includes('plateau') || r.includes('novelty')) return 'plateau_novelty';
  if (r.includes('increasing challenge') || r.includes('increasing')) return 'rolling_high';
  if (r.includes('providing support') || r.includes('reducing')) return 'rolling_low';
  if (r.includes('quick')) return 'fast_correct';
  return 'unknown';
}
