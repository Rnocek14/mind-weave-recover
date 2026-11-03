import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSpeechScoreExclusion } from '@/lib/clinical/gameMeasurementContracts';

const mocks = vi.hoisted(() => ({
  submitTrial: vi.fn(), commitSession: vi.fn(), navigate: vi.fn(),
  recordDynamicTier: vi.fn(),
}));

vi.mock('react-router-dom', async (imp) => {
  const real = await imp<typeof import('react-router-dom')>();
  return { ...real, useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: {}, search: '' }) };
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
    difficultyTier: 2, loading: false,
    focusPhonemes: [], adaptations: {},
  }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useSentenceConstructionProgression', () => ({
  useSentenceConstructionProgression: () => ({
    loaded: true, startingLevel: 1, state: { supportBaseline: 0 },
  }),
  mapSentenceConstructionSupport: () => 'recognition_only',
}));
vi.mock('@/lib/progression/sentenceConstructionDifficultyBridge', () => ({
  resolveEffectiveSentenceConstructionInitialDifficulty: () => ({
    effective: 2, clinicalFloor: 2, softRegressionScaffold: false,
  }),
}));
vi.mock('@/hooks/useExerciseConfig', () => ({
  useExerciseConfig: () => ({
    config: {}, hasCapabilityAdaptations: false,
    bounds: { floor: 1, ceiling: 10, suggestedStart: 2 },
  }),
}));
vi.mock('@/hooks/useExerciseGating', () => ({
  useExerciseGating: () => ({ getAdaptations: () => null }),
}));
vi.mock('@/hooks/useDynamicTier', () => ({
  useDynamicTier: () => ({
    currentTier: 2, recordTrial: mocks.recordDynamicTier,
    getAdaptationsActive: () => ({}),
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial, commitSession: mocks.commitSession,
  }),
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
vi.mock('@/components/SentenceConstructionGame', () => ({
  SentenceConstructionGame: ({ onTrialComplete }: {
    onTrialComplete: (value: unknown) => void;
  }) => <div>
    <button onClick={() => onTrialComplete({
      correct: true, reactionTime: 1200, errorType: null,
      grammarFocus: 'SVO', trialId: 'synthetic-svo-1',
      trialSource: 'graded_sentence_bank', hintUsed: false, difficulty: 2,
      inputMode: 'word_tiles', browserTranscript: null,
      selectedAnswerWords: ['the', 'dog', 'runs'],
    })}>Submit actual tile callback</button>
    <button onClick={() => onTrialComplete({
      correct: true, reactionTime: 1400, errorType: null,
      grammarFocus: 'SVO', trialId: 'synthetic-svo-2',
      trialSource: 'graded_sentence_bank', hintUsed: true, difficulty: 2,
      inputMode: 'browser_recognized', browserTranscript: 'the dog runs',
      selectedAnswerWords: ['the', 'dog', 'runs'],
    })}>Submit actual browser speech callback</button>
  </div>,
}));

import SentenceConstructionExercise from './SentenceConstructionExercise';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.submitTrial.mockResolvedValue({ ok: true });
  mocks.commitSession.mockResolvedValue({ ok: true, errors: [] });
});
afterEach(cleanup);

describe('Sentence Construction real page-to-writer evidence', () => {
  it('preserves actual tile source and excludes correct tile arrangements from speech metrics', async () => {
    render(<SentenceConstructionExercise />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit actual tile callback' }));
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    const input = mocks.submitTrial.mock.calls[0][0];
    expect(input).toMatchObject({
      profileId: 'synthetic-patient', sessionId: 'synthetic-session',
      gameId: 'sentence_construction', trialMode: 'recognition',
      stimulusId: 'synthetic-svo-1', browserTranscript: null,
      userResponse: 'the dog runs', accuracyScore: 1,
      taskParameters: {
        sentence_structure: 'SVO', thematic_roles: null,
        production_mode: 'word_tile_selection',
        input_mode: 'tap', displayed_word_options: true,
      },
    });
    expect(getSpeechScoreExclusion(input.gameId, input.trialMode, input.taskParameters))
      .toBe('trial_mode_not_spoken_production');
  });

  it('marks browser speech mapped onto displayed word tiles as supported, not independent', async () => {
    render(<SentenceConstructionExercise />);
    fireEvent.click(await screen.findByRole('button', { name: 'Submit actual browser speech callback' }));
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      gameId: 'sentence_construction', trialMode: 'scaffolded',
      stimulusId: 'synthetic-svo-2', browserTranscript: 'the dog runs',
      userResponse: 'the dog runs',
      taskParameters: expect.objectContaining({
        input_mode: 'browser_recognized',
        production_mode: 'browser_recognized_scaffolded',
        human_sentence_judgement: false,
        audio_model_requested: true,
      }),
    }));
  });
});
