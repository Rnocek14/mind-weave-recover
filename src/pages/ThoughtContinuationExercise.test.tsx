import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThoughtTrainingStage } from '@/lib/thoughtContinuation/trainingStages';

type GameProps = {
  trainingStage?: ThoughtTrainingStage | null;
  practiceStageSource?: string;
  onRawEventWrite?: (pending: Promise<boolean>) => void;
  onComplete: (summary: {
    totalPrompts: number; promptsSpoken: number;
    avgMomentumScore: number; completedThoughts: number;
  }) => void | Promise<void>;
};

const mocks = vi.hoisted(() => ({
  profileId: 'patient-a',
  load: vi.fn(),
  navigate: vi.fn(),
  completeSession: vi.fn(),
  nextWrite: vi.fn<() => Promise<boolean>>(),
  latestGameProps: null as GameProps | null,
}));

vi.mock('react-router-dom', async (imp) => {
  const actual = await imp<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate, useLocation: () => ({ state: {} }) };
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
    fromLesson: false, returnTo: '/lesson', sessionId: null, adaptations: null,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'synthetic-session', isCreatingSession: false,
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({}),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({}),
}));
vi.mock('@/components/exercise/UnverifiedPracticeBanner', () => ({
  UnverifiedPracticeBanner: () => <div role="alert">Some practice results could not be saved.</div>,
}));
vi.mock('@/components/ThoughtContinuationGame', () => ({
  ThoughtContinuationGame: (props: GameProps) => {
    mocks.latestGameProps = props;
    return (
      <div>
        <p>Game stage {props.trainingStage?.level ?? 'general'}</p>
        <button onClick={() => {
          props.onRawEventWrite?.(mocks.nextWrite());
          void props.onComplete({
            totalPrompts: 1, promptsSpoken: 1,
            avgMomentumScore: 0.5, completedThoughts: 1,
          });
        }}>Complete synthetic stage</button>
      </div>
    );
  },
}));

import ThoughtContinuationExercise from './ThoughtContinuationExercise';

describe('ThoughtContinuationExercise real patient-stage integration', () => {
  beforeEach(() => {
    localStorage.removeItem('offlineMode');
    vi.clearAllMocks();
    mocks.profileId = 'patient-a';
    mocks.latestGameProps = null;
    mocks.load.mockResolvedValue({ currentLevel: 1 });
    mocks.nextWrite.mockImplementation(() => Promise.resolve(true));
    mocks.completeSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  async function startStage3() {
    await waitFor(() =>
      expect(screen.getByText(/Practice Stage 1: Finish a familiar sentence/)).toBeTruthy(),
    );
    const details = screen.getByText('Care partner: choose practice stage').closest('details');
    if (!details) throw new Error('Expected caregiver selector');
    details.open = true;
    fireEvent.click(screen.getByRole('button', { name: /Stage 3: Connect two ideas/ }));
    expect(screen.getByText(/Practice Stage 3: Connect two ideas/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(screen.getByText('Game stage 3')).toBeTruthy();
  }

  it('uses a selectable executable stage without overwriting the saved patient level', async () => {
    render(<ThoughtContinuationExercise />);
    await startStage3();
    expect(mocks.latestGameProps?.trainingStage?.level).toBe(3);
    expect(mocks.latestGameProps?.practiceStageSource).toBe('care_partner_selection');
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('awaits the last raw practice event before claiming the session was saved', async () => {
    let confirmWrite!: (ok: boolean) => void;
    mocks.nextWrite.mockImplementation(() => new Promise(resolve => { confirmWrite = resolve; }));
    render(<ThoughtContinuationExercise />);
    await startStage3();
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic stage' }));
    expect(mocks.completeSession).not.toHaveBeenCalled();
    await act(async () => { confirmWrite(true); await Promise.resolve(); });
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Great Session!')).toBeTruthy();
  });

  it('never advances a failed raw save as verified practice completion', async () => {
    mocks.nextWrite.mockResolvedValue(false);
    render(<ThoughtContinuationExercise />);
    await startStage3();
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic stage' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(screen.queryByText('Great Session!')).toBeNull();
  });

  it('does not expose prior patient stage override after switching profiles', async () => {
    mocks.load.mockResolvedValueOnce({ currentLevel: 1 })
      .mockResolvedValueOnce({ currentLevel: 2 });
    const { rerender } = render(<ThoughtContinuationExercise />);
    await startStage3();
    mocks.profileId = 'patient-b';
    rerender(<ThoughtContinuationExercise />);
    // A patient switch returns to the Ready screen instead of continuing a
    // previous patient's microphone, prompt, stage choice or summary.
    await waitFor(() => expect(screen.getByText(/Practice Stage 2: Choose what happens next/)).toBeTruthy());
    expect(screen.queryByText('Game stage 3')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(screen.getByText('Game stage 2')).toBeTruthy();
    expect(mocks.latestGameProps?.practiceStageSource).toBe('saved_level');
  });

  it('keeps unavailable stage reads explicit, without pretending to know Stage 1', async () => {
    mocks.load.mockResolvedValue({ currentLevel: 1, loadUnavailable: true });
    render(<ThoughtContinuationExercise />);
    await waitFor(() => expect(screen.getByText(/Your saved level could not be checked/)).toBeTruthy());
    expect(screen.queryByText(/Practice Stage 1: Finish a familiar sentence/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
    expect(screen.getByText('Game stage general')).toBeTruthy();
    expect(mocks.latestGameProps?.practiceStageSource).toBe('general_practice');
  });
});
