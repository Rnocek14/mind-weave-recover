import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  invoke: vi.fn(),
  speak: vi.fn(),
  stopTTS: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  uploadRecording: vi.fn(),
  startAttempt: vi.fn(),
  logFinalAnalysis: vi.fn(),
  resetAttempt: vi.fn(),
  scoreAndRecord: vi.fn(),
  onSpeechResult: null as null | ((text: string) => void),
  isSupported: true,
  scorerOptions: null as null | { logToDatabase?: boolean },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: () => ({ insert: mocks.insert }),
  },
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: (opts: { onResult: (text: string) => void }) => {
    mocks.onSpeechResult = opts.onResult;
    return {
      isSupported: mocks.isSupported, isListening: false,
      startListening: mocks.startListening,
      stopListening: mocks.stopListening,
    };
  },
}));
vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({
    speak: mocks.speak, stop: mocks.stopTTS, isLoading: false,
  }),
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
    uploadRecording: mocks.uploadRecording,
  }),
}));
vi.mock('@/hooks/useUtteranceLogger', async () => {
  const { useState } = await import('react');
  return {
    useUtteranceLogger: () => {
      const [attemptId, setAttemptId] = useState<string | null>(null);
      return {
        startAttempt: (args: unknown) => {
          mocks.startAttempt(args);
          const nextId = 'synthetic-attempt-' + mocks.startAttempt.mock.calls.length;
          setAttemptId(nextId);
          return { attemptId: nextId, pronRequestId: 'synthetic-pron' };
        },
        logFinalAnalysis: mocks.logFinalAnalysis,
        resetAttempt: () => { mocks.resetAttempt(); setAttemptId(null); },
        currentAttemptId: attemptId,
      };
    },
  };
});
vi.mock('@/hooks/useDiscourseAdaptation', () => ({
  useDiscourseAdaptation: () => ({
    recordTurn: vi.fn(), shiftDirection: null,
  }),
}));
vi.mock('@/hooks/useDiscourseSignalScorer', () => ({
  useDiscourseSignalScorer: (opts: { logToDatabase?: boolean }) => {
    mocks.scorerOptions = opts;
    return { scoreAndRecord: mocks.scoreAndRecord };
  },
}));
vi.mock('@/lib/voiceController', () => ({
  flushVoiceSessionQueue: vi.fn(),
}));
vi.mock('@/components/exercise/UnverifiedPracticeBanner', () => ({
  UnverifiedPracticeBanner: () => <p>Some conversation evidence could not be saved.</p>,
}));

import { ConversationPartnerGame } from './ConversationPartnerGame';

async function begin() {
  fireEvent.click(screen.getByRole('button', { name: /Start Conversation/ }));
  // These assertions exercise the actual mode; unsupported speech must
  // offer a typing path rather than a nonexistent microphone action.
  const expected = mocks.isSupported ? 'Press to Talk' : 'Type a reply';
  await waitFor(() => expect(screen.getByRole('button', { name: expected })).toBeTruthy());
}

async function answer(text: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Press to Talk' }));
  await act(async () => {
    mocks.onSpeechResult?.(text);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Done Talking' }));
}

describe('ConversationPartnerGame real component finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onSpeechResult = null;
    mocks.scorerOptions = null;
    mocks.isSupported = true;
    mocks.speak.mockResolvedValue(undefined);
    mocks.invoke.mockResolvedValue({ data: { fallbackType: 'tell_more' }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.stopRecording.mockResolvedValue(null);
    mocks.logFinalAnalysis.mockResolvedValue({ status: 'persisted', attemptId: 'synthetic', duplicate: false });
    mocks.scoreAndRecord.mockResolvedValue({ signal: {
      onTopicScore: 0.5, targetAchievementScore: 0.5, responseQualityScore: 0.5,
      successScore: 0.5, confidence: 0.5, errorType: 'fluent_correct', source: 'local',
    } });
  });
  afterEach(() => cleanup());

  it('allows the first patient turn only after opener TTS finishes', async () => {
    let releaseOpener!: () => void;
    mocks.speak.mockImplementationOnce(() => new Promise<void>(resolve => { releaseOpener = resolve; }));
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" />);
    fireEvent.click(screen.getByRole('button', { name: /Start Conversation/ }));
    expect(screen.queryByRole('button', { name: 'Press to Talk' })).toBeNull();
    expect(mocks.startListening).not.toHaveBeenCalled();
    await act(async () => { releaseOpener(); await Promise.resolve(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Press to Talk' })).toBeTruthy());
    expect(mocks.startListening).not.toHaveBeenCalled();
    expect(mocks.scorerOptions?.logToDatabase).toBe(false);
  });

  it('does not play Maya into an active microphone when the patient needs time', async () => {
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" />);
    await begin();
    expect(mocks.speak).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Press to Talk' }));
      await act(async () => { vi.advanceTimersByTime(8_100); await Promise.resolve(); });
      expect(mocks.speak).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status').textContent).toMatch(
        /Take your time|No rush|Whenever you're ready|It's okay, think about it/i,
      );
      expect(mocks.stopListening).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists exactly one uniquely indexed practice event per spoken turn', async () => {
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    for (const utterance of ['Toast and eggs', 'It tasted good', 'I would make more']) {
      await answer(utterance);
      if (utterance !== 'I would make more') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Press to Talk' })).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText('Nice conversation!')).toBeTruthy());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledTimes(3);
    const rows = mocks.insert.mock.calls.map(([row]) => row as Record<string, any>);
    expect(rows.map(row => row.round)).toEqual([1, 2, 3]);
    expect(rows.map(row => row.trial_index)).toEqual([0, 1, 2]);
    expect(rows.every(row => row.counts_toward_score === false)).toBe(true);
    expect(rows.map(row => row.attempt_id)).toEqual([
      'synthetic-attempt-1', 'synthetic-attempt-2', 'synthetic-attempt-3',
    ]);
    expect(rows.every(row => row.outputs.discourse_signal_shadow?.source === 'local')).toBe(true);
    expect(mocks.logFinalAnalysis).toHaveBeenCalledTimes(3);
    expect(mocks.scoreAndRecord).toHaveBeenCalledTimes(3);
  });

  it('never calls completeSession via parent when an earlier turn had rejected DB evidence', async () => {
    mocks.insert.mockResolvedValueOnce({ error: { message: 'synthetic failure' } })
      .mockResolvedValue({ error: null });
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    for (const utterance of ['I have tea', 'Maybe tomorrow', 'We can try']) {
      await answer(utterance);
      if (utterance !== 'We can try') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Press to Talk' })).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText(/Some conversation evidence could not be saved/)).toBeTruthy());
    expect(screen.queryByText('Nice conversation!')).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('provides a functioning typed fallback without manufacturing audio or spoken scores', async () => {
    mocks.isSupported = false;
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    expect(screen.getByRole('status').textContent).toContain('Typed practice');
    for (const words of ['I had toast today', 'I liked it', 'Maybe I will cook again']) {
      fireEvent.click(screen.getByRole('button', { name: 'Type a reply' }));
      fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: words } });
      fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
      if (words !== 'Maybe I will cook again') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Type a reply' })).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText('Nice conversation!')).toBeTruthy());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledTimes(3);
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.startAttempt).not.toHaveBeenCalled();
    expect(mocks.logFinalAnalysis).not.toHaveBeenCalled();
    expect(mocks.scoreAndRecord).not.toHaveBeenCalled();
    for (const [row] of mocks.insert.mock.calls) {
      expect(row).toMatchObject({
        counts_toward_score: false,
        task_parameters: {
          input_mode: 'typed',
          trial_mode: 'mixed',
          clinical_progression_eligible: false,
          independent_spoken_score_eligible: false,
        },
        engagement_flags: { did_speak: false },
      });
    }
  });

  it('lets a patient skip when speech recognition is unavailable without creating fake speech data', async () => {
    mocks.isSupported = false;
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Type a reply' }));
      fireEvent.click(screen.getByRole('button', { name: 'Skip turn' }));
      if (i < 2) {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Type a reply' })).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText('Nice conversation!')).toBeTruthy());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledTimes(3);
    for (const [row] of mocks.insert.mock.calls) {
      expect(row).toMatchObject({
        score: 0,
        counts_toward_score: false,
        task_parameters: { input_mode: 'typed', trial_mode: 'mixed' },
        engagement_flags: { did_speak: false },
      });
    }
    expect(mocks.startRecording).not.toHaveBeenCalled();
    expect(mocks.logFinalAnalysis).not.toHaveBeenCalled();
  });

  it('can leave a failed microphone turn and type instead with no fabricated speech row', async () => {
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    fireEvent.click(screen.getByRole('button', { name: 'Press to Talk' }));
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    await waitFor(() => expect(screen.getByLabelText('Your reply')).toBeTruthy());
    expect(mocks.stopRecording).toHaveBeenCalledTimes(1);
    expect(mocks.resetAttempt).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'I had breakfast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      counts_toward_score: false,
      task_parameters: {
        input_mode: 'typed',
        answer_source: 'typed',
        independent_spoken_score_eligible: false,
      },
    });
    expect(mocks.logFinalAnalysis).not.toHaveBeenCalled();
    expect(mocks.scoreAndRecord).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not claim a fully saved session when the utterance analysis write fails', async () => {
    mocks.logFinalAnalysis.mockResolvedValue({ status: 'failed', reason: 'database_error', attemptId: 'synthetic' });
    const complete = vi.fn();
    render(<ConversationPartnerGame userId="u" profileId="p" sessionId="session" onComplete={complete} />);
    await begin();
    for (const utterance of ['I had breakfast', 'It was nice', 'I made coffee']) {
      await answer(utterance);
      if (utterance !== 'I made coffee') {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Press to Talk' })).toBeTruthy());
      }
    }
    await waitFor(() => expect(screen.getByText(/Some conversation evidence could not be saved/)).toBeTruthy());
    expect(complete).not.toHaveBeenCalled();
  });
});
