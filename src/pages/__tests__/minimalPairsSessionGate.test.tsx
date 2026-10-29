import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ startSession: vi.fn(), completeSession: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'audit-user' } }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: { id: 'audit-profile' } }) }));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({ fromLesson: false, returnTo: '/today', sessionId: null }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({
    loading: false, difficultyTier: 1, focusPhonemes: [], recommendedCueType: 'none',
  }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({ buildAdaptationTelemetry: () => ({}) }));
vi.mock('@/hooks/useMinimalPairsProgression', () => ({
  useMinimalPairsProgression: () => ({ loaded: true, startingLevel: 1, state: null }),
  mapMinimalPairsSupport: () => 'independent',
}));
vi.mock('@/lib/progression/minimalPairsDifficultyBridge', () => ({
  resolveEffectiveMinimalPairsInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({ submitTrial: vi.fn(), commitSession: async () => ({ ok: true }) }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({ recordTrialResult: vi.fn(), shouldStepDown: false }),
}));
vi.mock('@/data/minimalPairsBank', () => ({
  getMinimalPairStats: () => ({ total: 10, byCategory: { consonant: 10 } }),
}));
vi.mock('@/lib/sessionTracking', () => ({ startSession: mocks.startSession }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }) }),
      }),
    }),
  },
}));
vi.mock('@/components/MinimalPairsGame', () => ({
  MinimalPairsGame: () => <div data-testid="actual-minimal-pairs-game-mounted">Game answers are available</div>,
}));

import MinimalPairsExercise from '../MinimalPairsExercise';
import { clearStandaloneSessionMutex } from '@/hooks/useStandaloneSession';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.startSession.mockReset();
  mocks.completeSession.mockReset();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); clearStandaloneSessionMutex(); });

describe('Minimal Pairs session-before-game patient-safety boundary', () => {
  it('never renders answer controls while the authenticated session INSERT is still pending', async () => {
    const pending = deferred<{ id: string; user_id: string; profile_id: string }>();
    mocks.startSession.mockReturnValue(pending.promise);
    render(<MemoryRouter><MinimalPairsExercise /></MemoryRouter>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start Practice' }));
      await Promise.resolve();
    });

    expect(mocks.startSession).toHaveBeenCalledTimes(1);
    // The game must not accept a response that cannot be attributed to a
    // confirmed session ID. Prior implementation mounted the game immediately.
    expect(screen.queryByTestId('actual-minimal-pairs-game-mounted')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Loading exercise');

    await act(async () => {
      pending.resolve({ id: 'saved-session', user_id: 'audit-user', profile_id: 'audit-profile' });
      await Promise.resolve();
    });

    expect(await screen.findByTestId('actual-minimal-pairs-game-mounted')).toBeVisible();
  });
});
