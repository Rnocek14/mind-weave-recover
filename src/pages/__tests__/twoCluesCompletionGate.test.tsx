import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fromLesson: false,
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  submitTrial: vi.fn(),
  retryFailedSubmissions: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: mocks.fromLesson,
    returnTo: '/lesson-flow',
    sessionId: mocks.fromLesson ? 'synthetic-lesson-session' : null,
    adaptations: null,
  }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({
    loading: false, difficultyTier: 1, focusPhonemes: [], recommendedCueType: 'none',
  }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({ buildAdaptationTelemetry: () => ({}) }));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'synthetic-session', isCreatingSession: false,
    sessionError: null, retrySession: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useTwoCluesProgression', () => ({
  useTwoCluesProgression: () => ({ loaded: true, startingLevel: 1, state: null }),
  mapTwoCluesSupport: () => 'independent',
}));
vi.mock('@/lib/progression/twoCluesDifficultyBridge', () => ({
  resolveEffectiveTwoCluesInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial, commitSession: mocks.commitSession,
    retryFailedSubmissions: mocks.retryFailedSubmissions,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: vi.fn(), shouldStepDown: false,
    acknowledge: vi.fn(), hasPending: false,
  }),
}));
vi.mock('@/components/TwoCluesGame', () => ({
  // Use the real page's onGameComplete callback; replace only the puzzle engine.
  TwoCluesGame: ({ onGameComplete }: { onGameComplete: (results: { score: number }[]) => void }) => (
    <button type="button" onClick={() => void onGameComplete([{ score: 1 }, { score: 3 }])}>
      Finish Two Clues
    </button>
  ),
}));
vi.mock('@/components/InlineSessionProgress', () => ({ InlineSessionProgress: () => null }));
vi.mock('@/components/SessionSidePanel', () => ({ SessionSidePanel: () => null }));

import TwoCluesExercise from '../TwoCluesExercise';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/exercise/two-clues']}>
      <Routes>
        <Route path="/exercise/two-clues" element={<TwoCluesExercise />} />
        <Route path="/lesson-flow" element={<div>Lesson resumed</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fromLesson = false;
  mocks.commitSession.mockResolvedValue({ ok: true });
  mocks.completeSession.mockResolvedValue(true);
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.retryFailedSubmissions.mockResolvedValue({ ok: true, recovered: 0, remaining: 0 });
});
afterEach(() => { cleanup(); });

describe('Two Clues: patient-visible completion requires confirmed persistence', () => {
  it('does not celebrate or close the session after a failed trial commit', async () => {
    mocks.commitSession.mockResolvedValue({ ok: false, errors: ['raw save failed'] });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));

    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Exercise Complete!' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try saving again' })).toBeVisible();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('waits for both trial commit and confirmed session close before showing success', async () => {
    const trialCommit = deferred<{ ok: boolean }>();
    const close = deferred<boolean>();
    mocks.commitSession.mockReturnValue(trialCommit.promise);
    mocks.completeSession.mockReturnValue(close.promise);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));

    expect(screen.getByRole('status')).toHaveTextContent('Saving your answers');
    expect(screen.queryByRole('heading', { name: 'Exercise Complete!' })).toBeNull();
    expect(mocks.completeSession).not.toHaveBeenCalled();

    trialCommit.resolve({ ok: true });
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: 'Exercise Complete!' })).toBeNull();

    close.resolve(true);
    expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
  });

  it('requires explicit raw-trial recovery before retrying a failed commit', async () => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    mocks.retryFailedSubmissions.mockResolvedValue({ ok: true, recovered: 1, remaining: 0 });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(mocks.retryFailedSubmissions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
    expect(mocks.retryFailedSubmissions).toHaveBeenCalledTimes(1);
    expect(mocks.retryFailedSubmissions.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.commitSession.mock.invocationCallOrder[1]);
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });

  it('must not close the session if a failed clinical attempt cannot be recovered', async () => {
    mocks.commitSession.mockResolvedValueOnce({ ok: false });
    mocks.retryFailedSubmissions.mockResolvedValue({ ok: false, recovered: 0, remaining: 1 });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    await waitFor(() => expect(mocks.retryFailedSubmissions).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('retries a failed close without re-committing confirmed clinical progression', async () => {
    mocks.completeSession.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));
    expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Exercise Complete!' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).toHaveBeenCalledTimes(2);
  });

  it('does not dispatch lesson completion on failure and sends it once after recovery', async () => {
    mocks.fromLesson = true;
    mocks.commitSession.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    const events: CustomEvent[] = [];
    const listen = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener('exercise-complete', listen);
    try {
      mount();
      fireEvent.click(screen.getByRole('button', { name: 'Finish Two Clues' }));
      expect(await screen.findByRole('heading', { name: 'Practice not saved' })).toBeVisible();
      expect(events).toHaveLength(0);
      expect(screen.queryByText('Lesson resumed')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
      expect(await screen.findByText('Lesson resumed')).toBeVisible();
      expect(events).toHaveLength(1);
      expect(events[0].detail).toMatchObject({
        exerciseSlug: 'two_clues', totalScore: 4,
      });
      expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('exercise-complete', listen);
    }
  });

  it('ignores duplicate finish clicks while a save is in flight', async () => {
    const pending = deferred<{ ok: boolean }>();
    mocks.commitSession.mockReturnValue(pending.promise);
    mount();
    const finish = screen.getByRole('button', { name: 'Finish Two Clues' });
    fireEvent.click(finish);
    // Reentrant callbacks must not launch a second commit.
    fireEvent.click(finish);
    expect(mocks.commitSession).toHaveBeenCalledTimes(1);

    pending.resolve({ ok: true });
    expect(await screen.findByRole('heading', { name: 'Exercise Complete!' })).toBeVisible();
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });
});
