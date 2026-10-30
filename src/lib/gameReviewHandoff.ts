/**
 * Non-clinical handoff from completed word/semantic exercises to optional
 * conversational practice. Clinical event, adaptation and mastery writers
 * remain the source of truth; this ONLY selects safe follow-up prompts.
 *
 * Never infer spoken success from correctness, an ASR label, a button tap,
 * or a semantic-match score. Incomplete/unmatched/unknown prompts are not
 * offered as if their intended answer had been practiced.
 */
import { FIX_SENTENCE_BANK } from "@/data/fixSentenceBank";
import { TWO_CLUES_PUZZLES } from "@/data/twoCluesBank";
import type { TwoCluesTrialResult } from "@/hooks/useTwoCluesGame";
import type { FixSentenceTrialResult } from "@/hooks/useFixSentenceGame";
import { recordPracticedWord } from "./reviewQueue";

const MAX_TARGETS_PER_GAME = 8;
// Simple English lexical words and short nominal expressions. The review
// engine matches contiguous tokens (not semantic guesses or substrings).
const WORD_OR_SHORT_PHRASE = /^[a-z][a-z'-]*(?: [a-z][a-z'-]*){0,2}$/i;

function reviewableTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const target = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (target.length < 2 || target.length > 45) return null;
  return WORD_OR_SHORT_PHRASE.test(target) ? target : null;
}

const categoryMap: Record<string, string> = {
  animals: "animals", clothing: "clothing", nature: "nature", food: "food",
  home: "household", bathroom: "household", kitchen: "household",
  furniture: "household", household: "household",
  driving: "transportation", transportation: "transportation", transport: "transportation",
  weather: "nature", garden: "nature",
};

/**
 * Two Clues can accept a related answer as well as the intended anchor.
 * Queue ONLY the graph word that the scorer actually matched; do not
 * substitute an intended anchor or the raw ASR transcript if no graph match.
 */
export function recordTwoCluesReviewTargets(
  results: readonly TwoCluesTrialResult[],
  sessionId: string | null | undefined,
): number {
  if (!sessionId) return 0;
  let accepted = 0;
  for (const result of results) {
    if (accepted >= MAX_TARGETS_PER_GAME) break;
    if (result.tier !== "strong" && result.tier !== "related") continue;
    if (typeof result.spokenWord !== "string" || !result.spokenWord.trim()) continue;
    const target = reviewableTarget(result.matchedWord);
    if (!target) continue;
    // Semantic fallback scoring is NOT evidence of an explicitly matched
    // vocabulary item. Only pass through a canonical answer that actually
    // belongs to this puzzle's validated word graph and scoring tier.
    const puzzle = TWO_CLUES_PUZZLES.find((p) => p.id === result.puzzleId);
    if (!puzzle) continue;
    const candidateSet = result.tier === "strong" ? puzzle.anchors : puzzle.cluster;
    if (!candidateSet.some((word) => word.toLowerCase() === target)) continue;
    if (recordPracticedWord(target, categoryMap[puzzle.category] ?? "generic",
      result.attemptNumber > 1, {
      sessionId, sourceGame: "two_clues", responseMode: "unknown",
    })) accepted += 1;
  }
  return accepted;
}

/**
 * Fix Sentence has several clinically distinct task types. Only known
 * single-error LEXICAL replacement items with an explicit matched fix may
 * feed a word/phrase chat. Grammar inflections and two-error repairs need a
 * different task-specific transfer probe and are deliberately excluded.
 */
export function recordFixSentenceReviewTargets(
  results: readonly FixSentenceTrialResult[],
  sessionId: string | null | undefined,
): number {
  if (!sessionId) return 0;
  let accepted = 0;
  for (const result of results) {
    if (accepted >= MAX_TARGETS_PER_GAME) break;
    if (result.phaseAdvance || (!result.isCorrect && !result.isPartialCredit)) continue;
    const trial = FIX_SENTENCE_BANK.find((t) => t.id === result.trialId);
    if (!trial || trial.morphology || trial.secondError ||
      trial.errorType === "morphology_error") continue;
    const target = reviewableTarget(result.matchedFix);
    if (!target) continue;
    // Never turn an unapproved model/semantic match into a practice target.
    // Use only a canonical repair explicitly accepted by the originating
    // single-error lexical trial; no guesses from transcript length/similarity.
    if (!trial.acceptedFixes.some((candidate) => candidate.toLowerCase() === target)) continue;

    const selected = result.support === "choice_based" ||
      result.support === "highlight_plus_choice";
    if (recordPracticedWord(target, categoryMap[trial.category] ?? "generic",
      result.attemptNumber > 1 || result.isPartialCredit || result.selfCorrected || selected, {
        sessionId,
        sourceGame: "fix_sentence",
        responseMode: selected ? "selection" : "unknown",
      })) accepted += 1;
  }
  return accepted;
}
