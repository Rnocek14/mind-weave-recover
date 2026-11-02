import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  speechCallback: null as ((text: string) => void) | null,
  supported: true,
  startListening: vi.fn(),
  stopListening: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  uploadRecording: vi.fn(),
  startAttempt: vi.fn(),
  logFinalAnalysis: vi.fn(),
  resetAttempt: vi.fn(),
  recordAdaptation: vi.fn(),
  recordEngagement: vi.fn(),
}));

vi.mock('@/lib/shuffle', () => ({
  shuffleArray: <T,>(items: T[]): T[] => [...items],
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: (opts: { onResult: (text: string) => void }) => {
    mocks.speechCallback = opts.onResult;
    return {
      isListening: false,
      transcript: '',
      fullTranscript: '',
      isSupported: mocks.supported,
      startListening: mocks.startListening,
      stopListening: mocks.stopListening,
    };
  },
}));
vi.mock('@/hooks/useUtteranceLogger', () => ({
  useUtteranceLogger: () => ({
    startAttempt: mocks.startAttempt,
    logFinalAnalysis: mocks.logFinalAnalysis,
    resetAttempt: mocks.resetAttempt,
    currentAttemptId: null,
  }),
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
    uploadRecording: mocks.uploadRecording,
  }),
}));
vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: vi.fn() }),
}));
vi.mock('@/hooks/useInGameAdaptation', () => ({
  useInGameAdaptation: () => ({
    levelDescriptor: { clinicalLevel: 1 },
    recordTrial: mocks.recordAdaptation,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { hesitationCount: 0, timeoutRate: 0 } }),
    recordTrial: mocks.recordEngagement,
  }),
}));
vi.mock('@/components/AdaptationBadge', () => ({
  AdaptationBadge: () => null,
  useAdaptationShift: () => ({ direction: null, reason: '', signalShift: vi.fn() }),
}));
vi.mock('@/components/exercise/LevelBadge', () => ({
  LevelBadge: () => <span>Practice level</span>,
}));
vi.mock('@/components/RoundDoneAutoAdvance', () => ({
  RoundDoneAutoAdvance: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { MultiStepPlanningGame } from './MultiStepPlanningGame';

describe('MultiStepPlanningGame real modality/clinical handoff', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.speechCallback = null;
    mocks.supported = true;
    mocks.stopRecording.mockResolvedValue(null);
    mocks.logFinalAnalysis.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('submits actual typed text without fabricating browser speech or recording audio', async () => {
    const onTrialComplete = vi.fn();
    render(<MultiStepPlanningGame roundCount={1} onTrialComplete={onTrialComplete} onGameComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Type instead/ }));
    fireEvent.click(screen.getByRole('button', { name: /Type your plan/ }));
    fireEvent.change(screen.getByPlaceholderText(/Type the steps in your plan/), {
      target: { value: 'boil water then pour water then add milk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'typed',
      completionReason: 'completed',
      responseValid: true,
      browserTranscript: null,
    });
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.stopRecording).not.toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
    expect(mocks.logFinalAnalysis).not.toHaveBeenCalled();
    expect(mocks.recordAdaptation).not.toHaveBeenCalled();
  });

  it('makes the typing fallback usable when the browser has no speech support', async () => {
    mocks.supported = false;
    const onTrialComplete = vi.fn();
    render(<MultiStepPlanningGame roundCount={1} onTrialComplete={onTrialComplete} onGameComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Type your plan/ }));
    expect(screen.getByPlaceholderText(/Type the steps in your plan/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Type the steps in your plan/), {
      target: { value: 'get cup then boil water' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'typed', browserTranscript: null,
    });
    expect(mocks.recordAdaptation).not.toHaveBeenCalled();
  });

  it('records a full spoken answer as speech and permits valid adaptive evidence', async () => {
    const onTrialComplete = vi.fn();
    render(<MultiStepPlanningGame roundCount={1} onTrialComplete={onTrialComplete} onGameComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Start planning/ }));
    act(() => {
      mocks.speechCallback?.('boil water and get cup then put tea bag then pour water and add milk');
    });
    fireEvent.click(screen.getByRole('button', { name: /I'm done/ }));
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'spoken',
      completionReason: 'completed',
      responseValid: true,
      sequenceEvidenceAvailable: true,
      browserTranscript: 'boil water and get cup then put tea bag then pour water and add milk',
    });
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    expect(mocks.stopRecording).toHaveBeenCalledTimes(1);
    expect(mocks.recordAdaptation).toHaveBeenCalledTimes(1);
  });

  it('retains a skipped trial without scoring it as a language failure', async () => {
    const onTrialComplete = vi.fn();
    render(<MultiStepPlanningGame roundCount={1} onTrialComplete={onTrialComplete} onGameComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'none', completionReason: 'skipped', skipped: true,
      responseValid: false, sequenceEvidenceAvailable: false,
    });
    expect(mocks.recordAdaptation).not.toHaveBeenCalled();
  });
});
