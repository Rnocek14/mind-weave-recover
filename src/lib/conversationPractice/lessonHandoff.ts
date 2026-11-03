/**
 * A nonclinical, opt-in bridge from a completed *observed* lesson game to an
 * existing scripted conversation skill. No result text, ASR guess, score,
 * mastery state, or private patient content crosses this navigation boundary.
 *
 * The offered skill is related practice, not a claim that real-world transfer
 * was demonstrated. Only author-reviewed existing conversation stages can
 * be suggested; the patient still presses Start.
 */
import { CANONICAL_SLUGS, normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import {
  getConversationPracticeStage,
  type ConversationPracticeKind,
  type ConversationPracticeLevel,
} from './stages';

export interface LessonConversationBridge {
  sourceGame: string;
  kind: ConversationPracticeKind;
  stage: ConversationPracticeLevel;
  label: string;
}

type Recommendation = Omit<LessonConversationBridge, 'sourceGame'>;

// Mapping of the practiced SKILL, not a copy of the stimulus or an assessment.
// These stage numbers refer to the existing authored, nonclinical stage bank.
const RECOMMENDATIONS: Readonly<Record<string, Recommendation>> = {
  [CANONICAL_SLUGS.PHRASE_PRACTICE]: {
    kind: 'conversation-coach', stage: 3, label: 'Try asking for something you need',
  },
  [CANONICAL_SLUGS.DESCRIBE_GUESS]: {
    kind: 'conversation-coach', stage: 5, label: 'Describe a word when it gets stuck',
  },
  [CANONICAL_SLUGS.PHOTO_NAMING]: {
    kind: 'conversation-coach', stage: 5, label: 'Describe a word when it gets stuck',
  },
  [CANONICAL_SLUGS.TWO_CLUES]: {
    kind: 'conversation-coach', stage: 5, label: 'Describe a word when it gets stuck',
  },
  [CANONICAL_SLUGS.FIX_SENTENCE]: {
    kind: 'conversation-coach', stage: 7, label: 'Practice repairing a misunderstanding',
  },
  [CANONICAL_SLUGS.NARRATIVE_RETELL]: {
    kind: 'conversation-partner', stage: 3, label: 'Add a detail when someone asks',
  },
  [CANONICAL_SLUGS.THOUGHT_CONTINUATION]: {
    kind: 'conversation-partner', stage: 4, label: 'Stay on a familiar topic',
  },
};

export function selectLessonConversationBridge(
  observedGameSlugs: readonly string[],
): LessonConversationBridge | null {
  for (const rawSlug of observedGameSlugs) {
    if (typeof rawSlug !== 'string') continue;
    const sourceGame = normalizeExerciseSlug(rawSlug);
    const suggestion = RECOMMENDATIONS[sourceGame];
    if (!suggestion || !getConversationPracticeStage(suggestion.kind, suggestion.stage)) continue;
    return { sourceGame, ...suggestion };
  }
  return null;
}

export interface LessonConversationNavigation {
  version: 1;
  patientProfileId: string;
  sourceGame: string;
  kind: ConversationPracticeKind;
  stage: ConversationPracticeLevel;
}

export function makeLessonConversationNavigation(
  bridge: LessonConversationBridge,
  patientProfileId: string,
): LessonConversationNavigation {
  return {
    version: 1, patientProfileId, sourceGame: bridge.sourceGame,
    kind: bridge.kind, stage: bridge.stage,
  };
}

/** Route state is untrusted. Match it to the active patient and the exact
 * authored recommendation before displaying any cross-game cue. */
export function resolveLessonConversationNavigation(
  locationState: unknown,
  activeProfileId: string | null | undefined,
  requestedKind: ConversationPracticeKind,
): LessonConversationBridge | null {
  if (!activeProfileId || !locationState ||
      typeof locationState !== 'object' || !('lessonConversation' in locationState)) {
    return null;
  }
  const hint: unknown = locationState.lessonConversation;
  if (!hint || typeof hint !== 'object') return null;
  if (!('version' in hint) || hint.version !== 1 ||
      !('patientProfileId' in hint) || hint.patientProfileId !== activeProfileId ||
      !('sourceGame' in hint) || typeof hint.sourceGame !== 'string' ||
      !('kind' in hint) || hint.kind !== requestedKind ||
      !('stage' in hint) || typeof hint.stage !== 'number') return null;
  const accepted = selectLessonConversationBridge([hint.sourceGame]);
  if (!accepted || accepted.sourceGame !== hint.sourceGame ||
      accepted.kind !== requestedKind || accepted.stage !== hint.stage) return null;
  return accepted;
}
