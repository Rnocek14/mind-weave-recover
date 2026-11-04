/**
 * Describe & Guess microphone handoff regression tests.
 *
 * Patient report: the first description was recognized, but the next picture
 * appeared with the microphone off. These tests exercise the real
 * DescribeGuessGame component and its trial transitions. Only browser audio
 * services are controlled; scoring and progression are not reimplemented.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DescribeGuessGame } from '@/components/DescribeGuessGame';

const mic = vi.hoisted(() => ({
  acceptStarts: true,
  starts: vi.fn(),
  stops: vi.fn(),
}));
const gate = vi.hoisted(() => ({
  holdNext: false,
  resolvers: [] as Array<() => void>,
}));

vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => {
    const [isListening, setIsListening] = React.useState(false);
    const startListening = React.useCallback(() => {
      mic.starts();
      if (mic.acceptStarts) setIsListening(true);
    }, []);
    const stopListening = React.useCallback(() => {
      mic.stops();
      setIsListening(false);
    }, []);
    return {
      transcript: '',
      fullTranscript: '',
      isListening,
      startListening,
      stopListening,
      resetTranscript: vi.fn(),
      isSupported: true,
      error: null,
    };
  },
}));
vi.mock('@/hooks/useVoiceState', () => ({
  useVoiceState: () => ({
    awaitMicSafe: () => {
      if (!gate.holdNext) return Promise.resolve(true);
      gate.holdNext = false;
      return new Promise<boolean>((resolve) => {
        gate.resolvers.push(() => resolve(true));
      });
    },
  }),
}));
vi.mock('@/lib/voiceController', () => ({
  voiceController: {
    isMicLocked: false,
  },
}));
vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: vi.fn(async () => {}), isSpeaking: false }),
}));
vi.mock('@/hooks/useVoiceGuidance', () => {
  const guidance = {
    shouldAutoSpeak: false,
    shouldAutoReadContent: false,
    isSpeaking: false,
    speakIntro: vi.fn(async () => {}),
    speakIfVoiceLed: vi.fn(async () => {}),
    speakReminder: vi.fn(async () => {}),
  };
  return { useVoiceGuidance: () => guidance };
});
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    isSupported: false,
    startRecording: vi.fn(async () => false),
    stopRecording: vi.fn(async () => null),
    uploadRecording: vi.fn(async () => null),
    cancelRecording: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePronunciationAnalysis', () => ({
  usePronunciationAnalysis: () => ({ analyzePronunciation: vi.fn(async () => null) }),
}));
vi.mock('@/hooks/useUtteranceLogger', () => ({
  useUtteranceLogger: () => ({
    startAttempt: vi.fn(),
    logBrowserTranscript: vi.fn(),
    logFinalAnalysis: vi.fn(async () => {}),
    resetAttempt: vi.fn(),
    currentAttemptId: null,
    isFinalized: false,
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    logIntervention: vi.fn(async () => {}),
    recordTrial: vi.fn(),
  }),
}));
vi.mock('@/hooks/useInGameAdaptation', () => ({
  useInGameAdaptation: () => ({
    currentDifficulty: 2,
    levelDescriptor: { level: 2, label: 'Test' },
    recordTrial: vi.fn(),
  }),
}));
vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));
vi.mock('@/hooks/useMayaExerciseFrame', () => ({
  useMayaExerciseFrame: () => ({
    buildReflection: () => ({ reflection: '', nextStep: '', realLifeLine: '' }),
  }),
}));
vi.mock('@/components/AdaptationBadge', () => ({
  AdaptationBadge: () => null,
  useAdaptationShift: () => ({ direction: null, reason: null, signalShift: vi.fn() }),
}));
vi.mock('@/components/exercise/LevelBadge', () => ({ LevelBadge: () => null }));
vi.mock('@/components/ExercisePurposeBanner', () => ({
  ExercisePurposeBanner: () => null,
}));
vi.mock('@/components/SpeechNudge', () => ({ SpeechNudge: () => null }));

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  mic.acceptStarts = true;
  mic.starts.mockClear();
  mic.stops.mockClear();
  gate.holdNext = false;
  gate.resolvers.length = 0;
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('DescribeGuessGame — next-trial microphone', () => {
  it('re-arms on the second description and shows recovery if that start never confirms', async () => {
    render(<DescribeGuessGame trialCount={3} />);
    await tick(200);

    // First picture listened successfully.
    expect(screen.getByText('Listening...')).toBeTruthy();
    const callsAfterFirst = mic.starts.mock.calls.length;

    // Simulate the exact field report: the NEXT prompt cannot start listening.
    mic.acceptStarts = false;
    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    expect(screen.getByText('2/3')).toBeTruthy();
    await tick(6000);

    expect(mic.starts.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    expect(screen.queryByText('Opening mic...')).toBeNull();
    expect(screen.getByText('Microphone unavailable')).toBeTruthy();

    // Recover without skipping or marking the unanswered picture incorrect.
    mic.acceptStarts = true;
    fireEvent.click(screen.getByRole('button', { name: /^retry$/i }));
    await tick(1000);
    expect(screen.getByText('Listening...')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('ignores an old picture microphone promise that finishes after advancing', async () => {
    gate.holdNext = true;
    render(<DescribeGuessGame trialCount={3} />);
    await tick(75);
    expect(gate.resolvers).toHaveLength(1);
    expect(mic.starts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^skip$/i }));
    await tick(500);
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText('Listening...')).toBeTruthy();
    const callsForSecond = mic.starts.mock.calls.length;
    expect(callsForSecond).toBeGreaterThan(0);

    // A delayed permission/TTS handoff from picture one is now irrelevant.
    await act(async () => { gate.resolvers.shift()?.(); });
    await tick(200);
    expect(mic.starts).toHaveBeenCalledTimes(callsForSecond);
    expect(screen.getByText('Listening...')).toBeTruthy();
  });
});
