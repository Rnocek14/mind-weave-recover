/**
 * Exercises the REAL guided coach UI, with the external speech engine,
 * TTS and Supabase transport mocked. No production authentication or
 * patient data is used. These tests do NOT establish real-device ASR quality.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedConversationCoach } from '@/components/GuidedConversationCoach';
import type { EarlyCoachLevel } from '@/lib/progression/earlyConversationCoach';

const mocks = vi.hoisted(() => ({
  speak: vi.fn(async (_line: string, _opts?: { voiceId?: string }): Promise<void> => {}),
  stopTTS: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  resetTranscript: vi.fn(),
  startRecording: vi.fn(async () => true),
  stopRecording: vi.fn(async (): Promise<null> => null),
  cancelRecording: vi.fn(),
  insert: vi.fn(async (_event: Record<string, unknown>) => ({
    error: null as { message: string } | null,
  })),
  upload: vi.fn(async (_path: string, _blob: Blob) => ({
    data: { path: 'synthetic/audio' }, error: null as { message: string } | null,
  })),
  score: vi.fn(async (_input: Record<string, unknown>) => ({
    source: 'llm', onTopicScore: 0.86, targetAchievementScore: 0.8,
    responseQualityScore: 0.7, successScore: 0.8, confidence: 0.9,
    errorType: 'fluent_correct', recommendedAdaptation: 'hold',
    reasoning: 'controlled synthetic answer',
  })),
  onSpeechResult: null as null | ((heard: string) => void),
}));

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: mocks.speak, stop: mocks.stopTTS, isSpeaking: false }),
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: ({ onResult }: { onResult: (heard: string) => void }) => {
    mocks.onSpeechResult = onResult;
    return {
      isSupported: true,
      startListening: mocks.startListening, stopListening: mocks.stopListening,
      resetTranscript: mocks.resetTranscript, transcript: '',
    };
  },
}));
vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
    cancelRecording: mocks.cancelRecording,
  }),
}));
vi.mock('@/lib/discourseSignalScorer', () => ({ scoreDiscourseTurn: mocks.score }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: mocks.insert }),
    storage: { from: () => ({ upload: mocks.upload }) },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function mount(level: EarlyCoachLevel) {
  const onClinicalTrial = vi.fn();
  const onComplete = vi.fn(async () => {});
  const view = render(
    <GuidedConversationCoach
      userId="synthetic-user" profileId="synthetic-profile"
      sessionId="synthetic-session"
      level={level}
      onClinicalTrial={onClinicalTrial}
      onComplete={onComplete}
    />,
  );
  return { ...view, onClinicalTrial, onComplete };
}

async function hearPromptAndTalk(spoken = 'water') {
  fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
  await waitFor(() => expect(mocks.startListening).toHaveBeenCalled());
  act(() => mocks.onSpeechResult?.(spoken));
  fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
  await screen.findByRole('button', { name: /yes, that.s right/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic drink scenario
  mocks.onSpeechResult = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Guided Conversation Coach — actual patient-facing voice flow', () => {
  it('does not start the microphone while Maya is speaking the modeled L1 message', async () => {
    const opening = deferred<void>();
    mocks.speak.mockImplementationOnce(() => opening.promise);
    mount(1);
    expect(screen.getByLabelText(/clinical coaching level/i)).toHaveTextContent('Clinical Level 1');
    expect(screen.getByText('I need water.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
    expect(mocks.speak).toHaveBeenCalledWith(
      expect.stringContaining('I need water.'), expect.anything(),
    );
    expect(screen.queryByRole('button', { name: /press to talk/i })).toBeNull();
    expect(mocks.startListening).not.toHaveBeenCalled();
    await act(async () => opening.resolve());
    expect(await screen.findByRole('button', { name: /press to talk/i })).toBeInTheDocument();
  });

  it('L1 does not score before speech confirmation; then accepts a spoken single word with correct model support', async () => {
    const { onClinicalTrial, onComplete } = mount(1);
    await hearPromptAndTalk('water');
    expect(screen.getByLabelText('Recognized speech')).toHaveTextContent('water');
    expect(mocks.score).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onClinicalTrial).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).toHaveBeenCalledWith({
      turnNumber: 1, correct: true, support: 'carrier_or_full_model',
    });
    expect(mocks.score.mock.calls[0]?.[0]).toMatchObject({
      exerciseSlug: 'conversation_coach', transcript: 'water',
      scaffoldUsed: true, taskGoal: expect.stringMatching(/one meaningful modeled request/i),
    });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0]?.[0]).toMatchObject({
      session_id: 'synthetic-session', exercise_slug: 'conversation_coach',
      round: 1, score: 100,
      inputs: {
        clinical_level: 1, response_mode: 'spoken',
        support_used: 'carrier_or_full_model', transcript_confirmed: true,
      },
      outputs: { clinical_practice: { target_met: true, scorer_source: 'llm' } },
    });
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('L2 a tapped choice is support only; speaking and confirmation are required for progress', async () => {
    const { onClinicalTrial } = mount(2);
    fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
    await screen.findByRole('button', { name: /press to talk/i });
    fireEvent.click(screen.getByRole('button', { name: 'Water' }));
    expect(screen.getByRole('button', { name: 'Water' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.score).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /press to talk/i }));
    await waitFor(() => expect(mocks.startListening).toHaveBeenCalled());
    act(() => mocks.onSpeechResult?.('water'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    await screen.findByRole('button', { name: /yes, that.s right/i });
    fireEvent.click(screen.getByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onClinicalTrial).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).toHaveBeenCalledWith({
      turnNumber: 1, correct: true, support: 'choice_based',
    });
    expect(mocks.insert.mock.calls[0]?.[0]).toMatchObject({
      inputs: { clinical_level: 2, selected_choice: 'Water' },
    });
  });

  it('L3 clue stops recording BEFORE Maya speaks, then records cue-dependent rather than independent evidence', async () => {
    const { onClinicalTrial } = mount(3);
    fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    await waitFor(() => expect(mocks.startListening).toHaveBeenCalled());
    act(() => mocks.onSpeechResult?.('cof'));
    const stopped = deferred<null>();
    mocks.stopRecording.mockImplementationOnce(() => stopped.promise);
    const before = mocks.speak.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /stop and hear a clue/i }));
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.stopRecording).toHaveBeenCalled();
    expect(mocks.speak).toHaveBeenCalledTimes(before);
    expect(screen.queryByRole('button', { name: /done talking/i })).toBeNull();
    await act(async () => stopped.resolve(null));
    await waitFor(() => expect(mocks.speak.mock.calls.length).toBe(before + 1));
    expect(mocks.score).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    await waitFor(() => expect(mocks.startListening).toHaveBeenCalledTimes(2));
    act(() => mocks.onSpeechResult?.('water'));
    fireEvent.click(screen.getByRole('button', { name: /done talking/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onClinicalTrial).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).toHaveBeenCalledWith({
      turnNumber: 1, correct: true, support: 'semantic_cue',
    });
    expect(mocks.score.mock.calls[0]?.[0]).toMatchObject({ scaffoldUsed: true });
  });

  it('L3 without a clue records an independent spoken request', async () => {
    const { onClinicalTrial } = mount(3);
    await hearPromptAndTalk('water');
    fireEvent.click(screen.getByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onClinicalTrial).toHaveBeenCalledWith({
      turnNumber: 1, correct: true, support: 'independent',
    }));
    expect(mocks.score.mock.calls[0]?.[0]).toMatchObject({ scaffoldUsed: false });
  });

  it('Try Again discards recognized words without scoring or writing a trial', async () => {
    const { onClinicalTrial } = mount(1);
    await hearPromptAndTalk('wrong word');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('button', { name: /press to talk/i })).toBeInTheDocument();
    expect(mocks.score).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(onClinicalTrial).not.toHaveBeenCalled();
  });

  it('fallback scoring and an RLS-rejected event never provide clinical progression', async () => {
    const { onClinicalTrial, onComplete } = mount(1);
    mocks.score.mockResolvedValueOnce({
      source: 'fallback', onTopicScore: 0.8, targetAchievementScore: 0.8,
      responseQualityScore: 0.7, successScore: 0.8, confidence: 0.9,
      errorType: 'fluent_correct', recommendedAdaptation: 'hold', reasoning: 'synthetic fallback',
    });
    await hearPromptAndTalk('water');
    fireEvent.click(screen.getByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).not.toHaveBeenCalled();
    expect(mocks.insert.mock.calls[0]?.[0]).toMatchObject({
      score: null, error_type: 'unscorable',
      outputs: { clinical_practice: { scoring_valid: false, scorer_source: 'fallback' } },
    });
  });

  it('rejects event write failure for milestone credit even when an LLM score is high', async () => {
    mocks.insert.mockResolvedValueOnce({ error: { message: 'synthetic RLS rejection' } });
    const { onClinicalTrial, onComplete } = mount(1);
    await hearPromptAndTalk('water');
    fireEvent.click(screen.getByRole('button', { name: /yes, that.s right/i }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onClinicalTrial).not.toHaveBeenCalled();
  });

  it('exit while microphone permission is pending cancels late recorder startup', async () => {
    const permission = deferred<boolean>();
    mocks.startRecording.mockImplementationOnce(() => permission.promise);
    const view = mount(1);
    fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /press to talk/i }));
    expect(mocks.startRecording).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => permission.resolve(true));
    expect(mocks.cancelRecording).toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
  });

  it('unmount during Maya speech shuts down both audio systems without opening the mic', async () => {
    const opening = deferred<void>();
    mocks.speak.mockImplementationOnce(() => opening.promise);
    const view = mount(1);
    fireEvent.click(screen.getByRole('button', { name: /hear maya$/i }));
    view.unmount();
    await act(async () => opening.resolve());
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.cancelRecording).toHaveBeenCalled();
    expect(mocks.stopTTS).toHaveBeenCalled();
    expect(mocks.startListening).not.toHaveBeenCalled();
  });
});
