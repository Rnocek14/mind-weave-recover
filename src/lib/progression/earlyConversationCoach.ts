/**
 * Conversation Coach: concrete, adult-functional tasks for the first three
 * clinical practice stages. Levels 4–8 remain design-of-record only.
 *
 * The level order and session counts are product heuristics, NOT a validated
 * aphasia outcome measure or an endorsed clinical protocol.
 */
import {
  trialCredit,
  type SupportLevel,
} from '@/lib/progression/clinicalProgression';
import type { ClinicalSignal } from '@/lib/discourseSignalScorerCore';

export type EarlyCoachLevel = 1 | 2 | 3;
export type EarlyCoachMode = 'full_model' | 'visual_choice' | 'open_semantic';

export interface EarlyCoachLevelSpec {
  level: EarlyCoachLevel;
  mode: EarlyCoachMode;
  objective: string;
  taskGoal: string;
  targetSupport: SupportLevel;
  readiness: 'thin';
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  contentSelector: { tierKey: string; description: string; implemented: true };
}

export const EARLY_COACH_LEVELS: Record<EarlyCoachLevel, EarlyCoachLevelSpec> = {
  1: {
    level: 1, mode: 'full_model',
    objective: 'Say one useful message after Maya models it.',
    taskGoal: 'One meaningful modeled request is enough. Do not require exact pronunciation, an entire sentence, or extra information.',
    targetSupport: 'carrier_or_full_model', readiness: 'thin',
    minOnTargetAttempts: 1, minOnTargetAccuracy: 1,
    contentSelector: {
      tierKey: 'scripted_full_model',
      description: 'A practical one-message situation, with a visible and spoken model followed by the patient speaking.',
      implemented: true,
    },
  },
  2: {
    level: 2, mode: 'visual_choice',
    objective: 'Choose something useful and tell Maya what you chose.',
    taskGoal: 'The patient selects an on-screen option then communicates their choice by SPEAKING. The tap alone is not a response; one meaningful word is enough.',
    targetSupport: 'choice_based', readiness: 'thin',
    minOnTargetAttempts: 1, minOnTargetAccuracy: 1,
    contentSelector: {
      tierKey: 'scripted_choice',
      description: 'Choice tiles and optional audible examples; selection alone cannot satisfy the target.',
      implemented: true,
    },
  },
  3: {
    level: 3, mode: 'open_semantic',
    objective: 'Tell Maya what you need without a model or visible choices.',
    taskGoal: 'One clear functional request on a familiar topic. An optional semantic clue can help practice, but cannot establish independent mastery.',
    targetSupport: 'independent', readiness: 'thin',
    minOnTargetAttempts: 1, minOnTargetAccuracy: 1,
    contentSelector: {
      tierKey: 'semi_scripted_cue',
      description: 'Unmodeled request on a familiar topic; an optional semantic cue is tracked separately.',
      implemented: true,
    },
  },
};

export interface EarlyCoachScenario {
  id: string;
  title: string;
  modeledMessage: string;
  situation: string;
  choiceQuestion: string;
  choices: readonly [string, string, string];
  openQuestion: string;
  semanticCue: string;
}

export const EARLY_COACH_SCENARIOS: readonly EarlyCoachScenario[] = [
  {
    id: 'request-drink', title: 'Asking for a drink',
    modeledMessage: 'I need water.',
    situation: 'You want something to drink.',
    choiceQuestion: 'What would you like to drink?',
    choices: ['Water', 'Coffee', 'Tea'],
    openQuestion: 'Tell me what you would like to drink.',
    semanticCue: 'Think of something you could drink, like water.',
  },
  {
    id: 'request-break', title: 'Asking for a break',
    modeledMessage: 'I need a break.',
    situation: 'You are tired and want to rest.',
    choiceQuestion: 'What would help you now?',
    choices: ['A break', 'A drink', 'A chair'],
    openQuestion: 'Tell me what would help you feel better.',
    semanticCue: 'Think about how you could ask for a rest or help.',
  },
  {
    id: 'request-ride', title: 'Asking for transportation',
    modeledMessage: 'Can you drive me?',
    situation: 'You need to get somewhere.',
    choiceQuestion: 'How do you want to get there?',
    choices: ['A ride', 'A walk', 'A taxi'],
    openQuestion: 'Tell me how you would like to get there.',
    semanticCue: 'Think of a way to travel, like riding in a car.',
  },
  {
    id: 'request-help', title: 'Asking for help',
    modeledMessage: 'Please help me.',
    situation: 'You cannot reach something you need.',
    choiceQuestion: 'What would you like someone to do?',
    choices: ['Help me', 'Move this', 'Reach it'],
    openQuestion: 'Tell someone how they can help you.',
    semanticCue: 'Think about what you need another person to do.',
  },
  {
    id: 'request-food', title: 'Asking for food',
    modeledMessage: 'I would like soup.',
    situation: 'You are choosing something to eat.',
    choiceQuestion: 'What would you like to eat?',
    choices: ['Soup', 'Eggs', 'Sandwich'],
    openQuestion: 'Tell me what you would like to eat.',
    semanticCue: 'Think of a food you might order or make.',
  },
];

export function isEarlyCoachLevel(level: number): level is EarlyCoachLevel {
  return Number.isInteger(level) && level >= 1 && level <= 3;
}

export function chooseEarlyCoachScenario(randomValue: number = Math.random()): EarlyCoachScenario {
  const fraction = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(0.999999, randomValue)) : 0;
  return EARLY_COACH_SCENARIOS[Math.floor(fraction * EARLY_COACH_SCENARIOS.length)];
}

export function buildEarlyCoachPrompt(level: EarlyCoachLevel, scenario: EarlyCoachScenario): string {
  if (level === 1) {
    return `${scenario.situation} You can say: "${scenario.modeledMessage}" Now you try.`;
  }
  if (level === 2) {
    return `${scenario.situation} ${scenario.choiceQuestion} Choose one answer, then tell me.`;
  }
  return `${scenario.situation} ${scenario.openQuestion}`;
}

export interface EarlyCoachTrial {
  correct: boolean;
  support: SupportLevel;
  turnNumber: 1;
}

export function earlyCoachEvidenceMet(level: EarlyCoachLevel, trials: readonly EarlyCoachTrial[]): boolean {
  if (trials.length !== 1 || trials[0].turnNumber !== 1 || !trials[0].correct) return false;
  const support = trials[0].support;
  if (level === 1) return support === 'carrier_or_full_model';
  if (level === 2) return support === 'choice_based';
  return support === 'independent';
}

export function earlyCoachProgressDelta(level: EarlyCoachLevel, trials: readonly EarlyCoachTrial[]): number {
  if (trials.length !== 1 || trials[0].turnNumber !== 1) return 0;
  const baseline = trialCredit({ correct: true, support: EARLY_COACH_LEVELS[level].targetSupport });
  if (!baseline) return 0;
  const credit = trialCredit(trials[0]);
  // Equalize credit for support explicitly required by that rung. An L3
  // semantic clue gives practice credit, but evidenceMet remains false.
  // Four positive sessions → 100% by DESIGN DEFAULT, not clinical dosage.
  return Math.min(25, 25 * credit / baseline);
}

/** Fail closed: a local fallback, empty utterance, no-response or an unknown
 * on-topic classification never confers a clinical-language achievement.
 */
export function earlyCoachTurnOnTarget(transcript: string, signal: ClinicalSignal | null | undefined): boolean {
  if (!transcript.trim() || !signal || signal.source !== 'llm') return false;
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0.5 ||
      !Number.isFinite(signal.onTopicScore) || signal.onTopicScore < 0.5 ||
      !Number.isFinite(signal.targetAchievementScore) || signal.targetAchievementScore < 0.5) return false;
  return !['off_topic', 'no_response', 'surrender', 'unclear'].includes(signal.errorType);
}
