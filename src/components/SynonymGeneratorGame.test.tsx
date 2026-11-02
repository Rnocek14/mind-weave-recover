import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stubs = vi.hoisted(() => ({
  onSpeech: null as ((text: string) => void) | null,
  updateTrial: vi.fn(),
  checkAndAdjust: vi.fn(() => ({ newLevel: 5 })),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  recordEngagement: vi.fn(),
}));

vi.mock('@/hooks/useAdaptiveDifficulty', () => ({
  useAdaptiveDifficulty: () => ({
    currentDifficulty: 5,
    updateTrial: stubs.updateTrial,
    checkAndAdjust: stubs.checkAndAdjust,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    recordTrial: stubs.recordEngagement,
  }),
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: (opts: { onResult: (text: string) => void }) => {
    stubs.onSpeech = opts.onResult;
    return {
      isListening: false,
      transcript: '',
      isSupported: true,
      startListening: stubs.startListening,
      stopListening: stubs.stopListening,
    };
  },
}));
vi.mock('@/hooks/useMayaExerciseFrame', () => ({
  useMayaExerciseFrame: () => ({
    buildReflection: () => ({
      nextStep: 'Try again',
      reflection: 'You practiced words',
      realLifeLine: 'Use a synonym when speaking',
    }),
  }),
}));
vi.mock('@/hooks/useVoiceGuidance', () => ({
  useVoiceGuidance: () => ({
    isVoiceLed: false,
    shouldAutoSpeak: false,
    speakIfVoiceLed: vi.fn(),
    interrupt: vi.fn(),
  }),
}));
vi.mock('@/data/synonymBank', () => ({
  pickSynonymPrompt: () => ({
    word: 'happy',
    acceptedSynonyms: ['glad', 'joyful', 'cheerful', 'pleased'],
    partOfSpeech: 'adjective',
    meaningNote: 'feeling joy',
  }),
  mapEngineLevelToSynonymTier: () => 3,
}));
vi.mock('@/components/ExercisePurposeBanner', () => ({
  ExercisePurposeBanner: () => <p>Practice purpose</p>,
}));
vi.mock('@/components/StructuredFeedbackSummary', () => ({
  StructuredFeedbackSummary: () => <p>Practice recap</p>,
}));

import { SynonymGeneratorGame } from './SynonymGeneratorGame';

const begin = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Start$/i }));
  act(() => { vi.advanceTimersByTime(2500); });
  expect(screen.getByRole('button', { name: 'Done early' })).toBeTruthy();
};

describe('Synonym Generator patient-flow evidence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    stubs.onSpeech = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('retains typed practice feedback but does not adapt clinical speech difficulty', () => {
    const onRoundComplete = vi.fn();
    render(<SynonymGeneratorGame roundCount={2} onRoundComplete={onRoundComplete} />);
    begin();

    fireEvent.click(screen.getByText('Switch to typing'));
    fireEvent.change(screen.getByPlaceholderText('Type a synonym + Enter'), {
      target: { value: 'glad' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add word' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done early' }));

    expect(onRoundComplete).toHaveBeenCalledTimes(1);
    expect(onRoundComplete.mock.calls[0][0]).toMatchObject({
      targetWord: 'happy',
      enteredWords: ['glad'],
      matchCount: 1,
      inputMode: 'typed',
      completionReason: 'early',
      difficulty: 5,
      browserTranscript: null,
    });
    expect(stubs.updateTrial).not.toHaveBeenCalled();
    expect(stubs.checkAndAdjust).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(27000); });
    expect(onRoundComplete).toHaveBeenCalledTimes(1);
  });

  it('correctly attributes mixed speech and typing without promoting it', () => {
    const onRoundComplete = vi.fn();
    render(<SynonymGeneratorGame roundCount={1} onRoundComplete={onRoundComplete} />);
    begin();

    act(() => { stubs.onSpeech?.('glad'); });
    fireEvent.click(screen.getByText('Switch to typing'));
    fireEvent.change(screen.getByPlaceholderText('Type a synonym + Enter'), {
      target: { value: 'joyful' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add word' }));

    act(() => { vi.advanceTimersByTime(25000); });
    expect(onRoundComplete).toHaveBeenCalledTimes(1);
    expect(onRoundComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'mixed',
      completionReason: 'timer',
      matchCount: 2,
      browserTranscript: 'glad',
    });
    expect(stubs.updateTrial).not.toHaveBeenCalled();
    expect(stubs.checkAndAdjust).not.toHaveBeenCalled();
  });

  it('allows only full spoken rounds to reach the adaptive speech engine', () => {
    const onRoundComplete = vi.fn();
    render(<SynonymGeneratorGame roundCount={1} onRoundComplete={onRoundComplete} />);
    begin();

    act(() => { stubs.onSpeech?.('glad joyful cheerful pleased'); });
    act(() => { vi.advanceTimersByTime(25000); });

    expect(onRoundComplete).toHaveBeenCalledTimes(1);
    expect(onRoundComplete.mock.calls[0][0]).toMatchObject({
      inputMode: 'spoken',
      completionReason: 'timer',
      matchCount: 4,
      browserTranscript: 'glad joyful cheerful pleased',
    });
    expect(stubs.updateTrial).toHaveBeenCalledTimes(1);
    expect(stubs.updateTrial).toHaveBeenCalledWith(true, expect.any(Number));
    expect(stubs.checkAndAdjust).toHaveBeenCalledTimes(1);
  });
});
