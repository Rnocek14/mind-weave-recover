import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitTrial: vi.fn(), commitSession: vi.fn(), navigate: vi.fn(),
  recordPivot: vi.fn(), mode: 'spoken' as 'spoken' | 'typed',
}));

vi.mock('react-router-dom', async (imp) => {
  const real = await imp<typeof import('react-router-dom')>();
  return { ...real, useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { trialLimit: 1 }, search: '' }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-patient' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false, sessionId: null,
    returnTo: '/today', adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'synthetic-session', isCreatingSession: false,
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: vi.fn() }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 1, loading: false }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useCategoryFluencyProgression', () => ({
  useCategoryFluencyProgression: () => ({
    loaded: true, startingLevel: 1, state: { supportBaseline: 0 },
  }),
  mapCategoryFluencySupport: () => 'open_response',
}));
vi.mock('@/lib/progression/categoryFluencyDifficultyBridge', () => ({
  resolveEffectiveCategoryFluencyInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: mocks.recordPivot, shouldStepDown: false,
    pivotReason: null, hasPending: false, acknowledge: vi.fn(),
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial, commitSession: mocks.commitSession,
  }),
}));
vi.mock('@/components/CategoryFluencyGame', () => ({
  CategoryFluencyGame: ({ onRoundComplete }: {
    onRoundComplete: (result: unknown) => void;
  }) => (
    <button onClick={() => onRoundComplete({
      category: 'animals', words: ['cat', 'dog'],
      uniqueWordCount: 2, wordsPerSecond: 2 / 60,
      durationSec: 60, timeLimitSec: 60, difficulty: 1,
      cueLevelUsed: 0, inputMode: mocks.mode,
      analysis: null,
    })}>Submit actual fluency round callback</button>
  ),
}));

import CategoryFluencyExercise from './CategoryFluencyExercise';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mode = 'spoken';
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.commitSession.mockResolvedValue({ ok: true, errors: [] });
});
afterEach(cleanup);

describe('Category Fluency app-observed search telemetry', () => {
  it('records accepted words and cluster heuristic without false human verification', async () => {
    render(<CategoryFluencyExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit actual fluency round callback' }));
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    const input = mocks.submitTrial.mock.calls[0][0];
    expect(input).toMatchObject({
      profileId: 'synthetic-patient', sessionId: 'synthetic-session',
      gameId: 'category_fluency',
      taskParameters: {
        category_id: 'animals', app_valid_unique_items: 2,
        verified_unique_items: null, human_word_verification: false,
        cluster_analysis_source: 'automatic_subcategory_heuristic_on_app_valid_words',
        input_mode: 'spoken', observed_duration_sec: 60,
        instructed_time_limit_sec: 60,
      },
    });
    expect(typeof input.taskParameters.cluster_switches).toBe('number');
  });

  it('still records typed practice, without promoting it to clinical spoken fluency', async () => {
    mocks.mode = 'typed';
    render(<CategoryFluencyExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit actual fluency round callback' }));
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      clinicalProgressionEligible: false,
      taskParameters: expect.objectContaining({
        input_mode: 'typed', verified_unique_items: null,
        app_valid_unique_items: 2,
      }),
    }));
  });
});
