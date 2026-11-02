import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrialData } from '@/hooks/useExerciseTelemetry';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(async (_row: unknown) => ({ error: null })),
  trackTrial: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: mocks.insert }) },
}));
vi.mock('@/hooks/useMicroEncouragement', () => ({
  useMicroEncouragement: () => ({ trackTrial: mocks.trackTrial, reset: mocks.reset }),
}));
vi.mock('@/lib/adaptiveLevelRegistry', () => ({
  readAdaptiveLevel: () => null,
}));

import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';

const trial = (overrides: Partial<TrialData> = {}): TrialData => ({
  correct: true,
  reactionTimeMs: 2100,
  attemptId: 'synthetic-attempt',
  trialIndex: 0,
  browserTranscript: 'A glass of milk',
  taskParameters: {
    trial_mode: 'scaffolded',
    clinical_progression_eligible: false,
    independent_spoken_score_eligible: false,
    clinical_stage_promotion_eligible: false,
    thought_training_stage: 1,
    prompt_id: 'thought-training-s1-1',
    support_used: 'prompt_context',
  },
  ...overrides,
});

async function persistTrial(payload: TrialData) {
  const { result, unmount } = renderHook(() =>
    useExerciseTelemetry('synthetic-session', 'thought_continuation'));
  let written = false;
  await act(async () => { written = await result.current.logTrial(payload); });
  unmount();
  expect(written).toBe(true);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  return mocks.insert.mock.calls[0][0] as Record<string, any>;
}

const accuracyFor = (raw: Record<string, any>) => reduceAccuracy([{
  score: raw.score,
  cue_level: raw.cue_level,
  counts_toward_score: raw.counts_toward_score,
  validity_label: raw.validity_label,
  exercise_slug: raw.exercise_slug,
}]);

describe('Thought Continuation clinical evidence firewall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });
  afterEach(() => cleanup());

  it('records successful short completion as practice, not independent accuracy', async () => {
    const raw = await persistTrial(trial({
      browserTranscript: 'milk',
      taskParameters: { ...trial().taskParameters, thought_training_stage: 1 },
    }));
    expect(raw).toMatchObject({
      exercise_slug: 'thought_continuation',
      score: 100,
      counts_toward_score: false,
      task_parameters: {
        thought_training_stage: 1,
        clinical_progression_eligible: false,
        independent_spoken_score_eligible: false,
        clinical_stage_promotion_eligible: false,
      },
    });
    expect(accuracyFor(raw)).toMatchObject({
      accuracy: null, independent_accuracy: null,
      asr_accuracy: null, scored_trials: 0,
    });
  });

  it('excludes a cued Stage 3 response even when ASR validation passes', async () => {
    const raw = await persistTrial(trial({
      browserTranscript: 'They decided to stay inside because it was raining',
      validity: classifyUtteranceValidity({
        transcript: 'They decided to stay inside because it was raining',
        recordingDurationMs: 2500, asrVerified: true,
      }),
      taskParameters: {
        ...trial().taskParameters,
        thought_training_stage: 3,
        support_used: 'narrowing_hint',
        narrowing_level_used: 2,
      },
    }));
    expect(raw.counts_toward_score).toBe(false);
    expect(raw.task_parameters).toMatchObject({
      thought_training_stage: 3,
      clinical_progression_eligible: false,
      support_used: 'narrowing_hint',
    });
    expect(accuracyFor(raw).independent_accuracy).toBeNull();
  });

  it('retains a skipped Stage 2 round as unscored participation evidence', async () => {
    const raw = await persistTrial(trial({
      correct: false,
      browserTranscript: undefined,
      errorType: 'skipped',
      taskParameters: {
        ...trial().taskParameters,
        thought_training_stage: 2,
        input_mode: 'none',
        completion_reason: 'skipped',
      },
    }));
    expect(raw).toMatchObject({
      score: 0,
      error_type: 'skipped',
      counts_toward_score: false,
      task_parameters: { clinical_progression_eligible: false },
    });
    expect(accuracyFor(raw).scored_trials).toBe(0);
  });

  it('quarantines historical graded thought rows that predate the new flag', () => {
    expect(reduceAccuracy([{
      exercise_slug: 'thought_continuation', score: 90,
      cue_level: 0, counts_toward_score: true,
    }])).toMatchObject({
      accuracy: null, independent_accuracy: null, scored_trials: 0,
    });
    expect(reduceAccuracy([{
      exercise_slug: 'photo_naming', score: 90,
      cue_level: 0, counts_toward_score: true,
    }])).toMatchObject({
      accuracy: 90, independent_accuracy: 90, scored_trials: 1,
    });
  });
});
