/**
 * Conversation Partner — first three actually playable clinical practice stages.
 *
 * These content/scoring requirements are provisional product heuristics pending
 * aphasia SLP review; they are NOT a validated measure of conversation or a
 * substitute for observation of communication with real people.
 *
 * L4–L8 remain design-only. The persisted level must not advance into them.
 */
import { trialCredit, type SupportLevel } from './clinicalProgression';
import type { ClinicalSignal } from '@/lib/discourseSignalScorerCore';

export type EarlyPartnerLevel = 1 | 2 | 3;

export interface EarlyPartnerStage {
  level: EarlyPartnerLevel;
  turnCount: 1 | 2 | 3;
  objective: string;
  taskGoal: string;
  targetSupport: SupportLevel;
  assistance: 'spoken_choices' | 'optional_semantic_cue' | 'independent_with_help';
  contentKey: string;
  readiness: 'ready';
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  contentSelector: { tierKey: string; description: string; implemented: true };
}

export const EARLY_PARTNER_STAGES: Record<EarlyPartnerLevel, EarlyPartnerStage> = {
  1: {
    level: 1,
    turnCount: 1,
    objective: 'Answer one familiar real-life question; one meaningful word is enough.',
    taskGoal: 'The patient may answer with one relevant word. Do not require a sentence or multiple facts.',
    targetSupport: 'choice_based',
    assistance: 'spoken_choices',
    contentKey: 'familiar_choice_one_turn',
    readiness: 'ready',
    minOnTargetAttempts: 1,
    minOnTargetAccuracy: 1,
    contentSelector: { tierKey: 'familiar_choice_one_turn', description: 'One familiar question with optional audible choices.', implemented: true },
  },
  2: {
    level: 2,
    turnCount: 2,
    objective: 'Stay with a familiar topic for two short exchanges; help is available.',
    taskGoal: 'Practice two connected exchanges. A relevant word or short phrase is enough in each.',
    targetSupport: 'semantic_cue',
    assistance: 'optional_semantic_cue',
    contentKey: 'familiar_cued_two_turn',
    readiness: 'ready',
    minOnTargetAttempts: 2,
    minOnTargetAccuracy: 1,
    contentSelector: { tierKey: 'familiar_cued_two_turn', description: 'Two connected questions on the same functional topic, semantic help optional.', implemented: true },
  },
  3: {
    level: 3,
    turnCount: 3,
    objective: 'Answer three related questions independently on one everyday topic.',
    taskGoal: 'Practice three naturalistic turns on one familiar topic without planned cueing. A meaningful short answer is accepted.',
    targetSupport: 'independent',
    assistance: 'independent_with_help',
    contentKey: 'familiar_independent_three_turn',
    readiness: 'ready',
    minOnTargetAttempts: 3,
    minOnTargetAccuracy: 1,
    contentSelector: { tierKey: 'familiar_independent_three_turn', description: 'Three related partner turns without default scaffolding; optional help is recorded as assistance.', implemented: true },
  },
};

export interface EarlyPartnerScenario {
  id: string;
  title: string;
  opener: string;
  followups: readonly [string, string];
  choices: readonly [string, string, string];
  semanticHelp: readonly [string, string, string];
}

/** Adult, practical, predictable conversations. Alternatives are prompts, not required answers. */
export const EARLY_PARTNER_SCENARIOS: readonly EarlyPartnerScenario[] = [
  {
    id: 'drink-request',
    title: 'Choosing a drink',
    opener: 'What would you like to drink?',
    followups: ['Would you like it hot or cold?', 'Where would you like to drink it?'],
    choices: ['Water', 'Coffee', 'Tea'],
    semanticHelp: [
      'You could tell me a drink, like water or coffee.',
      'You could tell me hot or cold.',
      'You could tell me where, like at home.',
    ],
  },
  {
    id: 'meal-plan',
    title: 'Making a meal plan',
    opener: 'What would you like to eat?',
    followups: ['Would you like it now or later?', 'Who would you like to eat with?'],
    choices: ['Soup', 'Eggs', 'Sandwich'],
    semanticHelp: [
      'Think of a food that sounds good.',
      'You could tell me now or later.',
      'You could tell me a person or say alone.',
    ],
  },
  {
    id: 'outing-plan',
    title: 'Planning an outing',
    opener: 'Where would you like to go?',
    followups: ['How would you like to get there?', 'What would you like to do there?'],
    choices: ['Park', 'Store', 'Library'],
    semanticHelp: [
      'Think of one place you like to visit.',
      'You could tell me walk, drive or ride.',
      'You could tell me one activity.',
    ],
  },
  {
    id: 'afternoon-plan',
    title: 'Talking about your afternoon',
    opener: 'What would you like to do this afternoon?',
    followups: ['Would you like to do that inside or outside?', 'Would you like someone to join you?'],
    choices: ['Rest', 'Walk', 'Read'],
    semanticHelp: [
      'You could tell me something you enjoy doing.',
      'You could tell me inside or outside.',
      'You could name a person or say no.',
    ],
  },
];

/** Stable selection for a mounted session. Do not change the topic mid-conversation. */
export function chooseEarlyPartnerScenario(randomValue: number = Math.random()): EarlyPartnerScenario {
  const fraction = Number.isFinite(randomValue) ? Math.min(0.999999, Math.max(0, randomValue)) : 0;
  return EARLY_PARTNER_SCENARIOS[Math.floor(fraction * EARLY_PARTNER_SCENARIOS.length)];
}

/** 4–8 intentionally have NO runtime selector and must never be silently repooled. */
export function isEarlyPartnerLevel(level: number): level is EarlyPartnerLevel {
  return Number.isInteger(level) && level >= 1 && level <= 3;
}

export type EarlyPartnerTrial = {
  correct: boolean;
  support: SupportLevel;
  turnNumber: number;
};

export function isOnTargetEarlyPartnerSupport(level: EarlyPartnerLevel, support: SupportLevel): boolean {
  if (level === 1) return support === 'choice_based' || support === 'semantic_cue' || support === 'independent';
  if (level === 2) return support === 'semantic_cue' || support === 'independent';
  return support === 'independent';
}

export function earlyPartnerEvidenceMet(level: EarlyPartnerLevel, trials: readonly EarlyPartnerTrial[]): boolean {
  const stage = EARLY_PARTNER_STAGES[level];
  if (trials.length < stage.turnCount) return false;
  const turns = new Set(trials.map(t => t.turnNumber));
  if (turns.size < stage.turnCount) return false;
  // All required turns on topic, with support at or below this level's
  // ceiling. A single on-topic word is valid at L1 — not a measured sentence.
  return trials.every(t => t.correct && isOnTargetEarlyPartnerSupport(level, t.support));
}

export function earlyPartnerProgressDelta(level: EarlyPartnerLevel, trials: readonly EarlyPartnerTrial[]): number {
  const stage = EARLY_PARTNER_STAGES[level];
  if (trials.length < stage.turnCount ||
      new Set(trials.map(t => t.turnNumber)).size < stage.turnCount) return 0;
  // Four clean completed sessions reach the 100% review threshold. This
  // weight is a DESIGN DEFAULT, not an evidence-based number of therapy visits.
  return 25 * trials.reduce((sum, t) => sum + trialCredit(t), 0) / stage.turnCount;
}

/** Only externally scored turns with a returned LLM judgement are eligible
 * for long-term mastery evidence. Local fallbacks can keep the conversation
 * alive but cannot grant clinical progress.
 */
export function earlyPartnerTurnOnTarget(
  transcript: string,
  signal: ClinicalSignal | null | undefined,
): boolean {
  if (!transcript.trim() || !signal || signal.source !== 'llm') return false;
  if (signal.confidence < 0.5 || signal.onTopicScore < 0.5 || signal.targetAchievementScore < 0.5) return false;
  return !['off_topic', 'no_response', 'surrender', 'unclear'].includes(signal.errorType);
}
