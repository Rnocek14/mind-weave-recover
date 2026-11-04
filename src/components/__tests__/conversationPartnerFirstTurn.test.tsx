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
  getNudge: vi.fn(() => 'Take your time.'),
  scorer: vi.fn(async () => ({ signal: {
    source: 'llm', onTopicScore: 0.9, targetAchievementScore: 0.8,
    confidence: 0.9, errorType: 'fluent_correct',
  } })),
  flushQueue: vi.fn(),
  onSpeechResult: null as null | ((transcript: string) => void),
  currentTurn: 0,
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
  useConversationPartner: (options: { maxTurns: number }) => ({
    conversationHistory: [], currentTurn: mocks.currentTurn, maxTurns: options.maxTurns,
    isLoadingFollowup: false, isComplete: false,
    metrics: {
      totalUserWords: 0, totalAIWords: 10, turnsCompleted: 0,
      avgLatencyMs: 0, completionRate: 0,
    },
    addAITurn: mocks.addAITurn,
    processUserTurn: mocks.processUserTurn,
    getNudge: mocks.getNudge,
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
  mocks.currentTurn = 0;
  mocks.speak.mockResolvedValue(undefined);
  mocks.processUserTurn.mockResolvedValue({ followupText: 'What about lunch?', updatedMetrics: { totalUserWords: 3, totalAIWords: 7, avgLatencyMs: 900, turnsCompleted: 1, nudgesGiven: 0, completionRate: 100 } });
});

afterEach(() => { cleanup(); });

function mount(
  onComplete?: React.ComponentProps<typeof ConversationPartnerGame>['onComplete'],
  options: Partial<Pick<React.ComponentProps<typeof ConversationPartnerGame>, 'clinicalLevel'|'onClinicalTrial'>> = {},
) {
  return render(
    <ConversationPartnerGame
      userId="synthetic-user"
      profileId="synthetic-profile"
      sessionId="synthetic-session"
      onComplete={onComplete}
      {...options}
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

  it('passes the complete final response metrics to the session page (not stale word counts)', async () => {
    mocks.currentTurn = 2;
    const onComplete = vi.fn();
    mocks.processUserTurn.mockResolvedValueOnce({
      followupText: 'Nice talking with you',
      updatedMetrics: {
        totalUserWords: 7,
        totalAIWords: 10,
        avgLatencyMs: 1200,
        turnsCompleted: 3,
        nudgesGiven: 0,
        completionRate: 200 / 3,
      },
    });
    mount(onComplete);
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('toast and eggs'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      turnsCompleted: 3,
      avgLatencyMs: 1200,
      completionRate: 200 / 3,
      userAIRatio: 50, // 7 user words / (10 earlier + 4 closing words)
    }));
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


describe('Conversation Partner — graded patient-facing L1–L3', () => {
  it('L1 offers audible choices before the mic, accepts one spoken word, and completes ONE turn', async () => {
    const onClinicalTrial = vi.fn();
    const onComplete = vi.fn();
    mocks.processUserTurn.mockImplementation(async (_utterance, _latency, options) => {
      mocks.currentTurn += 1;
      return {
        followupText: options.scriptedFollowupText,
        updatedMetrics: { totalUserWords: 1, totalAIWords: 5, avgLatencyMs: 1000,
          turnsCompleted: 1, nudgesGiven: 0, completionRate: 0 },
        eventSaved: true,
      };
    });
    mount(onComplete, { clinicalLevel: 1, onClinicalTrial });
    expect(screen.getByLabelText(/clinical conversation goal/i)).toHaveTextContent('Clinical Level 1');
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    expect(mocks.speak).toHaveBeenCalledWith('What would you like to drink?', expect.anything());
    const help = await screen.findByRole('button', { name: /hear choices/i });
    fireEvent.click(help);
    await waitFor(() => expect(mocks.speak).toHaveBeenCalledWith(expect.stringMatching(/water.*coffee.*tea/i), expect.anything()));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('water'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await waitFor(() => expect(onClinicalTrial).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).toHaveBeenCalledWith({
      turnNumber: 1, correct: true, support: 'choice_based',
    });
    expect(mocks.scorer.mock.calls[0][0]).toMatchObject({
      taskGoal: expect.stringMatching(/one relevant word/i),
      transcript: 'water', scaffoldUsed: true,
    });
    expect(mocks.processUserTurn.mock.calls[0][2].scriptedFollowupText).toBe('Thank you for talking with me.');
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole('button', { name: /press to talk/i })).toHaveLength(0);
  });

  it('L2 keeps the second question on topic and records an independent spoken answer', async () => {
    const onClinicalTrial = vi.fn();
    mocks.processUserTurn.mockImplementation(async (_u, _latency, options) => {
      mocks.currentTurn += 1;
      return {
        followupText: options.scriptedFollowupText,
        updatedMetrics: { totalUserWords: mocks.currentTurn, totalAIWords: 8,
          avgLatencyMs: 700, turnsCompleted: mocks.currentTurn,
          nudgesGiven: 0, completionRate: 0 },
        eventSaved: true,
      };
    });
    mount(undefined, { clinicalLevel: 2, onClinicalTrial });
    expect(screen.getByLabelText(/clinical conversation goal/i)).toHaveTextContent('Clinical Level 2');
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('coffee'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await screen.findByRole('button', { name: /press to talk/i });
    expect(mocks.processUserTurn.mock.calls[0][2].scriptedFollowupText).toBe('Would you like it hot or cold?');
    expect(onClinicalTrial).toHaveBeenCalledWith({ turnNumber: 1, correct: true, support: 'independent' });
    expect(screen.getByText('Would you like it hot or cold?')).toBeInTheDocument();
  });

  it('L3 help during recording stops mic and recording before Maya speaks, with no false trial', async () => {
    const onClinicalTrial = vi.fn();
    mount(undefined, { clinicalLevel: 3, onClinicalTrial });
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('cof'));
    const priorSpeak = mocks.speak.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /hear a clue/i }));
    await waitFor(() => expect(mocks.speak.mock.calls.length).toBeGreaterThan(priorSpeak));
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.stopRecording).toHaveBeenCalled();
    expect(onClinicalTrial).not.toHaveBeenCalled();
    expect(mocks.processUserTurn).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/clinical conversation goal/i)).toHaveTextContent('Maya helped with this answer');
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('coffee'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await waitFor(() => expect(mocks.processUserTurn).toHaveBeenCalledTimes(1));
    // This is PRACTICE, but not independent mastery credit at Level 3.
    expect(mocks.scorer.mock.calls[0][0].scaffoldUsed).toBe(true);
  });

  it('does NOT credit a scoring fallback or unsaved turn, even if the word looks correct', async () => {
    const onClinicalTrial = vi.fn();
    mocks.scorer.mockResolvedValueOnce({ signal: {
      source: 'fallback', onTopicScore: 0.9, targetAchievementScore: 0.8,
      confidence: 0.8, errorType: 'fluent_correct',
    } });
    mocks.processUserTurn.mockResolvedValueOnce({
      followupText: 'Thank you for talking with me.',
      updatedMetrics: { totalUserWords: 1, totalAIWords: 5, avgLatencyMs: 900,
        turnsCompleted: 1, nudgesGiven: 0, completionRate: 0 },
      eventSaved: false,
    });
    mount(undefined, { clinicalLevel: 1, onClinicalTrial });
    fireEvent.click(screen.getByRole('button', { name: /start conversation/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    act(() => mocks.onSpeechResult?.('water'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await waitFor(() => expect(mocks.processUserTurn).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).not.toHaveBeenCalled();
  });
});
