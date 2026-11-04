/**
 * Clinical task demands for the next three therapy games.
 *
 * The numbered stages are product defaults for therapist review, not
 * calibrated diagnostic scores. Each stage has a real content band AND a
 * different response demand. Do not equate a count of words or matched
 * keywords with validated discourse coherence.
 */
import type { SupportLevel } from './clinicalProgression';
import { trialCredit } from './clinicalProgression';

export type GradedTaskSlug = 'describe-guess' | 'abstract-compare' | 'thought-continuation';
export type ClinicalContentTier = 1 | 2 | 3;

export interface GradedTaskSpec {
  level: number;
  tier: ClinicalContentTier;
  description: string;
  objective: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  trialWeight: number;
  readiness: 'ready' | 'thin';
  contentSelector: { tierKey: string; description: string; implemented: true };
  /** Describe & Guess: count distinct feature TYPES actually spoken, not help chips. */
  spokenFeatureTarget?: number;
  maxPromptChips?: number;
  /** Abstract Comparison: number of separate shared properties to recall. */
  commonPropertyTarget?: number;
  /** Thought Continuation: word count is a measurable practice proxy, not coherence. */
  minResponseWords?: number;
  thoughtIntent?: string[];
  connectorRequired?: boolean;
  comparisonRequired?: boolean;
}

function stage(level: number, tier: ClinicalContentTier, objective: string,
  targetSupport: SupportLevel, extras: Partial<GradedTaskSpec> = {}): GradedTaskSpec {
  return {
    level, tier, description: objective, objective, targetSupport,
    minOnTargetAttempts: 3, minOnTargetAccuracy: 0.67,
    trialWeight: 0.7,
    readiness: level <= 5 ? 'ready' : 'thin',
    contentSelector: {
      tierKey: `tier_${tier}_level_${level}`,
      description: objective,
      implemented: true,
    },
    ...extras,
  };
}

// Each pair is (clinical level, bank tier, response demand), not a disguised
// generic 1-10 display level. Higher levels require less scaffold or more
// semantically distinct content.
export const DESCRIBE_GUESS_CLINICAL_LEVELS: Record<number, GradedTaskSpec> = {
  1: stage(1, 1, 'Describe one feature of a familiar item; prompts available', 'semantic_cue', { spokenFeatureTarget: 1, maxPromptChips: 3 }),
  2: stage(2, 1, 'Describe two different features of a familiar item', 'semantic_cue', { spokenFeatureTarget: 2, maxPromptChips: 3 }),
  3: stage(3, 1, 'Describe three different features of a familiar item', 'semantic_cue', { spokenFeatureTarget: 3, maxPromptChips: 2 }),
  4: stage(4, 2, 'Describe two different features of a less familiar item', 'semantic_cue', { spokenFeatureTarget: 2, maxPromptChips: 2 }),
  5: stage(5, 2, 'Describe three different features with minimal help', 'independent', { spokenFeatureTarget: 3, maxPromptChips: 0 }),
  6: stage(6, 3, 'Describe two features of a less imageable item without help', 'independent', { spokenFeatureTarget: 2, maxPromptChips: 0 }),
  7: stage(7, 3, 'Describe three features of a less imageable item without help', 'independent', { spokenFeatureTarget: 3, maxPromptChips: 0 }),
  8: stage(8, 3, 'Describe four distinct features without help on banked targets', 'independent', { spokenFeatureTarget: 4, maxPromptChips: 0 }),
};

export const ABSTRACT_COMPARE_CLINICAL_LEVELS: Record<number, GradedTaskSpec> = {
  1: stage(1, 1, 'Tell one way two familiar things are alike', 'independent', { commonPropertyTarget: 1 }),
  2: stage(2, 1, 'Tell two ways two familiar things are alike', 'independent', { commonPropertyTarget: 2 }),
  3: stage(3, 2, 'Tell one functional similarity for a cross-category pair', 'independent', { commonPropertyTarget: 1 }),
  4: stage(4, 2, 'Tell two functional similarities for a cross-category pair', 'independent', { commonPropertyTarget: 2 }),
  5: stage(5, 2, 'Tell three connections for a cross-category pair', 'independent', { commonPropertyTarget: 3 }),
  6: stage(6, 3, 'Tell one similarity for an abstract pair', 'independent', { commonPropertyTarget: 1 }),
  7: stage(7, 3, 'Tell two similarities for an abstract pair', 'independent', { commonPropertyTarget: 2 }),
  8: stage(8, 3, 'Tell three similarities for an abstract pair', 'independent', { commonPropertyTarget: 3 }),
};

export const THOUGHT_CONTINUATION_CLINICAL_LEVELS: Record<number, GradedTaskSpec> = {
  1: stage(1, 1, 'Share one real-life idea; one relevant word is enough', 'semantic_cue',
    { minResponseWords: 1, thoughtIntent: ['recall_recent', 'describe_event'] }),
  2: stage(2, 1, 'Continue a familiar thought with a short phrase', 'semantic_cue',
    { minResponseWords: 3, thoughtIntent: ['describe_event', 'express_opinion'] }),
  3: stage(3, 2, 'Give a little more detail about an everyday event', 'semantic_cue',
    { minResponseWords: 4, thoughtIntent: ['describe_event'] }),
  4: stage(4, 2, 'Explain an everyday reason using a linking word', 'independent',
    { minResponseWords: 5, connectorRequired: true, thoughtIntent: ['explain_reason'] }),
  5: stage(5, 2, 'Express a preference or feeling with more detail', 'independent',
    { minResponseWords: 6, thoughtIntent: ['describe_feeling', 'express_opinion'] }),
  6: stage(6, 3, 'Explain a reason in a reflective answer', 'independent',
    { minResponseWords: 8, connectorRequired: true, thoughtIntent: ['explain_reason'] }),
  7: stage(7, 3, 'Explain how to solve a hypothetical problem', 'independent',
    { minResponseWords: 10, thoughtIntent: ['solve_problem'], connectorRequired: true }),
  8: stage(8, 3, 'Compare alternatives in an extended reflective answer', 'independent',
    { minResponseWords: 12, thoughtIntent: ['compare_contrast'], comparisonRequired: true }),
};

export const GRADED_TASK_LEVELS: Record<GradedTaskSlug, Record<number, GradedTaskSpec>> = {
  'describe-guess': DESCRIBE_GUESS_CLINICAL_LEVELS,
  'abstract-compare': ABSTRACT_COMPARE_CLINICAL_LEVELS,
  'thought-continuation': THOUGHT_CONTINUATION_CLINICAL_LEVELS,
};

export function getGradedTaskSpec(slug: GradedTaskSlug, requestedLevel: number): GradedTaskSpec {
  const level = Math.min(8, Math.max(1, Math.round(requestedLevel || 1)));
  return GRADED_TASK_LEVELS[slug][level];
}

export type GradedClinicalTrial = {
  correct: boolean;
  support: SupportLevel;
};

export function isOnTargetGradedTrial(trial: GradedClinicalTrial, slug: GradedTaskSlug, level: number): boolean {
  const spec = getGradedTaskSpec(slug, level);
  return spec.targetSupport === 'independent'
    ? trial.support === 'independent'
    : trial.support === 'independent' || trial.support === 'semantic_cue';
}

export function gradedTaskEvidenceMet(trials: GradedClinicalTrial[], slug: GradedTaskSlug, level: number): boolean {
  const spec = getGradedTaskSpec(slug, level);
  const relevant = trials.filter(t => isOnTargetGradedTrial(t, slug, level));
  return relevant.length >= spec.minOnTargetAttempts &&
    relevant.filter(t => t.correct).length / relevant.length >= spec.minOnTargetAccuracy;
}

export function gradedTaskProgressDelta(trials: GradedClinicalTrial[], slug: GradedTaskSlug, level: number): number {
  const spec = getGradedTaskSpec(slug, level);
  return trials.reduce((sum, t) => sum + trialCredit(t), 0) / spec.trialWeight;
}

/** Clinical stage success is not the same as entertainment stars/participation. */
export function describeMeetsClinicalTarget(
  trial: { spokenFeatureTypes: readonly string[]; promptsShown: readonly string[] },
  level: number,
): boolean {
  const spec = getGradedTaskSpec('describe-guess', level);
  return new Set(trial.spokenFeatureTypes).size >= (spec.spokenFeatureTarget ?? 1) &&
    trial.promptsShown.length <= (spec.maxPromptChips ?? 3);
}

export function abstractMeetsClinicalTarget(
  trial: { conceptCount: number; skipped: boolean },
  level: number,
): boolean {
  return !trial.skipped && trial.conceptCount >=
    (getGradedTaskSpec('abstract-compare', level).commonPropertyTarget ?? 1);
}

export function thoughtMeetsClinicalTarget(
  transcript: string,
  level: number,
  onTopicScore: number | null | undefined,
): boolean {
  const spec = getGradedTaskSpec('thought-continuation', level);
  // On-topic classification must exist. A missing/failed model call does not
  // turn a content-free transcript into evidence of clinical improvement.
  if (typeof onTopicScore !== 'number' || !Number.isFinite(onTopicScore) || onTopicScore < 0.25) return false;
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length < (spec.minResponseWords ?? 1)) return false;
  if (spec.connectorRequired && !/\b(because|when|then|if|since|so|but|after|before|therefore)\b/i.test(transcript)) return false;
  // Still only a measurable practice proxy, not semantic comparison analysis.
  if (spec.comparisonRequired && !/\b(both|like|unlike|similar|different|whereas|compared|however|while|than|but)\b/i.test(transcript)) return false;
  return true;
}
