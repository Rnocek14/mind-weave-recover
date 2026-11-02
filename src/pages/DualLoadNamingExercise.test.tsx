import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';

const mocks = vi.hoisted(() => ({
  submitTrial: vi.fn(),
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  recordPivot: vi.fn(),
  recordDynamicTier: vi.fn(),
  acknowledgePivot: vi.fn(),
  navigate: vi.fn(),
  nextTrial: null as DualLoadTrialResult | null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { trialLimit: 1 } }),
  };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false, returnTo: '/today', sessionId: 'synthetic-session',
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 4, focusPhonemes: [], loading: false }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useDualLoadNamingProgression', () => ({
  useDualLoadNamingProgression: () => ({
    loaded: true,
    startingLevel: 4,
    state: { supportBaseline: 0 },
  }),
  mapDualLoadNamingSupport: () => 'open_response',
}));
vi.mock('@/lib/progression/dualLoadNamingDifficultyBridge', () => ({
  resolveEffectiveDualLoadNamingInitialDifficulty: () => ({
    effective: 4,
    clinicalFloor: 4,
    softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useDynamicTier', () => ({
  useDynamicTier: () => ({
    currentTier: 2,
    recordTrial: mocks.recordDynamicTier,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: mocks.recordPivot,
    acknowledge: mocks.acknowledgePivot,
    shouldStepDown: false,
    hasPending: false,
    pivotReason: null,
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial,
    commitSession: mocks.commitSession,
  }),
}));
vi.mock('@/components/DualLoadNamingGame', () => ({
  DualLoadNamingGame: ({
    onTrialComplete,
    onGameComplete,
  }: {
    onTrialComplete: (result: DualLoadTrialResult) => void | Promise<void>;
    onGameComplete: (results: DualLoadTrialResult[]) => void | Promise<void>;
  }) => (
    <button onClick={() => {
      if (!mocks.nextTrial) throw new Error('No synthetic trial');
      void onTrialComplete(mocks.nextTrial);
      void onGameComplete([mocks.nextTrial]);
    }}>
      Complete synthetic dual-task
    </button>
  ),
}));

import DualLoadNamingExercise from './DualLoadNamingExercise';

function makeTrial(overrides: Partial<DualLoadTrialResult> = {}): DualLoadTrialResult {
  return {
    setId: 'synthetic-set',
    namingAccuracy: 0.8,
    recallAccuracy: 2 / 3,
    namingAttempts: [
      { targetWord: 'apple', userResponse: 'apple', correct: true, reactionTimeMs: 900 },
      { targetWord: 'dog', userResponse: 'dog', correct: true, reactionTimeMs: 1000 },
      { targetWord: 'chair', userResponse: 'chair', correct: true, reactionTimeMs: 1050 },
    ],
    recalledWords: ['pen', 'door'],
    interferenceIndex: 0.1,
    durationMs: 12000,
    depthTelemetry: {
      taskType: 'dual_load_naming',
      namingAccuracy: 0.8,
      recallAccuracy: 2 / 3,
      interferenceIndex: 0.1,
      baselineSource: 'heuristic',
      baselineAcc: 0.9,
    },
    ...overrides,
  };
}

describe('DualLoadNamingExercise true dual-task clinical evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nextTrial = makeTrial();
    mocks.submitTrial.mockResolvedValue({ ok: true });
    mocks.commitSession.mockResolvedValue({ ok: true, errors: [] });
  });

  it('does not turn one-of-three typed recall into a mastered spoken dual task', async () => {
    mocks.nextTrial = makeTrial({ namingAccuracy: 1, recallAccuracy: 1 / 3, recalledWords: ['pen'] });

    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic dual-task' }));

    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      trialMode: 'mixed',
      clinicalProgressionEligible: true,
      errorType: 'partial_recall',
      taskParameters: expect.objectContaining({
        naming_input_mode: 'browser_speech',
        recall_input_mode: 'typed',
        combined_success: false,
      }),
    }));
    expect(mocks.recordPivot).toHaveBeenCalledWith(expect.objectContaining({ wasCorrect: false }));
    expect(mocks.recordDynamicTier).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it('keeps genuine combined success separate from expressive speech mastery', async () => {
    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic dual-task' }));

    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true,
      trialMode: 'mixed',
      clinicalProgressionEligible: true,
      taskParameters: expect.objectContaining({
        combined_success: true,
        scorable_spoken_naming_attempts: 3,
      }),
    }));
    expect(mocks.recordDynamicTier).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  it('does not count all skipped/filler speech as a patient clinical decline', async () => {
    mocks.nextTrial = makeTrial({
      namingAccuracy: 0,
      recallAccuracy: 1,
      namingAttempts: [
        { targetWord: 'apple', userResponse: '', correct: false, reactionTimeMs: 900 },
        { targetWord: 'dog', userResponse: 'um', correct: false, reactionTimeMs: 1000 },
        { targetWord: 'chair', userResponse: 'hmm', correct: false, reactionTimeMs: 1050 },
      ],
    });

    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic dual-task' }));

    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      trialMode: 'mixed',
      clinicalProgressionEligible: false,
      errorType: 'unscorable_naming_attempt',
      taskParameters: expect.objectContaining({
        scorable_spoken_naming_attempts: 0,
        skipped_or_unscorable_naming_attempts: 3,
      }),
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
    expect(mocks.recordDynamicTier).not.toHaveBeenCalled();
  });
});
