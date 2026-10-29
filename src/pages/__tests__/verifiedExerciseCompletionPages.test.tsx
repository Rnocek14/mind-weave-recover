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

const cases = [
  { title: 'Category Fluency', component: CategoryFluencyExercise, finishLabel: 'Finish category' },
  { title: 'Synonym Generator', component: SynonymGeneratorExercise, finishLabel: 'Finish synonyms' },
  { title: 'Detective Mind', component: DetectiveMindExercise, finishLabel: 'Finish detective' },
  { title: 'Describe & Guess', component: DescribeGuessExercise, finishLabel: 'Finish description' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fromLesson = false;
  mocks.commitSession.mockResolvedValue({ ok: true });
  mocks.completeSession.mockResolvedValue(true);
  mocks.retryFailedSubmissions.mockResolvedValue({ ok: true });
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.flushAdaptationLogs.mockResolvedValue(undefined);
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
