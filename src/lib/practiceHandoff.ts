/**
 * Safe, presentation-only handoff from completed game results to Maya's
 * optional practice queue. No score, mastery, level or utterance metric is
 * altered by these helpers.
 *
 * Only known lexical targets are admitted. Free-form user responses, fuzzy
 * semantic guesses, skipped trials and unfinished multi-error repairs are not
 * converted into "successful words." Long phrases require a separate
 * conversation task and are deliberately excluded from this word review.
 */
import type { TwoCluesTrialResult } from "@/hooks/useTwoCluesGame";
import type { FixSentenceTrialResult } from "@/hooks/useFixSentenceGame";
import { recordPracticedWord } from "./reviewQueue";

function safeSingleWord(word: string | null | undefined): string | null {
  if (typeof word !== "string") return null;
  const candidate = word.trim().toLowerCase();
  return /^[a-z][a-z'-]{1,59}$/.test(candidate) ? candidate : null;
}

/** Two Clues can match several valid answers; use the matched lexical item. */
export function handoffTwoCluesPractice(
  result: Pick<TwoCluesTrialResult, "tier" | "matchedWord" | "attemptNumber">,
  sessionId: string | null,
): boolean {
  if (!sessionId || result.attemptNumber < 1 ||
      (result.tier !== "strong" && result.tier !== "related")) return false;
  const word = safeSingleWord(result.matchedWord);
  if (!word) return false;
  // "Struggled" prioritizes later review, not clinical accuracy.
  return recordPracticedWord(word, "generic",
    result.attemptNumber > 1,
    { sessionId, sourceGame: "two_clues", responseMode: "unknown" },
  );
}

/** Fix the Sentence has real accepted fixes; never queue an unverified guess. */
export function handoffFixSentencePractice(
  result: Pick<FixSentenceTrialResult,
    "matchedFix" | "isCorrect" | "isPartialCredit" | "phaseAdvance" | "attemptNumber" | "support"
  >,
  sessionId: string | null,
): boolean {
  if (!sessionId || result.phaseAdvance ||
      (!result.isCorrect && !result.isPartialCredit)) return false;
  const word = safeSingleWord(result.matchedFix);
  if (!word) return false;
  return recordPracticedWord(word, "generic",
    !result.isCorrect || result.attemptNumber > 1,
    {
      sessionId,
      sourceGame: "fix_sentence",
      responseMode: result.support === "highlight_plus_choice" || result.support === "choice_based"
        ? "selection" : "unknown",
    },
  );
}
