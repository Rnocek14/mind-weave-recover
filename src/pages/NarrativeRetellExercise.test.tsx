import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NarrativeTrialResult } from '@/hooks/useNarrativeRetellGame';

const mocks = vi.hoisted(() => ({
  nextTrial: null as NarrativeTrialResult | null,
  logTrial: vi.fn(),
  completeSession: vi.fn(),
  saveDetails: vi.fn(),
  navigate: vi.fn(),
  getStats: null as null | (() => { score: number; totalTrials: number }),
}));

vi.mock('react-router-dom', async (originalImport) => {
  const original = await originalImport<typeof import('react-router-dom')>();
  return {
    ...original,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: { trialLimit: 1 } }),
  };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }) }));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: (options: { getSessionStats: () => { score: number; totalTrials: number } }) => {
    mocks.getStats = options.getSessionStats;
    return { completeSession: mocks.completeSession };
  },
}));
vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({ logTrial: mocks.logTrial }),
}));
vi.mock('@/hooks/useSessionStallWatchdog', () => ({
  useSessionStallWatchdog: () => undefined,
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 2, recommendedCueType: 'none' }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({ recordTrialResult: vi.fn() }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/lib/exerciseDetailsStore', () => ({
  saveExerciseDetails: mocks.saveDetails,
}));
vi.mock('@/components/NarrativeRetellGame', () => ({
  NarrativeRetellGame: ({
    onTrialComplete, onGameComplete,
  }: {
    onTrialComplete: (value: NarrativeTrialResult) => void;
    onGameComplete: (values: NarrativeTrialResult[]) => void | Promise<void>;
  }) => (
    <button onClick={() => {
      if (!mocks.nextTrial) throw new Error('Test trial missing');
      onTrialComplete(mocks.nextTrial);
      void onGameComplete([mocks.nextTrial]);
    }}>
      Complete synthetic retell
    </button>
  ),
}));

import NarrativeRetellExercise from './NarrativeRetellExercise';

const trial = (overrides: Partial<NarrativeTrialResult> = {}): NarrativeTrialResult => ({
  storyId: 'synthetic-story',
  transcript: 'The dog got out and the family found the dog after searching.',
  eventsFound: 3,
  eventsTotal: 5,
  eventCoverage: 0.6,
  matchedEvents: ['dog left', 'family searched', 'found dog'],
  allKeyEvents: ['dog left', 'family searched', 'found dog', 'returned', 'slept'],
  coherenceScore: 0.6,
  onTopicScore: 0.5,
  durationMs: 12000,
  meanUtteranceLength: 11,
  wordCount: 11,
  skipped: false,
  inputMode: 'spoken',
  completionReason: 'completed',
  responseValid: true,
  browserTranscript: 'The dog got out and the family found the dog after searching.',
  structureBreakdown: {
    beginning: { hit: 1, total: 2, status: 'partial' },
    middle: { hit: 1, total: 2, status: 'partial' },
    end: { hit: 1, total: 1, status: 'covered' },
  },
  nextStepHint: 'Try adding more detail.',
  depthTelemetry: {
    taskType: 'narrative_retell',
    eventCoverage: 0.6, coherenceScore: 0.6,
    ciuRate: null, meanUtteranceLength: 11,
  },
  ...overrides,
});

describe('NarrativeRetellExercise raw event integrity', () => {
  beforeEach(() => {
    localStorage.removeItem('offlineMode');
    vi.clearAllMocks();
    mocks.nextTrial = trial();
    mocks.getStats = null;
    mocks.logTrial.mockResolvedValue(true);
    mocks.completeSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  const finish = () => {
    render(<NarrativeRetellExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic retell' }));
  };

  it('aligns recorded correctness with the in-game 60% strong-retell threshold', async () => {
    mocks.nextTrial = trial({ eventCoverage: 0.4, eventsFound: 2 });
    finish();
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      correct: false,
      browserTranscript: expect.any(String),
      taskParameters: expect.objectContaining({
        clinical_progression_eligible: true,
        trial_mode: 'production',
        required_event_coverage: 0.6,
      }),
    }));
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
  });

  it('keeps typed retell participation out of the verified spoken denominator', async () => {
    mocks.nextTrial = trial({ inputMode: 'typed', browserTranscript: null });
    finish();
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      correct: true,
      browserTranscript: undefined,
      taskParameters: expect.objectContaining({
        clinical_progression_eligible: false,
        independent_spoken_score_eligible: false,
        input_mode: 'typed',
        trial_mode: 'mixed',
      }),
    }));
  });

  it('does not allow skipped attempts to count as patient language decline', async () => {
    mocks.nextTrial = trial({
      inputMode: 'none',
      completionReason: 'skipped',
      responseValid: false,
      skipped: true,
      transcript: '', browserTranscript: null,
      eventCoverage: 0, wordCount: 0,
    });
    finish();
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      correct: false,
      taskParameters: expect.objectContaining({
        clinical_progression_eligible: false,
        completion_reason: 'skipped',
      }),
    }));
  });

  it('waits for final raw event before ending a session or navigating', async () => {
    let resolveWrite!: (saved: boolean) => void;
    mocks.logTrial.mockImplementation(() =>
      new Promise<boolean>(resolve => { resolveWrite = resolve; }));
    finish();
    expect(mocks.logTrial).toHaveBeenCalledTimes(1);
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(mocks.getStats?.()).toMatchObject({ score: 0, totalTrials: 0 });
    await act(async () => {
      resolveWrite(true);
      await Promise.resolve();
    });
    await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledTimes(1));
    expect(mocks.getStats?.()).toMatchObject({ score: 60, totalTrials: 1 });
    expect(screen.getByText('Stories Complete!')).toBeTruthy();
  });

  it('signals a failed raw write instead of falsely describing the session as fully saved', async () => {
    mocks.logTrial.mockResolvedValue(false);
    finish();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('could not be saved');
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    expect(mocks.getStats?.()).toMatchObject({ score: 0, totalTrials: 0 });
  });
});
