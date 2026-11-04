/**
 * Conversation Partner — the actual first-turn patient UI, not an invented
 * phase-machine test. External speech, TTS and database APIs are mocked.
 * Checks that an adult with aphasia can start once, hear Maya, and find the
 * first microphone button without accidentally recording over the prompt.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPartnerGame } from '@/components/ConversationPartnerGame';

const mocks = vi.hoisted(() => ({
  speak: vi.fn(),
  stopTTS: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(async () => null),
  startAttempt: vi.fn(),
  processUserTurn: vi.fn(),
  addAITurn: vi.fn(),
  reset: vi.fn(),
  scorer: vi.fn(async () => ({ signal: { onTopicScore: 0.8 } })),
  flushQueue: vi.fn(),
  onSpeechResult: null as null | ((transcript: string) => void),
}));

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({
    speak: mocks.speak, stop: mocks.stopTTS, isLoading: false,
  }),
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: ({ onResult }: { onResult: (value: string) => void }) => {
    mocks.onSpeechResult = onResult;
    return {
      isSupported: true, isListening: false,
      startListening: mocks.startListening, stopListening: mocks.stopListening,
    };
  },
}));
vi.mock('@/hooks/useUtteranceLogger', () => ({
  useUtteranceLogger: () => ({
    startAttempt: mocks.startAttempt, resetAttempt: vi.fn(),
    logFinalAnalysis: vi.fn(async () => {}),
    currentAttemptId: null,
  }),
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
    uploadRecording: vi.fn(async () => null),
  }),
}));
vi.mock('@/hooks/useConversationPartner', () => ({
  useConversationPartner: () => ({
    conversationHistory: [], currentTurn: 0, maxTurns: 3,
    isLoadingFollowup: false, isComplete: false,
    metrics: {
      totalUserWords: 0, totalAIWords: 10, turnsCompleted: 0,
      avgLatencyMs: 0, completionRate: 0,
    },
    addAITurn: mocks.addAITurn,
    processUserTurn: mocks.processUserTurn,
    getNudge: vi.fn(() => 'Take your time.'),
    startTurn: vi.fn(), reset: mocks.reset,
  }),
}));
vi.mock('@/hooks/useDiscourseAdaptation', () => ({
  useDiscourseAdaptation: () => ({
    level: 2, shiftDirection: null, shiftReason: undefined,
    recordTurn: vi.fn(),
  }),
}));
vi.mock('@/hooks/useDiscourseSignalScorer', () => ({
  useDiscourseSignalScorer: () => ({ scoreAndRecord: mocks.scorer }),
}));
vi.mock('@/lib/conversationFollowups', () => ({
  getRandomOpener: () => 'What did you have for breakfast?',
}));
vi.mock('@/lib/voiceController', () => ({
  flushVoiceSessionQueue: mocks.flushQueue,
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (result: T) => void;
};
function defer<T>(): Deferred<T> {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSpeechResult = null;
  mocks.speak.mockResolvedValue(undefined);
  mocks.processUserTurn.mockResolvedValue({ followupText: 'What about lunch?' });
});

afterEach(() => { cleanup(); });

function mount() {
  return render(
    <ConversationPartnerGame
      userId="synthetic-user"
      profileId="synthetic-profile"
      sessionId="synthetic-session"
    />,
  );
}

describe('Conversation Partner — first patient turn', () => {
  it('REGRESSION: opening TTS is one-shot; recording is impossible during Maya speech; then first turn is reachable', async () => {
    const opening = defer<void>();
    mocks.speak.mockImplementationOnce(() => opening.promise);
    mount();

    const start = screen.getByRole('button', { name: /start conversation/i });
    fireEvent.click(start);
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/what did you have for breakfast/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /press to talk/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /start conversation/i })).toBeNull();
    expect(mocks.startListening).not.toHaveBeenCalled();
    expect(mocks.startRecording).not.toHaveBeenCalled();

    await act(async () => opening.resolve());
    const press = await screen.findByRole('button', { name: /press to talk/i });
    expect(screen.queryByRole('button', { name: /start conversation/i })).toBeNull();
    expect(mocks.addAITurn).toHaveBeenCalledTimes(1);

    fireEvent.click(press);
    await waitFor(() => expect(mocks.startListening).toHaveBeenCalledTimes(1));
    expect(mocks.startAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /done talking/i })).toBeInTheDocument();
  });

  it('ignores rapid repeated Start taps instead of queuing duplicate openers', async () => {
    const opening = defer<void>();
    mocks.speak.mockImplementationOnce(() => opening.promise);
    mount();
    const start = screen.getByRole('button', { name: /start conversation/i });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    await act(async () => opening.resolve());
    expect(mocks.addAITurn).toHaveBeenCalledTimes(1);
  });

  it('one answer completes one turn despite repeated Done presses, then returns to ready', async () => {
    const following = defer<{ followupText: string }>();
    mocks.processUserTurn.mockImplementationOnce(() => following.promise);
    mount();

    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('I had cereal'));
    const done = screen.getByRole('button', { name: /done talking/i });
    fireEvent.click(done);
    fireEvent.click(done);
    await waitFor(() => expect(mocks.processUserTurn).toHaveBeenCalledTimes(1));
    expect(mocks.scorer).toHaveBeenCalledTimes(1);
    expect(mocks.stopRecording).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /press to talk/i })).toBeNull();

    await act(async () => following.resolve({ followupText: 'What about lunch?' }));
    await screen.findByRole('button', { name: /press to talk/i });
    expect(mocks.speak).toHaveBeenCalledTimes(2);
    expect(mocks.addAITurn).toHaveBeenCalledTimes(2);
  });

  it('unmount during opener cancels the speech pipeline and never opens a mic afterward', async () => {
    const opening = defer<void>();
    mocks.speak.mockImplementationOnce(() => opening.promise);
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    view.unmount();
    await act(async () => opening.resolve());
    expect(mocks.stopTTS).toHaveBeenCalled();
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.flushQueue).toHaveBeenCalled();
    expect(mocks.addAITurn).not.toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
  });
});
