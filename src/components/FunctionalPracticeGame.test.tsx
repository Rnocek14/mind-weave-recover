import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionalPracticeGame } from './FunctionalPracticeGame';
import { getFunctionalPracticeStage } from '@/lib/practice/functionalStageContent';

const mocks = vi.hoisted(() => ({
  speak: vi.fn(async (_text: string) => {}),
  stop: vi.fn(),
  micStart: vi.fn(),
  micStop: vi.fn(),
  onResult: null as null | ((text: string) => void),
}));

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({
    speak: mocks.speak, stop: mocks.stop, isSpeaking: false,
  }),
}));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: ({ onResult }: { onResult: (text: string) => void }) => {
    const [isListening, setListening] = useState(false);
    mocks.onResult = onResult;
    return {
      isSupported: true, isListening,
      startListening: () => { mocks.micStart(); setListening(true); },
      stopListening: () => { mocks.micStop(); setListening(false); },
      error: null,
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mocks.onResult = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function stage(kind: 'word-finding' | 'sentence-game', level: number) {
  return getFunctionalPracticeStage(kind, level)!;
}

describe('FunctionalPracticeGame real patient actions', () => {
  it('reads and objectively evaluates a modeled beginner word choice without mastery credit', () => {
    const trial = vi.fn();
    const finish = vi.fn();
    render(<FunctionalPracticeGame kind="word-finding" stage={stage('word-finding', 1)}
      roundCount={1} onTrialComplete={trial} onGameComplete={finish}/>);
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('Listen: cup.'));
    fireEvent.click(screen.getByRole('button', { name: 'A. cup' }));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      trialId: 'wf-model-cup', taskKind: 'choice', inputMode: 'choice',
      correct: true, practiceAccuracy: 1, baselineSupport: 'full_model',
      clinicalProgressionEligible: false, independentSpokenScoreEligible: false,
    }));
    expect(screen.queryByRole('button', { name: 'B. chair' })).toBeNull();
    act(() => vi.advanceTimersByTime(1601));
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it('uses actual up/down tile actions before scoring Sentence Game Stage 3', () => {
    const trial = vi.fn();
    render(<FunctionalPracticeGame kind="sentence-game" stage={stage('sentence-game', 3)}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Move down: the folder.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move down: the folder.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check sentence' }));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      trialId: 'sg-order-nurse', correct: true, practiceAccuracy: 1, inputMode: 'reordered',
    }));
  });
  it('never auto-scores a stage-eight typed functional message', () => {
    const trial = vi.fn();
    render(<FunctionalPracticeGame kind="sentence-game" stage={stage('sentence-game', 8)}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Need a clue?' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your own words' }), {
      target: { value: 'Could you reschedule my visit for next Tuesday?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record my response' }));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      trialId: 'sg-novel-appointment', correct: null, practiceAccuracy: null,
      inputMode: 'typed', supportRevealed: true,
      supportText: 'State the problem and ask for another time.', clinicalProgressionEligible: false,
    }));
  });
  it('keeps synthetic browser recognition separate from confirmed independent speech', () => {
    const trial = vi.fn();
    render(<FunctionalPracticeGame kind="word-finding" stage={stage('word-finding', 8)}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Try speaking' }));
    expect(mocks.micStart).toHaveBeenCalledTimes(1);
    act(() => mocks.onResult?.('Could I borrow a phone charger please'));
    fireEvent.click(screen.getByRole('button', { name: 'Record my response' }));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode: 'browser_recognized', userResponse: 'Could I borrow a phone charger please',
      correct: null, independentSpokenScoreEligible: false,
    }));
  });
  it('ignores speech results before microphone activation and after stopping', () => {
    render(<FunctionalPracticeGame kind="word-finding" stage={stage('word-finding', 8)}
      roundCount={1} onTrialComplete={vi.fn()} onGameComplete={vi.fn()}/>);
    act(() => mocks.onResult?.('stale transcript'));
    expect(screen.getByRole('button', { name: 'Record my response' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Try speaking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop microphone' }));
    act(() => mocks.onResult?.('late transcript'));
    expect(screen.getByRole('button', { name: 'Record my response' }).hasAttribute('disabled')).toBe(true);
  });
  it('allows manual attempt reporting without fabricated audio and cancels pending completion on exit', () => {
    const trial = vi.fn();
    const finish = vi.fn();
    const view = render(<FunctionalPracticeGame kind="word-finding" stage={stage('word-finding', 8)}
      roundCount={1} onTrialComplete={trial} onGameComplete={finish}/>);
    fireEvent.click(screen.getByRole('button', { name: 'I tried speaking (no transcript)' }));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode: 'self_report', userResponse: null, correct: null,
    }));
    view.unmount();
    act(() => vi.advanceTimersByTime(1700));
    expect(finish).not.toHaveBeenCalled();
    expect(mocks.micStop).toHaveBeenCalled();
  });
  it('blocks repeated attempts and skips a question without claiming a spoken result', () => {
    const trial = vi.fn();
    render(<FunctionalPracticeGame kind="sentence-game" stage={stage('sentence-game', 1)}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Skip this question' }));
    expect(trial).toHaveBeenCalledTimes(1);
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode: 'skipped', userResponse: null, correct: false,
      independentSpokenScoreEligible: false,
    }));
    expect(screen.queryByRole('button', { name: 'A. The cook stirs soup.' })).toBeNull();
  });
});
