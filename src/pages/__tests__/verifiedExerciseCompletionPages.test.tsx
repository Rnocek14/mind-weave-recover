import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fromLesson: false,
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  retryFailedSubmissions: vi.fn(),
  submitTrial: vi.fn(),
  flushAdaptationLogs: vi.fn(),
  verifySpeech: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-patient' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: mocks.fromLesson,
    returnTo: '/lesson',
    sessionId: mocks.fromLesson ? 'synthetic-lesson' : null,
    adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'synthetic-session',
    isCreatingSession: false,
    sessionError: null,
    retrySession: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial,
    commitSession: mocks.commitSession,
    retryFailedSubmissions: mocks.retryFailedSubmissions,
  }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({
    loading: false, difficultyTier: 1, focusPhonemes: [],
    recommendedCueType: 'none',
  }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: vi.fn(),
    shouldStepDown: false,
    hasPending: false,
    acknowledge: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCategoryFluencyProgression', () => ({
  useCategoryFluencyProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapCategoryFluencySupport: () => 'independent',
}));
vi.mock('@/hooks/useSynonymGeneratorProgression', () => ({
  useSynonymGeneratorProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapSynonymGeneratorSupport: () => 'independent',
}));
vi.mock('@/hooks/useDetectiveMindProgression', () => ({
  useDetectiveMindProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapDetectiveMindSupport: () => 'recognition_only',
}));
vi.mock('@/lib/progression/categoryFluencyDifficultyBridge', () => ({
  resolveEffectiveCategoryFluencyInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/lib/progression/synonymGeneratorDifficultyBridge', () => ({
  resolveEffectiveSynonymGeneratorInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/lib/progression/detectiveMindDifficultyBridge', () => ({
  resolveEffectiveDetectiveMindInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/lib/exerciseDetailsStore', () => ({ saveExerciseDetails: vi.fn() }));
vi.mock('@/hooks/useDualLoadNamingProgression', () => ({
  useDualLoadNamingProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapDualLoadNamingSupport: () => 'independent',
}));
vi.mock('@/lib/progression/dualLoadNamingDifficultyBridge', () => ({
  resolveEffectiveDualLoadNamingInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useDynamicTier', () => ({
  useDynamicTier: () => ({ currentTier: 1, recordTrial: vi.fn() }),
}));
vi.mock('@/hooks/useMultiStepPlanningProgression', () => ({
  useMultiStepPlanningProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapMultiStepPlanningSupport: () => 'independent',
}));
vi.mock('@/lib/progression/multiStepPlanningDifficultyBridge', () => ({
  resolveEffectiveMultiStepPlanningInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/components/DualLoadNamingGame', () => ({
  DualLoadNamingGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{ namingAccuracy: 1, recallAccuracy: 0.5 }])}>
      Finish dual load
    </button>
  ),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { clinical_profile: {} }, error: null }) }),
      }),
    }),
  },
}));
vi.mock('@/hooks/useExerciseConfig', () => ({
  useExerciseConfig: () => ({
    config: { startDifficulty: 1 },
    hasCapabilityAdaptations: false,
    bounds: { floor: 1, ceiling: 10 },
  }),
}));
vi.mock('@/hooks/useExerciseGating', () => ({
  useExerciseGating: () => ({ getAdaptations: () => ({}) }),
}));
vi.mock('@/hooks/usePhonologicalAwarenessProgression', () => ({
  usePhonologicalAwarenessProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapPhonologicalAwarenessSupport: () => 'recognition_only',
}));
vi.mock('@/lib/progression/phonologicalAwarenessDifficultyBridge', () => ({
  resolveEffectivePhonologicalAwarenessInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/components/PhonologicalGame', () => ({
  PhonologicalGame: ({ onGameComplete }: {
    onGameComplete: (finalScore: number, totalTrials: number) => void,
  }) => (
    <button onClick={() => onGameComplete(4, 8)}>Finish phonological</button>
  ),
}));
vi.mock('@/hooks/useSessionStallWatchdog', () => ({
  useSessionStallWatchdog: () => undefined,
}));
vi.mock('@/components/NarrativeRetellGame', () => ({
  NarrativeRetellGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{
      storyId: 'synthetic-story', transcript: 'synthetic answer',
      eventCoverage: 0.5, wordCount: 5, eventsFound: 2, eventsTotal: 4,
    }])}>Finish narrative</button>
  ),
}));
vi.mock('@/components/ThoughtContinuationGame', () => ({
  ThoughtContinuationGame: ({ onComplete, registerEvidenceVerifier }: {
    onComplete: (summary: unknown) => void;
    registerEvidenceVerifier: (verify: () => Promise<boolean>) => void;
  }) => {
    registerEvidenceVerifier(() => mocks.verifySpeech());
    return <button onClick={() => onComplete({
      totalPrompts: 3, promptsSpoken: 2,
      avgMomentumScore: 0.6, completedThoughts: 1,
    })}>Finish thoughts</button>;
  },
}));
vi.mock('@/components/ConversationPartnerGame', () => ({
  ConversationPartnerGame: ({ onComplete, registerEvidenceVerifier }: {
    onComplete: (summary: unknown) => void;
    registerEvidenceVerifier: (verify: () => Promise<boolean>) => void;
  }) => {
    registerEvidenceVerifier(() => mocks.verifySpeech());
    return <button onClick={() => onComplete({
      turnsCompleted: 2, avgLatencyMs: 2000,
      completionRate: 70, userAIRatio: 50,
    })}>Finish partner</button>;
  },
}));
vi.mock('@/components/ConversationCoachGame', () => ({
  ConversationCoachGame: ({ onComplete, registerEvidenceVerifier }: {
    onComplete: (summary: unknown) => void;
    registerEvidenceVerifier: (verify: () => Promise<boolean>) => void;
  }) => {
    registerEvidenceVerifier(() => mocks.verifySpeech());
    return <button onClick={() => onComplete({
      turnsCompleted: 2, cardsCompleted: 1,
      avgLatencyMs: 2000, userAIRatio: 50,
    })}>Finish coach</button>;
  },
}));
vi.mock('@/components/AbstractCompareGame', () => ({
  AbstractCompareGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{
      itemId: 'synthetic-abstract', wordA: 'cat', wordB: 'dog',
      transcript: 'they are animals', coverageRatio: 0.5,
    }])}>Finish comparison</button>
  ),
}));
vi.mock('@/components/MultiStepPlanningGame', () => ({
  MultiStepPlanningGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{ goalCoverage: 0.5, stepsFound: 2 }])}>
      Finish planning
    </button>
  ),
}));
vi.mock('@/hooks/useFixSentenceProgression', () => ({
  useFixSentenceProgression: () => ({ loaded: true, startingLevel: 1, state: null }),
}));
vi.mock('@/lib/progression/fixSentenceDifficultyBridge', () => ({
  resolveEffectiveFixSentenceInitialDifficulty: () => ({
    clinicalFloor: 1, raised: false, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useValidationTrialCount', () => ({
  useValidationTrialCount: () => 5,
}));
vi.mock('@/components/ProgressionRecap', () => ({
  ProgressionRecap: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Continue verified recap</button>
  ),
}));
vi.mock('@/lib/progression/fixSentenceLevels', () => ({
  getFixSentenceLevelSpec: () => ({ description: 'Synthetic clinical level' }),
}));
vi.mock('@/components/FixSentenceGame', () => ({
  FixSentenceGame: ({ onGameComplete, registerFlush }: {
    onGameComplete: (r: unknown[]) => void;
    registerFlush: (fn: () => Promise<void>) => void;
  }) => {
    registerFlush(() => mocks.flushAdaptationLogs());
    return (
      <button onClick={() => onGameComplete([{ isCorrect: true, trialId: 'synthetic-fix' }])}>
        Finish sentence
      </button>
    );
  },
}));
vi.mock('@/data/minimalPairsBank', () => ({
  getMinimalPairStats: () => ({ total: 10, byCategory: { phonemic: 10 } }),
}));
vi.mock('@/hooks/useMinimalPairsProgression', () => ({
  useMinimalPairsProgression: () => ({
    loaded: true, startingLevel: 1, state: null,
  }),
  mapMinimalPairsSupport: () => 'first_listen',
}));
vi.mock('@/lib/progression/minimalPairsDifficultyBridge', () => ({
  resolveEffectiveMinimalPairsInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/components/MinimalPairsGame', () => ({
  MinimalPairsGame: ({ onComplete }: {
    onComplete: (r: { score: number; accuracy: number; correctCount: number; incorrectCount: number }) => void;
  }) => <button onClick={() => onComplete({
    score: 50, accuracy: 50, correctCount: 1, incorrectCount: 1,
  })}>Finish minimal pairs</button>,
}));
vi.mock('@/components/InlineSessionProgress', () => ({ InlineSessionProgress: () => null }));
vi.mock('@/components/SessionSidePanel', () => ({ SessionSidePanel: () => null }));
vi.mock('@/components/CategoryFluencyGame', () => ({
  CategoryFluencyGame: ({
    onGameComplete, onFinish,
  }: {
    onGameComplete: (r: unknown[]) => void;
    onFinish?: () => void;
  }) => (
    <div>
      <button onClick={() => onGameComplete([{ uniqueWordCount: 3, words: ['one', 'two', 'three'], difficulty: 1 }])}>
        Finish category
      </button>
      {onFinish && <button onClick={onFinish}>Continue category</button>}
    </div>
  ),
}));
vi.mock('@/components/SynonymGeneratorGame', () => ({
  SynonymGeneratorGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{ matchCount: 3 }])}>Finish synonyms</button>
  ),
}));
vi.mock('@/components/DetectiveMindGame', () => ({
  DetectiveMindGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{ points: 10, correct: true }])}>Finish detective</button>
  ),
}));
vi.mock('@/components/DescribeGuessGame', () => ({
  DescribeGuessGame: ({ onGameComplete }: { onGameComplete: (r: unknown[]) => void }) => (
    <button onClick={() => onGameComplete([{ wordWin: true, meaningWin: true }])}>Finish description</button>
  ),
}));

import CategoryFluencyExercise from '../CategoryFluencyExercise';
import SynonymGeneratorExercise from '../SynonymGeneratorExercise';
import DetectiveMindExercise from '../DetectiveMindExercise';
import DescribeGuessExercise from '../DescribeGuessExercise';
import MinimalPairsExercise from '../MinimalPairsExercise';
import FixSentenceExercise from '../FixSentenceExercise';
import DualLoadNamingExercise from '../DualLoadNamingExercise';
import MultiStepPlanExercise from '../MultiStepPlanExercise';
import AbstractCompareExercise from '../AbstractCompareExercise';
import NarrativeRetellExercise from '../NarrativeRetellExercise';
import PhonologicalExercise from '../PhonologicalExercise';
import ThoughtContinuationExercise from '../ThoughtContinuationExercise';
import ConversationPartnerExercise from '../ConversationPartnerExercise';
import ConversationCoachExercise from '../ConversationCoachExercise';

const cases = [
  { title: 'Category Fluency', component: CategoryFluencyExercise, finishLabel: 'Finish category' },
  { title: 'Synonym Generator', component: SynonymGeneratorExercise, finishLabel: 'Finish synonyms' },
  { title: 'Detective Mind', component: DetectiveMindExercise, finishLabel: 'Finish detective' },
  { title: 'Describe & Guess', component: DescribeGuessExercise, finishLabel: 'Finish description' },
  { title: 'Dual-Load Naming', component: DualLoadNamingExercise, finishLabel: 'Finish dual load' },
  { title: 'Multi-Step Planning', component: MultiStepPlanExercise, finishLabel: 'Finish planning' },
  { title: 'Abstract Comparison', component: AbstractCompareExercise, finishLabel: 'Finish comparison' },
  { title: 'Narrative Retell', component: NarrativeRetellExercise, finishLabel: 'Finish narrative' },
  { title: 'Phonological Awareness', component: PhonologicalExercise, finishLabel: 'Finish phonological' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fromLesson = false;
  mocks.commitSession.mockResolvedValue({ ok: true });
  mocks.completeSession.mockResolvedValue(true);
  mocks.retryFailedSubmissions.mockResolvedValue({ ok: true });
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.flushAdaptationLogs.mockResolvedValue(undefined);
  mocks.verifySpeech.mockResolvedValue(true);
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('patient completion and retry across actual exercise pages', () => {
  it.each(cases)('$title never announces completion on a failed clinical commit', async ({ component: Page, finishLabel }) => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false });
    render(<MemoryRouter><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: finishLabel }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try saving again' })).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('Category Fluency does not expose Continue before persistence and recovers on retry', async () => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><CategoryFluencyExercise /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Continue category' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish category' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Continue category' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('button', { name: 'Continue category' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(2);
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });

  it('Describe and Guess retries failed session closure without recounting progression', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MemoryRouter><DescribeGuessExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish description' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it('Detective Mind explicitly labels offline completion as unsaved, without clinical closure', async () => {
    localStorage.setItem('offlineMode', 'true');
    render(<MemoryRouter><DetectiveMindExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish detective' }));
    expect(await screen.findByRole('heading', { name: 'Offline practice finished' })).toBeVisible();
    expect(screen.getByText('This practice was not saved.')).toBeVisible();
    expect(mocks.commitSession).not.toHaveBeenCalled();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('Minimal Pairs blocks false completion and has a large retry action', async () => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    render(<MemoryRouter><MinimalPairsExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish minimal pairs' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Practice saved' })).toBeVisible();
    expect(screen.getByText('1 of 2 correct')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Go to Today' })).toBeVisible();
    expect(mocks.retryFailedSubmissions).toHaveBeenCalledTimes(1);
    expect(mocks.commitSession).toHaveBeenCalledTimes(2);
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });

  it('Minimal Pairs close failure never repeats a successful progression commit', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MemoryRouter><MinimalPairsExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Finish minimal pairs' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Practice saved' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it('Fix Sentence blocks completion when the final adaptation flush is unconfirmed', async () => {
    mocks.flushAdaptationLogs.mockRejectedValueOnce(new Error('synthetic adaptation timeout'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      render(<MemoryRouter><FixSentenceExercise /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Finish sentence' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      expect(mocks.commitSession).not.toHaveBeenCalled();
      expect(mocks.completeSession).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
      expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
      expect(mocks.flushAdaptationLogs).toHaveBeenCalledTimes(2);
      expect(mocks.commitSession).toHaveBeenCalledTimes(1);
      expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    } finally { warn.mockRestore(); }
  });

  it('Fix Sentence does not show a progression recap or advance a lesson before the database confirms session close', async () => {
    mocks.fromLesson = true;
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const sent = vi.fn();
    window.addEventListener('exercise-complete', sent);
    try {
      render(<MemoryRouter><FixSentenceExercise /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Finish sentence' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      expect(sent).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
      expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
      expect(mocks.commitSession).toHaveBeenCalledTimes(1);
      expect(mocks.completeSession).toHaveBeenCalledTimes(2);
    } finally { window.removeEventListener('exercise-complete', sent); }
  });

  it('Fix Sentence only shows the clinical progression recap after successful persistence', async () => {
    mocks.commitSession.mockResolvedValue({
      ok: true,
      progressionSnapshot: {
        prev: { level: 1, progressPct: 1 },
        next: { level: 2, progressPct: 0 },
        leveledUp: true,
      },
    });
    render(<MemoryRouter><FixSentenceExercise /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Continue verified recap' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Finish sentence' }));
    expect(await screen.findByRole('button', { name: 'Continue verified recap' })).toBeVisible();
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });

  it('Dual-Load Naming retries a failed session close without re-committing progression', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MemoryRouter><DualLoadNamingExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish dual load' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Dual-Load Complete!' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it('Multi-Step Planning keeps the lesson on the current game if the final save failed', async () => {
    mocks.fromLesson = true;
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    const sent = vi.fn();
    window.addEventListener('exercise-complete', sent);
    try {
      render(<MemoryRouter><MultiStepPlanExercise /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Finish planning' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      expect(sent).not.toHaveBeenCalled();
      expect(mocks.completeSession).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
      expect(await screen.findByRole('heading', { name: 'Planning Complete!' })).toBeVisible();
      expect(mocks.commitSession).toHaveBeenCalledTimes(2);
      expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener('exercise-complete', sent); }
  });

  it('Narrative Retell cannot advance a lesson when story data failed to save', async () => {
    mocks.fromLesson = true;
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    const dispatch = vi.fn();
    window.addEventListener('exercise-complete', dispatch);
    try {
      render(<MemoryRouter><NarrativeRetellExercise /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Finish narrative' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      expect(dispatch).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
      expect(await screen.findByRole('heading', { name: 'Stories Complete!' })).toBeVisible();
      expect(mocks.commitSession).toHaveBeenCalledTimes(2);
      expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener('exercise-complete', dispatch); }
  });

  it('Abstract Comparison never closes a lesson after an unconfirmed trial save', async () => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false });
    render(<MemoryRouter><AbstractCompareExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish comparison' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('Narrative Retell offline mode is clearly not a clinical save', async () => {
    localStorage.setItem('offlineMode', 'true');
    render(<MemoryRouter><NarrativeRetellExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish narrative' }));
    expect(await screen.findByRole('heading', { name: 'Offline practice finished' })).toBeVisible();
    expect(screen.getByText('This practice was not saved.')).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(mocks.commitSession).not.toHaveBeenCalled();
  });

  it('Phonological Awareness waits for verified session close before reporting a saved session', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MemoryRouter><PhonologicalExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Finish phonological' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Practice saved' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Practice saved' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  const conversationCases = [
    { title: 'Thought Continuation', component: ThoughtContinuationExercise, finishLabel: 'Finish thoughts' },
    { title: 'Conversation Partner', component: ConversationPartnerExercise, finishLabel: 'Finish partner' },
    { title: 'Conversation Coach', component: ConversationCoachExercise, finishLabel: 'Finish coach' },
  ];

  it.each(conversationCases)('$title keeps speech results unsaved after failed utterance persistence', async ({
    component: Page, finishLabel,
  }) => {
    mocks.verifySpeech.mockResolvedValueOnce(false);
    render(<MemoryRouter><Page /></MemoryRouter>);
    // Conversation Partner and Coach have intro screens before mounting games.
    if (finishLabel === 'Finish partner') {
      fireEvent.click(screen.getByRole('button', { name: 'Start Conversation' }));
    }
    if (finishLabel === 'Finish coach') {
      fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    }
    fireEvent.click(await screen.findByRole('button', { name: finishLabel }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
    expect(mocks.verifySpeech).toHaveBeenCalledTimes(2);
  });

  it('Conversation Partner retries an unconfirmed session close without losing speech evidence', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<MemoryRouter><ConversationPartnerExercise /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Start Conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish partner' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Great conversation!' })).toBeVisible();
    expect(mocks.verifySpeech).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it('a failed lesson game must never dispatch the next-exercise event', async () => {
    mocks.fromLesson = true;
    mocks.commitSession.mockResolvedValueOnce({ ok: false });
    const sent = vi.fn();
    window.addEventListener('exercise-complete', sent);
    try {
      render(<MemoryRouter><SynonymGeneratorExercise /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: 'Finish synonyms' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      await waitFor(() => expect(sent).not.toHaveBeenCalled());
    } finally {
      window.removeEventListener('exercise-complete', sent);
    }
  });
});
