import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MeaningMatchGame } from '@/components/MeaningMatchGame';
import type { MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';

const services = vi.hoisted(() => ({
  recordTrial: vi.fn(),
  recordEngagement: vi.fn(),
  speakIntro: vi.fn(),
  autoReadText: vi.fn(),
  speakReminder: vi.fn(),
}));

vi.mock('@/hooks/useMayaExerciseFrame', () => ({
  useMayaExerciseFrame: () => ({
    buildReflection: () => ({ nextStep: '', reflection: '', realLifeLine: '' }),
  }),
}));
vi.mock('@/hooks/useVoiceGuidance', () => ({
  useVoiceGuidance: () => ({
    shouldAutoSpeak: false,
    speakIntro: services.speakIntro,
    autoReadText: services.autoReadText,
    speakReminder: services.speakReminder,
  }),
}));
vi.mock('@/hooks/useInGameAdaptation', () => ({
  useInGameAdaptation: () => ({
    recordTrial: services.recordTrial,
    levelDescriptor: { label: 'Test' },
  }),
}));
vi.mock('@/hooks/useEngagementMonitor', () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    recordTrial: services.recordEngagement,
  }),
}));
vi.mock('@/components/AdaptationBadge', () => ({
  AdaptationBadge: () => null,
  useAdaptationShift: () => ({ direction: null, reason: null, signalShift: vi.fn() }),
}));
vi.mock('@/components/exercise/LevelBadge', () => ({ LevelBadge: () => null }));
vi.mock('@/components/ExercisePurposeBanner', () => ({ ExercisePurposeBanner: () => null }));
vi.mock('@/components/StructuredFeedbackSummary', () => ({ StructuredFeedbackSummary: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderTrial() {
  const onTrialComplete = vi.fn();
  render(
    <MeaningMatchGame
      onTrialComplete={onTrialComplete}
      onGameComplete={vi.fn()}
      roundCount={2}
      difficultyLevel={1}
    />,
  );
  return onTrialComplete;
}

function chooseFirstOption() {
  const firstChoice = screen.getAllByRole('button').find(
    button => (button.textContent?.trim() ?? '').startsWith('A.'),
  );
  expect(firstChoice, 'the real game must present answer option A').toBeDefined();
  fireEvent.click(firstChoice!);
  expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
}

describe('Meaning Match patient response timing — actual game component', () => {
  it('includes time spent reading the displayed sentence before selecting an answer', () => {
    const onTrialComplete = renderTrial();
    expect(screen.getByText('Pick the best meaning:')).toBeTruthy();
    vi.setSystemTime(new Date('2026-10-28T12:00:02.200Z'));

    chooseFirstOption();

    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    const trial = onTrialComplete.mock.calls[0][0] as MeaningMatchTrialResult;
    expect(trial.reactionTimeMs).toBeGreaterThanOrEqual(2100);
    expect(trial.reactionTimeMs).toBeLessThan(2400);
    expect(trial.usedHint).toBe(false);
  });

  it('keeps reading time before a hint and after a hint in the same response interval', () => {
    const onTrialComplete = renderTrial();
    vi.setSystemTime(new Date('2026-10-28T12:00:01.100Z'));
    fireEvent.click(screen.getByRole('button', { name: /Highlight keywords|first letter hint/i }));
    vi.setSystemTime(new Date('2026-10-28T12:00:02.400Z'));

    chooseFirstOption();

    expect(onTrialComplete).toHaveBeenCalledTimes(1);
    const trial = onTrialComplete.mock.calls[0][0] as MeaningMatchTrialResult;
    expect(trial.usedHint).toBe(true);
    expect(trial.reactionTimeMs).toBeGreaterThanOrEqual(2300);
    expect(trial.reactionTimeMs).toBeLessThan(2600);
  });
});
