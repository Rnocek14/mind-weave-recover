/**
 * Dual-Load Naming: coherent mixed cognitive/linguistic practice evidence.
 *
 * The spoken picture-naming phase is followed by TYPED memory recall.
 * Even a successful dual-task round is therefore not an independent spoken
 * communication outcome. The game-specific clinical ladder may use complete
 * scorable attempts; the global expressive-mastery stream must not.
 *
 * Preserve the EXISTING 0.60 naming / 0.67 recall implementation gates
 * until an SLP reviews the progression rules and whether 2/3 vs .67
 * should be the intended recall boundary. Never invent a new cutoff here.
 */
import { isFillerOnly } from '@/lib/clinical/classifyUtteranceValidity';

export interface DualLoadNamingEvidenceInput {
  namingAccuracy: number;
  recallAccuracy: number;
  namingAttempts: Array<{
    targetWord: string;
    userResponse: string;
    correct: boolean;
  }>;
}

export const DUAL_LOAD_NAMING_GATE = 0.6;
export const DUAL_LOAD_RECALL_GATE = 0.67;

export interface DualLoadNamingEvidence {
  /** Same combined threshold already used by the in-game adaptation path. */
  practiceSuccessful: boolean;
  /** Because recall is typed, this is NEVER pure expressive output. */
  trialMode: 'mixed';
  /** Eligible for its own mixed dual-load clinical ladder, not speech mastery. */
  clinicalProgressionEligible: boolean;
  /** Separate from mixed-domain practice or game-specific progression. */
  verifiedExpressiveMasteryEligible: false;
  recallInputMode: 'typed';
  namingInputMode: 'spoken' | 'incomplete';
  scorableSpokenNamingAttempts: number;
  unscorableReason: 'invalid_metrics' | 'naming_attempts_unavailable' | 'missing_or_filler_speech' | 'inconsistent_naming_score' | null;
}

export function evaluateDualLoadNamingEvidence(input: DualLoadNamingEvidenceInput): DualLoadNamingEvidence {
  const metricsValid =
    Number.isFinite(input.namingAccuracy) && input.namingAccuracy >= 0 && input.namingAccuracy <= 1 &&
    Number.isFinite(input.recallAccuracy) && input.recallAccuracy >= 0 && input.recallAccuracy <= 1;
  const attempts = Array.isArray(input.namingAttempts) ? input.namingAttempts : [];
  const scorableSpokenNamingAttempts = attempts.filter(a =>
    typeof a.userResponse === 'string' &&
    a.userResponse.trim().length > 0 && !isFillerOnly(a.userResponse),
  ).length;
  const allSpeechScorable = attempts.length > 0 &&
    scorableSpokenNamingAttempts === attempts.length;
  const observedAccuracy = attempts.length > 0
    ? attempts.filter(a => a.correct).length / attempts.length
    : null;
  // Prevent a malformed game result from claiming high clinical accuracy
  // when its own recorded naming outcomes say otherwise.
  const scoreConsistent = observedAccuracy !== null && Number.isFinite(input.namingAccuracy) &&
    Math.abs(observedAccuracy - input.namingAccuracy) < 0.001;

  const clinicalProgressionEligible = metricsValid && allSpeechScorable && scoreConsistent;
  const practiceSuccessful = metricsValid &&
    input.namingAccuracy >= DUAL_LOAD_NAMING_GATE &&
    input.recallAccuracy >= DUAL_LOAD_RECALL_GATE;

  let unscorableReason: DualLoadNamingEvidence['unscorableReason'] = null;
  if (!metricsValid) unscorableReason = 'invalid_metrics';
  else if (!attempts.length) unscorableReason = 'naming_attempts_unavailable';
  else if (!allSpeechScorable) unscorableReason = 'missing_or_filler_speech';
  else if (!scoreConsistent) unscorableReason = 'inconsistent_naming_score';

  return {
    practiceSuccessful,
    trialMode: 'mixed',
    clinicalProgressionEligible,
    verifiedExpressiveMasteryEligible: false,
    recallInputMode: 'typed',
    namingInputMode: allSpeechScorable ? 'spoken' : 'incomplete',
    scorableSpokenNamingAttempts,
    unscorableReason,
  };
}
