import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MinimalPairsGame } from '@/components/MinimalPairsGame';

const dependencies = vi.hoisted(() => ({
  speak: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelRecording: vi.fn(),
  analyzePronunciation: vi.fn(),
  awaitMicSafe: vi.fn(),
  recordTrial: vi.fn(),
  recordEngagement: vi.fn(),
  signalShift: vi.fn(),
  getMinimalPairTrialsForLevel: vi.fn(),
  onTrialComplete: vi.fn(),
}));

vi.mock('@/hooks/useMayaExerciseFrame', () => ({
  useMayaExerciseFrame: () => ({
    buildReflection: () => ({ nextStep: '', reflection: '', realLifeLine: '' }),
  }),
}));
vi.mock('@/hooks/useVoiceGuidance', () => ({
  useVoiceGuidance: () => ({
    shouldAutoSpeak: false,
    speakIntro: dependencies.speak,
    speakReminder: dependencies.speak,
  }),
}));
vi.mock('@/contexts/KidsModeContext', () => ({ useKidsMode: () => ({ kidsMode: false }) }));
vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({
    speak: dependencies.speak, isLoading: false, error: null,
  }),
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isSupported: true,
    startRecording: dependencies.startRecording,
    stopRecording: dependencies.stopRecording,
    cancelRecording: dependencies.cancelRecording,
  }),
}));
vi.mock('@/hooks/usePronunciationAnalysis', () => ({
  usePronunciationAnalysis: () => ({ analyzePronunciation: dependencies.analyzePronunciation }),
}));
vi.mock('@/lib/voiceController', () => ({
  voiceController: {
    awaitMicSafe: dependencies.awaitMicSafe,
    get isSessionPaused() { return false; },
    subscribeSessionPaused: () => () => {},
  },
}));
vi.mock('@/hooks/useInGameAdaptation', () => ({
  useInGameAdaptation: () => ({
    levelDescriptor: null, recentSuccessRate: null,
    recordTrial: dependencies.recordTrial,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    recordTrial: dependencies.recordEngagement,
  }),
}));
vi.mock('@/components/AdaptationBadge', () => ({
  AdaptationBadge: () => null,
  useAdaptationShift: () => ({
    direction: null, reason: null, signal: dependencies.signalShift,
  }),
}));
vi.mock('@/components/exercise/LevelBadge', () => ({ LevelBadge: () => null }));
vi.mock('@/components/ExercisePurposeBanner', () => ({ ExercisePurposeBanner: () => null }));
vi.mock('@/components/StructuredFeedbackSummary', () => ({ StructuredFeedbackSummary: () => null }));
vi.mock('@/data/minimalPairsBank', () => ({
  mapEngineLevelToMinimalPairsTier: () => 1,
  getMinimalPairTrialsForLevel: dependencies.getMinimalPairTrialsForLevel,
}));

const trial = {
  pair: { id: 'cat-hat', word1: 'cat', word2: 'hat', phoneme1: 'k', phoneme2: 'h', contrastDescription: 'Initial consonant' },
  targetIndex: 0, targetWord: 'cat',
  trial1: { imageUrl: '/cat.jpg' }, trial2: { imageUrl: '/hat.jpg' },
};
const audioBlob = new Blob(['cat recording'], { type: 'audio/webm' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  dependencies.getMinimalPairTrialsForLevel.mockReturnValue([trial]);
  dependencies.speak.mockResolvedValue(undefined);
  dependencies.awaitMicSafe.mockResolvedValue(true);
  dependencies.startRecording.mockResolvedValue(true);
  dependencies.stopRecording.mockResolvedValue({ audioBlob, duration: 1500, mimeType: 'audio/webm' });
  dependencies.analyzePronunciation.mockResolvedValue({
    ok: true,
    pronRequestId: 'azure-cat-1',
    data: {
      transcript: 'cat', accuracyScore: 79,
      pronunciationScore: 73, fluencyScore: 70, completenessScore: 100, words: [],
    },
  });
});

describe('Minimal Pairs picture click to spoken production', () => {
  it('records real speech, invokes pronunciation assessment and reports both observations without changing discrimination correctness', async () => {
    render(<MinimalPairsGame totalTrials={1} onTrialComplete={dependencies.onTrialComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Option 1' }));

    await waitFor(() => expect(dependencies.startRecording).toHaveBeenCalledOnce());
    expect(await screen.findByText(/Listening — say/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Done speaking/i }));

    await waitFor(() => expect(dependencies.analyzePronunciation).toHaveBeenCalledWith(audioBlob, 'cat'));
    expect(await screen.findByText(/Pronunciation estimate: 79 \/ 100/)).toBeTruthy();
    await waitFor(() => expect(dependencies.onTrialComplete).toHaveBeenCalledOnce());
    expect(dependencies.onTrialComplete).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true, targetWord: 'cat', selectedWord: 'cat',
      echoAttempted: true, echoAnalysisStatus: 'analyzed',
      echoAccuracyScore: 79, echoPronunciationScore: 73,
      echoPronRequestId: 'azure-cat-1', echoTranscript: 'cat',
    }));
  });

  it('keeps an Azure error separate from the picture score and never invents pronunciation accuracy', async () => {
    dependencies.analyzePronunciation.mockResolvedValue({ ok: false, error: { stage: 'azure_api', message: 'NoMatch' } });
    render(<MinimalPairsGame totalTrials={1} onTrialComplete={dependencies.onTrialComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Option 1' }));
    await screen.findByText(/Listening — say/);
    fireEvent.click(screen.getByRole('button', { name: /Done speaking/i }));

    expect(await screen.findByText(/Speech analysis was unavailable/)).toBeTruthy();
    await waitFor(() => expect(dependencies.onTrialComplete).toHaveBeenCalledOnce());
    expect(dependencies.onTrialComplete).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect: true, targetWord: 'cat',
      echoAnalysisStatus: 'unavailable',
      echoAccuracyScore: undefined, echoPronunciationScore: undefined,
    }));
  });
  it('measures picture reaction time at the tap, not when delayed Azure assessment completes', async () => {
    let now = 1000;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const { unmount } = render(<MinimalPairsGame totalTrials={1} onTrialComplete={dependencies.onTrialComplete} />);
      now = 1700;
      fireEvent.click(screen.getByRole('button', { name: 'Option 1' }));
      await screen.findByText(/Listening — say/);
      // Speech processing finishes much later; it must not inflate the
      // patient's recorded picture-discrimination response latency.
      now = 12000;
      fireEvent.click(screen.getByRole('button', { name: /Done speaking/i }));
      await waitFor(() => expect(dependencies.onTrialComplete).toHaveBeenCalledOnce());
      expect(dependencies.onTrialComplete).toHaveBeenCalledWith(expect.objectContaining({
        isCorrect: true, reactionTimeMs: 700,
        echoAnalysisStatus: 'analyzed',
      }));
      unmount();
    } finally {
      clock.mockRestore();
    }
  });

});
