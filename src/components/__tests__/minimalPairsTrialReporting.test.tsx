/**
 * Minimal Pairs must record the answers a patient actually gives.
 *
 * It did not. `useSpeechRecognition` hands back a fresh object every render, so
 * a `[speech]` dependency gave `stopEcho` a new identity every render, and the
 * per-trial reset effect keyed on it fired continuously — closing the mic and
 * resetting the say-it step within a frame of it opening. A CORRECT trial is
 * held back until that step resolves, so correct answers were never reported to
 * telemetry or to the clinical ladder. Wrong answers were, because they do not
 * wait. The exercise therefore recorded only the patient's mistakes: a flawless
 * session persisted nothing at all, and a mixed session looked like pure
 * failure, pinning support at its ceiling.
 *
 * This test installs a fake Web Speech API on purpose. Without one the defect
 * is invisible — the echo short-circuits to 'skipped' and reporting works —
 * which is exactly why an otherwise green suite never caught it.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ({ speak: async () => {}, isLoading: false, error: null }),
}));
vi.mock('@/hooks/useVoiceGuidance', () => ({
  useVoiceGuidance: () => ({ shouldAutoSpeak: false, speak: async () => {} }),
}));
vi.mock('@/hooks/useMayaExerciseFrame', () => ({
  // buildReflection must return an object: the completion card dereferences it
  // (`maya.nextStep`), so with `null` no test can render the end of a session —
  // which is exactly where the microphone-hygiene case below has to look.
  useMayaExerciseFrame: () => ({
    buildReflection: () => ({ nextStep: '', reflection: '', realLifeLine: '' }),
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    recordTrial: () => {},
    getState: () => ({ signals: { cueDependency: 0 } }),
    logIntervention: async () => {},
  }),
}));
vi.mock('@/hooks/useInGameAdaptation', () => ({
  useInGameAdaptation: () => ({
    currentDifficulty: 1,
    currentLevel: 1,
    levelDescriptor: { level: 1, label: 'Warm-up', band: 'easy', levers: [] },
    recordTrial: () => ({ difficultyAdjusted: false, newDifficulty: 1, frustrationTriggered: false, consecutiveErrors: 0 }),
    recentSuccessRate: null,
    frustrationLevel: 'none',
  }),
}));
vi.mock('@/lib/voiceController', () => ({
  voiceController: { awaitMicSafe: async () => true },
}));
// Chrome that needs Router/auth context and has nothing to do with reporting.
vi.mock('@/components/ExercisePurposeBanner', () => ({
  ExercisePurposeBanner: () => null,
}));
vi.mock('@/components/exercise/LevelBadge', () => ({
  LevelBadge: () => null,
}));

import { MinimalPairsGame } from '@/components/MinimalPairsGame';

/**
 * A Web Speech API that really opens and really closes, so the test can see
 * whether the microphone is live. `Math.random` is pinned in beforeEach: the
 * first tile is always the target, so every run exercises a CORRECT answer —
 * the only case the defect touches. Without that pin the test is a coin flip
 * and passes on the broken code roughly half the time.
 */
const mic = { started: 0, stopped: 0, running: false };
class FakeRecognition {
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  start() { mic.started += 1; mic.running = true; this.onstart?.(); }
  stop() { if (mic.running) { mic.stopped += 1; mic.running = false; } this.onend?.(); }
  abort() { mic.running = false; this.onend?.(); }
}

const tiles = () =>
  screen.getAllByRole('button').filter((b) => b.querySelector('img[alt^="Option"]') !== null);
const skipButtons = () =>
  screen.getAllByRole('button').filter((b) => /Skip/.test(b.textContent || ''));

describe('Minimal Pairs trial reporting', () => {
  beforeEach(() => {
    mic.started = 0; mic.stopped = 0; mic.running = false;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // tile 0 is always the target
    vi.useFakeTimers();
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('opens the say-it microphone instead of killing it on the next render', async () => {
    render(<MinimalPairsGame difficulty={1} totalTrials={3} sessionId={null} onTrialComplete={() => {}} />);
    await act(async () => { fireEvent.click(tiles()[0]); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    // The root cause: a per-render `stopEcho` identity closed the mic within a
    // frame of it opening (started 1 / stopped 1) and pinned echoStatus at idle.
    expect(screen.getByText(/Listening/)).toBeTruthy();
    expect(mic.running, 'the say-it microphone must stay open for its window').toBe(true);
    expect(mic.stopped).toBe(0);
  });

  it('reports a CORRECT answer exactly once even when the say-it step never resolves', async () => {
    const reported: Array<{ isCorrect: boolean; echoAttempted?: boolean }> = [];
    render(<MinimalPairsGame difficulty={1} totalTrials={3} sessionId={null}
      onTrialComplete={(t) => reported.push({ isCorrect: t.isCorrect, echoAttempted: t.echoAttempted })} />);
    await act(async () => { fireEvent.click(tiles()[0]); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(reported.length, 'the answered trial must be reported exactly once').toBe(1);
    expect(reported[0].isCorrect).toBe(true);
    expect(reported[0].echoAttempted).toBe(false);
  });

  it('reports a CORRECT answer the patient skips past', async () => {
    const reported: Array<{ isCorrect: boolean }> = [];
    render(<MinimalPairsGame difficulty={1} totalTrials={3} sessionId={null}
      onTrialComplete={(t) => reported.push({ isCorrect: t.isCorrect })} />);
    await act(async () => { fireEvent.click(tiles()[0]); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const skips = skipButtons();
    await act(async () => { fireEvent.click(skips[skips.length - 1]); await Promise.resolve(); });
    expect(reported.length).toBe(1);
    expect(reported[0].isCorrect).toBe(true);
    expect(mic.running, 'Skip must close the microphone').toBe(false);
  });

  it('times the answer, not the say-it step that follows it', async () => {
    // A correct answer's report is deliberately held until the say-it step
    // resolves. Recomputing the elapsed time at that point charged the patient
    // for the whole echo window, so in the clinical record every correct answer
    // looked seconds slower than every wrong one at identical true latency —
    // and the latency is what SessionsTab and the cohort analytics average.
    const reported: Array<{ isCorrect: boolean; reactionTimeMs: number }> = [];
    render(<MinimalPairsGame difficulty={1} totalTrials={3} sessionId={null}
      onTrialComplete={(t) => reported.push({ isCorrect: t.isCorrect, reactionTimeMs: t.reactionTimeMs })} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    await act(async () => { fireEvent.click(tiles()[0]); await Promise.resolve(); });
    // Sit through the entire say-it window in silence — the common case.
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });

    expect(reported.length).toBe(1);
    expect(reported[0].isCorrect).toBe(true);
    expect(
      reported[0].reactionTimeMs,
      `answered at ~600ms but reported ${reported[0].reactionTimeMs}ms`,
    ).toBeLessThan(3000);
  });

  it('never leaves the microphone open once the exercise is over', async () => {
    render(<MinimalPairsGame difficulty={1} totalTrials={1} sessionId={null}
      onTrialComplete={() => {}} onComplete={() => {}} />);
    await act(async () => { fireEvent.click(tiles()[0]); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const skips = skipButtons();
    await act(async () => { fireEvent.click(skips[skips.length - 1]); await Promise.resolve(); });
    // The last `nextTrial()` sets isComplete WITHOUT changing trialIndex
    // (useMinimalPairsGame.ts), so the per-trial reset effect never runs and
    // nothing else stops the recognizer on this path.
    expect(mic.running, 'the mic must not be live on the completion screen').toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mic.running).toBe(false);
    expect(mic.started, 'and it must not open after the exercise ends').toBeLessThanOrEqual(1);
  });
});
