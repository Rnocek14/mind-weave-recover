/**
 * Multi-Step Planning — conservative, auditable planning-order evidence.
 *
 * Coverage (scoreExplanation) and sequence order are separate heuristics.
 * The old sequence loop iterated in KEY-STEP order, so it credited any two
 * recognized concepts as perfectly ordered even if the patient reversed them.
 * Use their observed positions in the actual answer and the supplied
 * idealOrder permutation. Ambiguous keyword overlap abstains from sequence
 * judgment rather than guessing a patient's executive-function performance.
 */
import type { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';

export type PlanningInputMode = 'spoken' | 'typed' | 'none';
export type PlanningCompletionReason = 'completed' | 'skipped';
export type PlanningSequenceMethod = 'distinctive_tokens_v1';

export interface PlanningSequenceEvidence {
  sequenceScore: number;
  sequenceEvidenceAvailable: boolean;
  matchedStepCount: number;
  matchedStepIndices: number[];
  sequenceMethod: PlanningSequenceMethod;
}

const WEAK_TOKENS = new Set([
  'the', 'and', 'for', 'then', 'with', 'from', 'into', 'onto', 'that', 'this',
  'your', 'some', 'they', 'them', 'over', 'after', 'before', 'first', 'next',
  'last', 'once', 'when', 'will', 'would', 'should', 'could', 'also', 'each',
  'get', 'put', 'add', 'make', 'take', 'use', 'have', 'need', 'them', 'just',
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().normalize('NFKC').match(/[a-z0-9]+/g) ?? []);
}

function findPhrase(tokens: string[], phrase: string[]): number {
  if (!phrase.length) return -1;
  for (let i = 0; i <= tokens.length - phrase.length; i++) {
    if (phrase.every((token, j) => tokens[i + j] === token)) return i;
  }
  return -1;
}

/**
 * A conservative lexical order signal, not a clinician-adjudicated score.
 * Prefer exact step phrases. Otherwise use ONLY distinctive keywords unique
 * to that stimulus step, never one shared between two steps (e.g. "water"
 * in both "boil water" and "pour water").
 *
 * A missing anchor = unknown, not zero cognitive ability.
 */
export function scorePlanningSequence(
  transcript: string,
  keySteps: string[],
  idealOrder: number[],
): PlanningSequenceEvidence {
  const none: PlanningSequenceEvidence = {
    sequenceScore: 0,
    sequenceEvidenceAvailable: false,
    matchedStepCount: 0,
    matchedStepIndices: [],
    sequenceMethod: 'distinctive_tokens_v1',
  };
  if (!transcript?.trim() || keySteps.length < 2 ||
      idealOrder.length !== keySteps.length ||
      new Set(idealOrder).size !== keySteps.length ||
      idealOrder.some(index => !Number.isInteger(index) || index < 0 || index >= keySteps.length)) {
    return none;
  }
  const words = tokenize(transcript);
  if (!words.length) return none;
  const stepTokens = keySteps.map(tokenize);
  const occurrences = new Map<string, number>();
  for (const tokens of stepTokens) {
    for (const token of new Set(tokens)) {
      if (token.length >= 3 && !WEAK_TOKENS.has(token)) {
        occurrences.set(token, (occurrences.get(token) ?? 0) + 1);
      }
    }
  }
  const observed = stepTokens.flatMap((tokens, stepIndex) => {
    const phrasePos = findPhrase(words, tokens);
    if (phrasePos >= 0) return [{ stepIndex, position: phrasePos }];
    const uniqueWords = tokens.filter(token =>
      token.length >= 3 &&
      !WEAK_TOKENS.has(token) &&
      occurrences.get(token) === 1
    );
    const positions = uniqueWords.map(t => words.indexOf(t)).filter(i => i >= 0);
    if (!positions.length) return [];
    return [{ stepIndex, position: Math.min(...positions) }];
  });
  if (observed.length < 2) {
    return { ...none, matchedStepCount: observed.length, matchedStepIndices: observed.map(m => m.stepIndex) };
  }
  // Two distinct steps resolving to one transcript token/position are NOT
  // independent order observations. Do not assign them a synthetic order.
  if (new Set(observed.map(o => o.position)).size !== observed.length) {
    return { ...none, matchedStepCount: observed.length, matchedStepIndices: observed.map(m => m.stepIndex) };
  }
  observed.sort((a, b) => a.position - b.position);
  const idealRank = new Map(idealOrder.map((step, rank) => [step, rank]));
  let ordered = 0;
  let pairs = 0;
  for (let i = 0; i < observed.length; i++) {
    for (let j = i + 1; j < observed.length; j++) {
      pairs++;
      if ((idealRank.get(observed[i].stepIndex) ?? Infinity) <
          (idealRank.get(observed[j].stepIndex) ?? -Infinity)) ordered++;
    }
  }
  return {
    sequenceScore: pairs ? ordered / pairs : 0,
    sequenceEvidenceAvailable: pairs > 0,
    matchedStepCount: observed.length,
    matchedStepIndices: observed.map(o => o.stepIndex),
    sequenceMethod: 'distinctive_tokens_v1',
  };
}

export interface PlanningRoundEvidence {
  /** The existing game success criterion, not a new clinical cut-off. */
  practiceSuccessful: boolean;
  trialMode: 'production' | 'mixed';
  clinicalProgressionEligible: boolean;
  requiredGoalCoverage: 0.6;
  requiredSequenceScore: 0.5;
}

/**
 * The browser's recognized transcript is provisional. This contract ensures
 * typed/skipped/invalid/unresolved output cannot inflate expressive mastery,
 * clinical progression, or in-game speech adaptation.
 */
export function classifyPlanningRoundEvidence(result: PlanningTrialResult): PlanningRoundEvidence {
  const numericalEvidence =
    Number.isFinite(result.goalCoverage) && result.goalCoverage >= 0 && result.goalCoverage <= 1 &&
    Number.isFinite(result.sequenceScore) && result.sequenceScore >= 0 && result.sequenceScore <= 1;
  const valid = numericalEvidence && result.responseValid === true && !result.skipped;
  const clinicalProgressionEligible = valid &&
    result.inputMode === 'spoken' &&
    result.completionReason === 'completed' &&
    result.sequenceEvidenceAvailable === true &&
    result.sequenceMatchedSteps >= 2 &&
    !!result.transcript?.trim();
  const practiceSuccessful = valid &&
    result.sequenceEvidenceAvailable === true &&
    result.goalCoverage >= 0.6 &&
    result.sequenceScore >= 0.5;
  return {
    practiceSuccessful,
    trialMode: clinicalProgressionEligible ? 'production' : 'mixed',
    clinicalProgressionEligible,
    requiredGoalCoverage: 0.6,
    requiredSequenceScore: 0.5,
  };
}
