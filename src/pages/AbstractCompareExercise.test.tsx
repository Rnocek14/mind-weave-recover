import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AbstractCompareTrialResult } from '@/hooks/useAbstractCompareGame';
import type { AbstractPracticeStage } from '@/lib/abstractCompare/trainingStages';

interface GameProps {
  trainingStage?: AbstractPracticeStage | null;
  onTrialComplete: (result: AbstractCompareTrialResult) => void;
  onGameComplete: (results: AbstractCompareTrialResult[]) => void | Promise<void>;
}
const mocks = vi.hoisted(() => ({
  profileId: 'patient-a',
  load: vi.fn(),
  logTrial: vi.fn(),
  completeSession: vi.fn(),
  navigate: vi.fn(),
  recordTier: vi.fn(),
  recordPivot: vi.fn(),
  lastGame: null as GameProps | null,
}));

vi.mock('react-router-dom', async (imp) => {
  const real = await imp<typeof import('react-router-dom')>();
  return {
    ...real,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { trialLimit: 1 } }),
  };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: mocks.profileId } }),
}));
vi.mock('@/lib/progression/clinicalProgression', () => ({
  loadProgressionState: mocks.load,
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false, returnTo: '/today', sessionId: null, adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'session-' + mocks.profileId,
    isCreatingSession: false,
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({ logTrial: mocks.logTrial }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 1 }),
}));
vi.mock('@/hooks/useDynamicTier', () => ({
  useDynamicTier: () => ({
    currentTier: 1, recordTrial: mocks.recordTier,
    getAdaptationsActive: () => null,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({ recordTrialResult: mocks.recordPivot }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/components/exercise/UnverifiedPracticeBanner', () => ({
  UnverifiedPracticeBanner: () => <div role="alert">Some practice results could not be saved.</div>,
}));
vi.mock('@/components/exercise/ExerciseLoading', () => ({
  ExerciseLoading: () => <div role="status">Preparing game</div>,
}));
vi.mock('@/components/AbstractCompareGame', () => ({
  AbstractCompareGame: (props: GameProps) => {
    mocks.lastGame = props;
    return (
      <div>
        <p>Active comparison stage {props.trainingStage?.level ?? 'general'}</p>
        <button onClick={() => {
          const trial: AbstractCompareTrialResult = {
            itemId: 'synthetic-pair', wordA: 'Dog', wordB: 'Cat',
            transcript: 'They both have fur', inputMode: 'typed',
            conceptCount: 1, conceptsTotal: 5, coverageRatio: 0.2,
            onTopicScore: 0.9, abstractionLevel: 'concrete',
            durationMs: 1000, skipped: false,
            depthTelemetry: {
              taskType: 'abstract_compare',
              abstractionLevel: 0.3, conceptCount: 1, coverageRatio: 0.2,
            },
          };
          props.onTrialComplete(trial);
          void props.onGameComplete([trial]);
        }}>Finish synthetic comparison</button>
      </div>
    );
  },
}));

import AbstractCompareExercise from './AbstractCompareExercise';

describe('Abstract Comparison patient practice and raw result integrity', () => {
  beforeEach(() => {
    localStorage.removeItem('offlineMode');
    vi.clearAllMocks();
    mocks.profileId = 'patient-a';
    mocks.lastGame = null;
    mocks.load.mockResolvedValue({ currentLevel: 1 });
    mocks.logTrial.mockResolvedValue(true);
    mocks.completeSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  async function chooseStage3() {
    await waitFor(() => expect(screen.getByText('Active comparison stage 1')).toBeTruthy());
    const selector = screen.getByText('Care partner: choose comparison practice').closest('details');
    if (!selector) throw new Error('Missing caregiver stage selector');
    selector.open = true;
    fireEvent.click(screen.getByRole('button', { name: 'Stage 3: Find the connection' }));
    expect(screen.getByText('Active comparison stage 3')).toBeTruthy();
    expect(mocks.lastGame?.trainingStage?.contentTier).toBe(2);
  }

  it('selects true Stage 3 practice without saving a new clinical level', async () => {
    render(<AbstractCompareExercise />);
    await chooseStage3();
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic comparison' }));
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      correct: false,
      taskParameters: expect.objectContaining({
        abstract_practice_stage: 3,
        practice_stage_source: 'care_partner_selection',
        tier: 2, trial_mode: 'typed',
        clinical_progression_eligible: false,
        clinical_stage_promotion_eligible: false,
        independent_spoken_score_eligible: false,
        difference_accuracy: null,
      }),
    }));
    expect(mocks.recordTier).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Comparisons Complete!')).toBeTruthy());
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('waits for the last attempt and blocks a completed session on failed saving', async () => {
    let resolveWrite!: (saved: boolean) => void;
    mocks.logTrial.mockImplementation(() =>
      new Promise<boolean>(resolve => { resolveWrite = resolve; }));
    render(<AbstractCompareExercise />);
    await waitFor(() => expect(screen.getByText('Active comparison stage 1')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic comparison' }));
    expect(mocks.completeSession).not.toHaveBeenCalled();
    await act(async () => { resolveWrite(false); await Promise.resolve(); });
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(screen.queryByText('Comparisons Complete!')).toBeNull();
  });

  it('does not reuse caregiver choice or a completed state after a profile switch', async () => {
    mocks.load.mockResolvedValueOnce({ currentLevel: 1 })
      .mockResolvedValueOnce({ currentLevel: 2 });
    const { rerender } = render(<AbstractCompareExercise />);
    await chooseStage3();
    mocks.profileId = 'patient-b';
    rerender(<AbstractCompareExercise />);
    await waitFor(() => expect(screen.getByText('Active comparison stage 2')).toBeTruthy());
    expect(mocks.lastGame?.trainingStage?.level).toBe(2);
  });

  it('failed stage read stays explicitly unknown instead of pretending to be beginner therapy', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    render(<AbstractCompareExercise />);
    await waitFor(() => expect(screen.getByText('Active comparison stage general')).toBeTruthy());
    expect(screen.getByText(/Your saved level could not be checked/)).toBeTruthy();
    expect(mocks.lastGame?.trainingStage).toBeNull();
  });
});
