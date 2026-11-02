import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SynonymRoundResult } from '@/components/SynonymGeneratorGame';

const stubs = vi.hoisted(() => ({
  submitTrial: vi.fn(),
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  recordPivot: vi.fn(),
  acknowledgePivot: vi.fn(),
  navigate: vi.fn(),
  round: null as SynonymRoundResult | null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => stubs.navigate,
  useLocation: () => ({ state: { trialLimit: 1 } }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false,
    returnTo: '/today',
    sessionId: 'synthetic-session',
    adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: stubs.completeSession }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 5 }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useSynonymGeneratorProgression', () => ({
  useSynonymGeneratorProgression: () => ({
    loaded: true,
    startingLevel: 5,
    state: { supportBaseline: 0 },
  }),
  mapSynonymGeneratorSupport: () => 'open_response',
}));
vi.mock('@/lib/progression/synonymGeneratorDifficultyBridge', () => ({
  resolveEffectiveSynonymGeneratorInitialDifficulty: () => ({
    effective: 5,
    clinicalFloor: 5,
    softRegressionScaffold: false,
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
vi.mock('@/components/SynonymGeneratorGame', () => ({
  SynonymGeneratorGame: ({
    onRoundComplete,
    onGameComplete,
  }: {
    onRoundComplete: (value: SynonymRoundResult) => void;
    onGameComplete: (values: SynonymRoundResult[]) => void | Promise<void>;
  }) => (
    <button onClick={() => {
      if (!stubs.round) throw new Error('Synthetic test round not initialized');
      onRoundComplete(stubs.round);
      void onGameComplete([stubs.round]);
    }}>
      Finish synthetic synonym round
    </button>
  ),
}));

import SynonymGeneratorExercise from './SynonymGeneratorExercise';

const syntheticRound = (overrides: Partial<SynonymRoundResult> = {}): SynonymRoundResult => ({
  targetWord: 'happy',
  enteredWords: ['glad', 'joyful', 'cheerful', 'pleased'],
  matchedSynonyms: ['glad', 'joyful', 'cheerful', 'pleased'],
  unmatchedEntries: [],
  matchCount: 4,
  totalEntered: 4,
  durationSec: 25,
  timeLimitSec: 25,
  difficulty: 5,
  inputMode: 'spoken',
  completionReason: 'timer',
  browserTranscript: 'glad joyful cheerful pleased',
  ...overrides,
});

describe('SynonymGeneratorExercise persistence and actual played-tier scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubs.round = syntheticRound();
    stubs.commitSession.mockResolvedValue({ ok: true, errors: [] });
    stubs.submitTrial.mockResolvedValue({ ok: true });
  });

  it('preserves typed success as practice while withholding spoken progression and pivot', async () => {
    stubs.round = syntheticRound({
      inputMode: 'typed',
      browserTranscript: null,
      enteredWords: ['glad', 'joyful', 'cheerful', 'pleased'],
    });

    render(<SynonymGeneratorExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic synonym round' }));

    expect(stubs.submitTrial).toHaveBeenCalledTimes(1);
    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true,
      trialMode: 'mixed',
      clinicalProgressionEligible: false,
      browserTranscript: null,
      taskParameters: expect.objectContaining({
        input_mode: 'typed',
        completion_reason: 'timer',
        required_matches: 4,
        verified_spoken_score_eligible: false,
      }),
    }));
    expect(stubs.recordPivot).not.toHaveBeenCalled();
    await waitFor(() => expect(stubs.commitSession).toHaveBeenCalledTimes(1));
  });

  it('uses the actual difficulty-5 threshold of four for spoken trials, not the former two', async () => {
    stubs.round = syntheticRound({
      enteredWords: ['glad', 'joyful'],
      matchedSynonyms: ['glad', 'joyful'],
      matchCount: 2,
      totalEntered: 2,
      browserTranscript: 'glad joyful',
    });

    render(<SynonymGeneratorExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic synonym round' }));

    expect(stubs.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: false,
      trialMode: 'production',
      clinicalProgressionEligible: true,
      taskParameters: expect.objectContaining({ required_matches: 4 }),
    }));
    expect(stubs.recordPivot).toHaveBeenCalledWith(expect.objectContaining({
      wasCorrect: false,
    }));
    await waitFor(() => expect(stubs.commitSession).toHaveBeenCalledTimes(1));
  });

  it('awaits the final raw trial write before flushing progression and ending the session', async () => {
    let acknowledge!: (result: { ok: boolean }) => void;
    stubs.submitTrial.mockImplementation(() => new Promise(resolve => {
      acknowledge = resolve;
    }));
    const events: string[] = [];
    stubs.commitSession.mockImplementation(async () => {
      events.push('clinical-commit');
      return { ok: true, errors: [] };
    });
    stubs.completeSession.mockImplementation(() => events.push('session-complete'));

    render(<SynonymGeneratorExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic synonym round' }));

    expect(stubs.submitTrial).toHaveBeenCalledTimes(1);
    expect(stubs.commitSession).not.toHaveBeenCalled();
    expect(stubs.completeSession).not.toHaveBeenCalled();

    await act(async () => {
      events.push('raw-acknowledged');
      acknowledge({ ok: true });
      await Promise.resolve();
    });
    await waitFor(() => expect(stubs.completeSession).toHaveBeenCalledTimes(1));
    expect(events).toEqual(['raw-acknowledged', 'clinical-commit', 'session-complete']);
  });
});
