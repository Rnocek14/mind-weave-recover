/**
 * Meaning Match lesson-boundary test: the REAL page's completion handler
 * must respect the shared raw-write gate. Game, Supabase and session network
 * hooks are controlled stubs so no patient backend is used.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';

const mocks = vi.hoisted(() => ({
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  navigate: vi.fn(),
  submitTrial: vi.fn(),
}));

vi.mock('react-router-dom', async (original) => {
  const actual = await original<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { trialLimit: 1 } }),
  };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }) }));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: true, returnTo: '/lesson',
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
  useSessionAdaptation: () => ({ difficultyTier: 1, recommendedCueType: 'none' }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({ buildAdaptationTelemetry: () => ({}) }));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial,
    commitSession: mocks.commitSession,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: vi.fn(), shouldStepDown: false, hasPending: false,
  }),
}));
vi.mock('@/hooks/useMeaningMatchProgression', () => ({
  useMeaningMatchProgression: () => ({
    startingLevel: 1, loaded: true, state: { supportBaseline: 0 },
  }),
  mapMeaningMatchSupport: () => 'recognition_only',
}));
vi.mock('@/lib/progression/meaningMatchDifficultyBridge', () => ({
  resolveEffectiveMeaningMatchInitialDifficulty: () => ({
    effective: 1, clinicalFloor: 1, softRegressionScaffold: false,
  }),
}));
vi.mock('@/components/MeaningMatchGame', () => ({
  MeaningMatchGame: ({ onTrialComplete, onGameComplete }: {
    onTrialComplete: (result: MeaningMatchTrialResult) => void;
    onGameComplete: (results: { points: number }[]) => Promise<void> | void;
  }) => (<>
    <button onClick={() => onTrialComplete({
      itemId:'mm-fixture-1',correct:false,
      selectedIndex:1,correctIndex:2,
      presentedOptions:['Carry a box','Open the door','Ask for help'],
      reactionTimeMs:2100,tier:1,type:'literal',
      usedHint:true,points:0,
    })}>Submit actual Meaning Match callback</button>
    <button onClick={() => { void onGameComplete([{ points: 5 }]); }}>
      Finish synthetic matching round
    </button>
  </>),
}));
vi.mock('@/components/InlineSessionProgress', () => ({ InlineSessionProgress: () => null }));
vi.mock('@/components/SessionSidePanel', () => ({ SessionSidePanel: () => null }));

import MeaningMatchExercise from '@/pages/MeaningMatchExercise';

describe('Meaning Match saves and lesson continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commitSession.mockResolvedValue({
      ok: true, errors: [], progression: null, masteryFlushed: true,
    });
    mocks.completeSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('does not close the lesson or claim success after a failed raw attempt write', async () => {
    mocks.commitSession.mockResolvedValue({
      ok: false,
      errors: ['raw clinical event writes failed: 1 of this session\'s trial submissions; progression and mastery were not flushed'],
      progression: null,
      masteryFlushed: false,
    });
    render(<MeaningMatchExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic matching round' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Results not saved'));
    expect(screen.queryByText('Arena Complete!')).toBeNull();
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Return to Today' })).toBeTruthy();
  });

  it('still completes when raw writes are confirmed by the clinical commit', async () => {
    render(<MeaningMatchExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish synthetic matching round' }));
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Arena Complete!')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('saves the actual selected meaning, correct competitor, hint and nonspoken source', async () => {
    mocks.submitTrial.mockResolvedValue({ok:true});
    render(<MeaningMatchExercise />);
    fireEvent.click(screen.getByRole('button',{name:'Submit actual Meaning Match callback'}));
    await waitFor(()=>expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      profileId:'synthetic-profile',sessionId:'synthetic-session',
      gameId:'meaning_match',
      trialMode:'recognition',isCorrect:false,
      stimulusId:'mm-fixture-1',
      userResponse:'Open the door',
      expectedResponse:'Ask for help',
      taskParameters:expect.objectContaining({
        item_id:'mm-fixture-1',
        semantic_competitor_selection_index:1,correct_option_index:2,
        selected_option_text:'Open the door',
        correct_option_text:'Ask for help',
        presented_options:['Carry a box','Open the door','Ask for help'],
        response_input_mode:'tap',used_hint:true,
        clinical_spoken_production_evidence:false,
        human_comprehension_adjudication:false,
      }),
    }));
  });

});
