import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DualLoadTrialResult } from '@/hooks/useDualLoadNamingGame';

const stubs = vi.hoisted(() => ({
  submitTrial: vi.fn(),
  commitSession: vi.fn(),
  recordPivot: vi.fn(),
  recordTier: vi.fn(),
  acknowledgePivot: vi.fn(),
  round: null as DualLoadTrialResult | null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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
  useRestoredLessonContext: () => ({ fromLesson: false, returnTo: '/today', sessionId: 'synthetic-session' }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: vi.fn() }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 5, focusPhonemes: [], loading: false }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useDualLoadNamingProgression', () => ({
  useDualLoadNamingProgression: () => ({
    loaded: true, startingLevel: 5, state: { supportBaseline: 0 },
  }),
  mapDualLoadNamingSupport: () => 'open_response',
}));
vi.mock('@/lib/progression/dualLoadNamingDifficultyBridge', () => ({
  resolveEffectiveDualLoadNamingInitialDifficulty: () => ({
    effective: 5, clinicalFloor: 5, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useDynamicTier', () => ({
  useDynamicTier: () => ({
    currentTier: 2,
    recordTrial: stubs.recordTier,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: stubs.recordPivot,
    acknowledge: stubs.acknowledgePivot,
    shouldStepDown: false,
    hasPending: false,
    pivotReason: null,
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: stubs.submitTrial,
    commitSession: stubs.commitSession,
  }),
}));
vi.mock('@/components/DualLoadNamingGame', () => ({
  DualLoadNamingGame: ({ onTrialComplete }: {
    onTrialComplete: (value: DualLoadTrialResult) => void;
  }) => (
    <button type="button" onClick={() => {
      if (!stubs.round) throw new Error('Missing synthetic dual-load round');
      onTrialComplete(stubs.round);
    }}>
      Submit synthetic dual-load attempt
    </button>
  ),
}));

import DualLoadNamingExercise from './DualLoadNamingExercise';

const naming = (correctCount: number, total = 5) =>
  Array.from({ length: total }, (_, i) => ({
    targetWord: `word-${i}`,
    userResponse: i < correctCount ? `word-${i}` : `other-${i}`,
    correct: i < correctCount,
    reactionTimeMs: 1000,
  }));

const synthetic = (overrides: Partial<DualLoadTrialResult> = {}): DualLoadTrialResult => ({
  setId: 'set-1',
  namingAccuracy: 0.6,
  namingAttempts: naming(3),
  recallAccuracy: 1,
  recalledWords: ['one', 'two', 'three'],
  interferenceIndex: 0.3,
  durationMs: 30000,
  depthTelemetry: {
    taskType: 'dual_load_naming',
    namingAccuracy: 0.6,
    recallAccuracy: 1,
    interferenceIndex: 0.3,
    baselineSource: 'heuristic',
    baselineAcc: 0.9,
  },
  ...overrides,
});

describe('DualLoadNamingExercise records mixed-domain evidence without speech inflation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubs.round = synthetic();
    stubs.submitTrial.mockResolvedValue({ ok: true });
    stubs.commitSession.mockResolvedValue({ ok: true, errors: [] });
  });

  it('routes a complete dual-task success to its own ladder, not independent expressive mastery', () => {
    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit synthetic dual-load attempt' }));

    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true,
      trialMode: 'mixed',
      clinicalProgressionEligible: true,
      taskParameters: expect.objectContaining({
        naming_input_mode: 'spoken',
        recall_input_mode: 'typed',
        verified_expressive_mastery_eligible: false,
        mixed_task_unscorable_reason: null,
      }),
    }));
    expect(stubs.recordPivot).toHaveBeenCalledWith(expect.objectContaining({ wasCorrect: true }));
    expect(stubs.recordTier).toHaveBeenCalledWith(expect.objectContaining({ correct: true }));
  });

  it('does not award clinical success for good typed recall with zero correct spoken naming', () => {
    stubs.round = synthetic({ namingAccuracy: 0, namingAttempts: naming(0) });
    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit synthetic dual-load attempt' }));

    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      trialMode: 'mixed',
      clinicalProgressionEligible: true,
      errorType: 'naming_under_load',
    }));
    expect(stubs.recordPivot).toHaveBeenCalledWith(expect.objectContaining({ wasCorrect: false }));
    expect(stubs.recordTier).toHaveBeenCalledWith(expect.objectContaining({ correct: false }));
  });

  it('keeps invalid component metrics out of saved accuracy and session progression', () => {
    stubs.round = synthetic({
      namingAccuracy: Number.NaN,
      namingAttempts: naming(3),
    });
    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit synthetic dual-load attempt' }));

    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      accuracyScore: null,
      clinicalProgressionEligible: false,
      trialMode: 'mixed',
      errorType: 'invalid_metrics',
    }));
    expect(stubs.recordPivot).not.toHaveBeenCalled();
    expect(stubs.recordTier).not.toHaveBeenCalled();
  });

  it('saves skipped naming as practice without driving the clinical difficulty controller', () => {
    stubs.round = synthetic({
      namingAccuracy: 0,
      namingAttempts: [{ targetWord: 'cat', userResponse: '', correct: false, reactionTimeMs: 1000 }],
    });
    render(<DualLoadNamingExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit synthetic dual-load attempt' }));

    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      clinicalProgressionEligible: false,
      trialMode: 'mixed',
      errorType: 'missing_or_filler_speech',
    }));
    expect(stubs.recordPivot).not.toHaveBeenCalled();
    expect(stubs.recordTier).not.toHaveBeenCalled();
  });
});
