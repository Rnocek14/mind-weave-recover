/**
 * feedbackPolicy — Centralized rules so we never praise a low/zero performance.
 *
 * Clinical safety: every game that speaks a between-round line MUST route through
 * pickEncouragement(). This prevents Maya from saying "Good job!" on a 0/5 round,
 * which destroys patient trust and feels broken.
 *
 * Also exports isEmptyResponse() and EmptyResponseRepair messaging used by
 * timed/speech games when the patient produced nothing.
 */

export type FeedbackTone = 'praise' | 'neutral' | 'supportive';

export interface EncouragementInput {
  /** Normalized 0..1 score for the round, or null if not scorable */
  score?: number | null;
  /** Raw count of valid responses (used when score isn't known) */
  count?: number;
  /** Was the response effectively empty (no usable input)? */
  empty?: boolean;
  /** Optional short noun describing the activity, e.g. "animals", "answers" */
  unit?: string;
}

const PRAISE_THRESHOLD = 0.7;
const NEUTRAL_THRESHOLD = 0.4;

/**
 * Return a clinically-safe spoken line for between-round / end-of-round feedback.
 * NEVER praises an empty or low-performance round.
 */
export function pickEncouragement(input: EncouragementInput): { text: string; tone: FeedbackTone } {
  const { score, count, empty, unit } = input;

  // Empty response: always supportive, never praise.
  if (empty || count === 0) {
    return {
      text: `That one was tough. We'll try a different angle next.`,
      tone: 'supportive',
    };
  }

  // Single response — acknowledge effort, do not praise.
  if (count === 1) {
    return {
      text: unit
        ? `You got one ${unit.replace(/s$/, '')}. Let's try a different angle.`
        : `You got one. Let's try a different angle.`,
      tone: 'neutral',
    };
  }

  if (typeof score === 'number') {
    if (score >= PRAISE_THRESHOLD) {
      return { text: `Nice work — that one landed.`, tone: 'praise' };
    }
    if (score >= NEUTRAL_THRESHOLD) {
      return { text: `Solid effort. Keep going.`, tone: 'neutral' };
    }
    return { text: `That one was tricky. We'll keep working on it.`, tone: 'supportive' };
  }

  // Fallback when only count is known and > 1
  return {
    text: unit ? `You named ${count} ${unit}.` : `Good effort.`,
    tone: 'neutral',
  };
}

/** True when input is missing, whitespace, or filler-only. */
export function isEmptyResponse(text: string | null | undefined): boolean {
  if (!text) return true;
  const cleaned = text
    .toLowerCase()
    .replace(/\b(um+|uh+|er+|hmm+|like|you know)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return cleaned.length === 0;
}

/** Short repair line to show on screen / speak when patient produced nothing. */
export const EMPTY_REPAIR_LINE = "No worries — that one was tough. Let's try the next one.";
