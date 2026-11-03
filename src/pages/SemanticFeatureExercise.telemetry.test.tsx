import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSpeechScoreExclusion } from '@/lib/clinical/gameMeasurementContracts';

const mocks = vi.hoisted(() => ({
  submitTrial: vi.fn(), commitSession: vi.fn(), navigate: vi.fn(),
  recordPivot: vi.fn(), toast: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...real, useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: {}, search: '' }),
  };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-patient' } }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: true, sessionId: 'synthetic-session',
    returnTo: '/lesson', adaptations: null,
  }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({
    difficultyTier: 2, adaptationReasons: [],
    focusPhonemes: [], loading: false,
  }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useSemanticFeaturesProgression', () => ({
  useSemanticFeaturesProgression: () => ({
    loaded: true, startingLevel: 1, state: { supportBaseline: 0 },
  }),
  mapSemanticFeaturesSupport: () => 'semantic_cue',
}));
vi.mock('@/lib/progression/semanticFeaturesDifficultyBridge', () => ({
  resolveEffectiveSemanticFeaturesInitialDifficulty: () => ({
    effective: 2, clinicalFloor: 2, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useExerciseConfig', () => ({
  useExerciseConfig: () => ({
    config: { startDifficulty: 2 },
    bounds: { floor: 1, ceiling: 5, suggestedStart: 2 },
    hasCapabilityAdaptations: false,
  }),
}));
vi.mock('@/hooks/useExerciseGating', () => ({
  useExerciseGating: () => ({ getAdaptations: () => null }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: mocks.recordPivot,
    shouldStepDown: false, pivotReason: null,
    hasPending: false, acknowledge: vi.fn(),
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial, commitSession: mocks.commitSession,
  }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({
        single: async () => ({ data: { clinical_profile: null }, error: null }),
      }) }),
    }),
  },
}));
vi.mock('@/components/DifficultyInfoBadge', () => ({
  DifficultyInfoBadge: () => null,
}));
vi.mock('@/components/SemanticFeatureGame', () => ({
  SemanticFeatureGame: ({ onTrialComplete }: {
    onTrialComplete: (result: unknown) => void;
  }) => (
    <button onClick={() => onTrialComplete({
      correct: true, reactionTime: 1200, cueLevel: 1,
      word: 'apple', difficulty: 2, featuresCorrect: 2,
      featuresMissed: 1, featuresIncorrect: 1,
      retrievalCorrect: true, retrievalSelectedWord: 'apple',
      selectedFeatureChoices: [
        { text: 'red', category: 'perceptual' },
        { text: 'you eat it', category: 'functional' },
        { text: 'is metal', category: 'perceptual' },
      ],
      visibleFeatureOptionCount: 6,
      featureBreakdown: { perceptual: { hit: 1, miss: 1 } },
    })}>Submit actual SFA selection callback</button>
  ),
}));

import SemanticFeatureExercise from './SemanticFeatureExercise';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.commitSession.mockResolvedValue({ ok: true, errors: [] });
});
afterEach(cleanup);

describe('SFA real page-to-writer source provenance', () => {
  it('routes feature-option selection as recognition, never independent speech', async () => {
    render(<SemanticFeatureExercise />);
    const button = await screen.findByRole('button', {
      name: 'Submit actual SFA selection callback',
    });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    const input = mocks.submitTrial.mock.calls[0][0];
    expect(input).toMatchObject({
      profileId: 'synthetic-patient', sessionId: 'synthetic-session',
      gameId: 'semantic_features', trialMode: 'recognition',
      expectedResponse: 'apple', userResponse: 'apple',
      accuracyScore: 1,
      taskParameters: {
        input_mode: 'choice', target_word: 'apple',
        independent_features: null, nonredundant_feature_count: null,
        observed_selected_feature_count: 3,
        selected_feature_options: expect.arrayContaining([
          { text: 'red', category: 'perceptual' },
        ]),
        retrieval_selected_word: 'apple',
        independent_feature_generation_observed: false,
      },
    });
    expect(getSpeechScoreExclusion(input.gameId, input.trialMode, input.taskParameters))
      .toBe('trial_mode_not_spoken_production');
  });
});
