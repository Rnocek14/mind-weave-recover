import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';

const mocks = vi.hoisted(() => ({
  nextTrial: null as PlanningTrialResult | null,
  submitTrial: vi.fn(),
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  recordPivot: vi.fn(),
  acknowledgePivot: vi.fn(),
  navigate: vi.fn(),
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
    fromLesson: false, returnTo: '/today',
    sessionId: 'synthetic-session', adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 5, loading: false }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useMultiStepPlanningProgression', () => ({
  useMultiStepPlanningProgression: () => ({
    loaded: true, startingLevel: 3, state: { supportBaseline: 0 },
  }),
  mapMultiStepPlanningSupport: () => 'open_response',
}));
vi.mock('@/lib/progression/multiStepPlanningDifficultyBridge', () => ({
  resolveEffectiveMultiStepPlanningInitialDifficulty: () => ({
    effective: 5, clinicalFloor: 5, softRegressionScaffold: false,
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
vi.mock('@/components/MultiStepPlanningGame', () => ({
  MultiStepPlanningGame: ({
    onTrialComplete, onGameComplete,
  }: {
    onTrialComplete: (value: PlanningTrialResult) => void | Promise<void>;
    onGameComplete: (values: PlanningTrialResult[]) => void | Promise<void>;
  }) => (
    <button onClick={() => {
      if (!mocks.nextTrial) throw new Error('Missing synthetic planning result');
      void onTrialComplete(mocks.nextTrial);
      void onGameComplete([mocks.nextTrial]);
    }}>
      Finish synthetic plan
    </button>
  ),
}));

import MultiStepPlanExercise from './MultiStepPlanExercise';

const trial = (overrides: Partial<PlanningTrialResult> = {}): PlanningTrialResult => ({
  itemId: 'synthetic-goal',
  goal: 'Make tea',
  tier: 2,
  transcript: 'boil water then pour water and add milk',
  stepCount: 3,
  stepsFound: 3,
  stepsTotal: 5,
  goalCoverage: 0.6,
  sequenceScore: 1,
  sequenceEvidenceAvailable: true,
  sequenceMatchedSteps: 3,
  sequenceMethod: 'distinctive_tokens_v1',
  durationMs: 10000,
  skipped: false,
  inputMode: 'spoken',
  completionReason: 'completed',
  responseValid: true,
  browserTranscript: 'boil water then pour water and add milk',
  depthTelemetry: {
    taskType: 'multi_step_plan',
    stepCount: 3,
    sequenceScore: 1,
    goalCoverage: 0.6,
  },
  ...overrides,
});

describe('MultiStepPlanExercise clinical result routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nextTrial = trial();
    mocks.submitTrial.mockResolvedValue({ ok: true });
    mocks.commitSession.mockResolvedValue({ ok: true, errors: [] });
  });
  afterEach(() => cleanup());

  const complete = () => {
    render(<MultiStepPlanExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic plan' }));
  };

  it('does not credit 60%+ step coverage as success when sequence order fails', async () => {
    mocks.nextTrial = trial({ goalCoverage: 0.8, sequenceScore: 0 });
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      trialMode: 'production',
      clinicalProgressionEligible: true,
      errorType: 'sequence_disorder',
      taskParameters: expect.objectContaining({
        required_goal_coverage: 0.6,
        required_sequence_score: 0.5,
        sequence_score: 0,
      }),
    }));
    expect(mocks.recordPivot).toHaveBeenCalledWith(expect.objectContaining({ wasCorrect: false }));
  });

  it('retains successful typed planning as unscored practice, not speech mastery', async () => {
    mocks.nextTrial = trial({ inputMode: 'typed', browserTranscript: null });
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true,
      trialMode: 'mixed',
      clinicalProgressionEligible: false,
      browserTranscript: null,
      userResponse: 'boil water then pour water and add milk',
      errorType: 'typed_practice',
      taskParameters: expect.objectContaining({
        input_mode: 'typed',
        response_valid: true,
        sequence_evidence_available: true,
      }),
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });

  it('excludes skip and uncertain speech from negative clinical progression', async () => {
    mocks.nextTrial = trial({
      inputMode: 'none', completionReason: 'skipped', skipped: true,
      transcript: '', browserTranscript: null, responseValid: false,
      sequenceEvidenceAvailable: false, sequenceMatchedSteps: 0,
      goalCoverage: 0, sequenceScore: 0,
    });
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      trialMode: 'mixed',
      clinicalProgressionEligible: false,
      errorType: 'skipped',
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });

  it('routes only valid spoken ordered plans as independent production', async () => {
    mocks.nextTrial = trial({ observedStepOrder: [2, 0, 1] });
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true,
      trialMode: 'production',
      clinicalProgressionEligible: true,
      browserTranscript: 'boil water then pour water and add milk',
      taskParameters: expect.objectContaining({
        sequence_method: 'distinctive_tokens_v1',
        plan_id: 'synthetic-goal',
        steps_in_order: [2, 0, 1],
        constraint_violations: null,
        step_order_evidence_source: 'distinctive_transcript_tokens_v1',
        sequence_evidence_available: true,
        completion_reason: 'completed',
      }),
    }));
    expect(mocks.recordPivot).toHaveBeenCalledWith(expect.objectContaining({ wasCorrect: true }));
  });
});
