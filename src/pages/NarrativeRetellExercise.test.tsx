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
  trainingStage: null as null | { level: 1 | 2 | 3; storyTier: 1 | 2; baselineSupport: 1 | 2 | 3; label: string },
  trainingLoaded: true,
  trainingUnavailable: false,
  persistedLevel: 1 as number | null,
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
vi.mock('@/hooks/useNarrativeRetellTrainingStage', () => ({
  useNarrativeRetellTrainingStage: () => ({
    loaded: mocks.trainingLoaded,
    loadUnavailable: mocks.trainingUnavailable,
    persistedLevel: mocks.persistedLevel,
    stage: mocks.trainingStage,
  }),
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
    onTrialComplete, onGameComplete, tier, trainingStage, onRetellStarted,
  }: {
    onTrialComplete: (value: NarrativeTrialResult) => void;
    onGameComplete: (values: NarrativeTrialResult[]) => void | Promise<void>;
    tier: number;
    trainingStage?: { level: number };
    onRetellStarted?: () => void;
  }) => (
    <>
      <output data-testid="narrative-game-stage">tier={tier};stage={trainingStage?.level ?? 'general'}</output>
      <button onClick={() => onRetellStarted?.()}>Begin synthetic retell</button>
      <button onClick={() => {
        if (!mocks.nextTrial) throw new Error('Test trial missing');
        onTrialComplete(mocks.nextTrial);
        void onGameComplete([mocks.nextTrial]);
      }}>
        Complete synthetic retell
      </button>
    </>
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
    mocks.trainingStage = null;
    mocks.trainingLoaded = true;
    mocks.trainingUnavailable = false;
    mocks.persistedLevel = 1;
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
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(mocks.getStats?.()).toMatchObject({ score: 0, totalTrials: 0 });
  });

  it('passes a persisted stage 3 into the actual game entrypoint and records its story tier', async () => {
    mocks.trainingStage = { level: 3, storyTier: 2, baselineSupport: 1, label: 'Cause-and-effect story' };
    mocks.persistedLevel = 3;
    mocks.nextTrial = trial({ storyTier: 2 });
    render(<NarrativeRetellExercise />);
    expect(screen.getByTestId('narrative-game-stage').textContent).toBe('tier=2;stage=3');
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic retell' }));
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      taskParameters: expect.objectContaining({
        narrative_training_stage: 3,
        story_tier: 2,
        narrative_stage_promotion_eligible: false,
      }),
    }));
  });

  it('fails closed instead of mounting gameplay when patient progression cannot be read', () => {
    mocks.trainingLoaded = true;
    mocks.trainingUnavailable = true;
    mocks.persistedLevel = null;
    render(<NarrativeRetellExercise />);
    expect(screen.getByRole('alert').textContent).toContain('Practice level unavailable');
    expect(screen.queryByRole('button', { name: 'Complete synthetic retell' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Return to Today' })).toBeTruthy();
    expect(mocks.logTrial).not.toHaveBeenCalled();
  });

  it('does not advertise a finished clinical stage for unimplemented levels 4 to 8', () => {
    mocks.persistedLevel = 6;
    render(<NarrativeRetellExercise />);
    expect(screen.getByRole('status', { name: 'Higher stage practice notice' }).textContent)
      .toContain('higher-level story training is');
    expect(screen.getByTestId('narrative-game-stage').textContent).toContain('stage=general');
  });

  it('does not mount a story queue before the patient level has loaded', () => {
    mocks.trainingLoaded = false;
    render(<NarrativeRetellExercise />);
    expect(screen.queryByRole('button', { name: 'Complete synthetic retell' })).toBeNull();
  });


  it('lets a care partner choose an actual stage 3 story without changing clinical progression', async () => {
    mocks.trainingStage = { level: 1, storyTier: 1, baselineSupport: 3, label: 'Short story' };
    mocks.nextTrial = trial({ storyTier: 2 });
    render(<NarrativeRetellExercise />);
    expect(screen.getByTestId('narrative-game-stage').textContent).toContain('stage=1');
    fireEvent.click(screen.getByText('Care partner: choose practice level'));
    fireEvent.click(screen.getByRole('button', { name: 'Stage 3: Longer stories' }));
    expect(screen.getByTestId('narrative-game-stage').textContent).toBe('tier=2;stage=3');
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic retell' }));
    await waitFor(() => expect(mocks.logTrial).toHaveBeenCalledTimes(1));
    expect(mocks.logTrial).toHaveBeenCalledWith(expect.objectContaining({
      taskParameters: expect.objectContaining({
        narrative_training_stage: 3,
        narrative_practice_stage_source: 'care_partner_selection',
        narrative_stage_promotion_eligible: false,
      }),
    }));
  });

  it('locks care-partner practice-stage choices once actual retelling begins', () => {
    mocks.trainingStage = { level: 1, storyTier: 1, baselineSupport: 3, label: 'Short story' };
    render(<NarrativeRetellExercise />);
    fireEvent.click(screen.getByText('Care partner: choose practice level'));
    expect(screen.getByRole('button', { name: 'Stage 2: Picture hints' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Begin synthetic retell' }));
    expect(screen.queryByText('Care partner: choose practice level')).toBeNull();
    expect(screen.getByTestId('narrative-game-stage').textContent).toBe('tier=1;stage=1');
  });

});
