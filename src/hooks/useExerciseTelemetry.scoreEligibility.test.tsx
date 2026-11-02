import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrialData } from './useExerciseTelemetry';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(async (_row: unknown) => ({ error: null })),
  trackTrial: vi.fn(),
  reset: vi.fn(),
}));

// Real useExerciseTelemetry and real score-summary reducer under test. Only the
// Supabase network boundary and encouragement side-effect are replaced.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: mocks.insert,
    }),
  },
}));
vi.mock('@/hooks/useMicroEncouragement', () => ({
  useMicroEncouragement: () => ({
    trackTrial: mocks.trackTrial,
    reset: mocks.reset,
  }),
}));
vi.mock('@/lib/adaptiveLevelRegistry', () => ({
  readAdaptiveLevel: () => null,
}));

import { useExerciseTelemetry } from './useExerciseTelemetry';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { reduceAccuracy } from '@/lib/sessionAccuracySummary';

const spokenValidity = () => classifyUtteranceValidity({
  transcript: 'the cup is used for drinking',
  recordingDurationMs: 1800,
  asrVerified: true,
});

async function persist(trial: Partial<TrialData>) {
  const { result } = renderHook(() => useExerciseTelemetry('synthetic-session', 'describe_guess'));
  let saved = false;
  await act(async () => {
    saved = await result.current.logTrial({
      correct: true,
      reactionTimeMs: 1800,
      attemptId: 'synthetic-attempt',
      browserTranscript: 'the cup is used for drinking',
      ...trial,
    });
  });
  expect(saved).toBe(true);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  return mocks.insert.mock.calls[0][0] as Record<string, any>;
}

describe('useExerciseTelemetry verified-score eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it('excludes explicit practice-only attempts even with a valid speech verdict', async () => {
    const raw = await persist({
      validity: spokenValidity(),
      taskParameters: {
        clinical_progression_eligible: false,
        input_mode: 'spoken',
        trial_mode: 'scaffolded',
      },
    });

    expect(raw).toMatchObject({
      score: 100, // Practice outcome retained; not scored in verified metrics.
      validity_label: 'valid_attempt',
      counts_toward_score: false,
      engagement_flags: {
        counts_toward_score: false,
        counts_toward_asr_accuracy: false,
        counts_toward_practice_accuracy: true,
      },
      task_parameters: {
        clinical_progression_eligible: false,
        speech_validity: {
          should_score: false,
          should_feed_adaptation: false,
          counts_toward_asr_accuracy: false,
        },
      },
    });

    const summary = reduceAccuracy([{
      score: raw.score,
      cue_level: raw.cue_level,
      counts_toward_score: raw.counts_toward_score,
      validity_label: raw.validity_label,
      exercise_slug: raw.exercise_slug,
    }]);
    expect(summary).toMatchObject({
      accuracy: null,
      asr_accuracy: null,
      independent_accuracy: null,
      scored_trials: 0,
      independent_trials: 0,
    });
  });

  it('preserves eligible valid speech in the verified denominator', async () => {
    const raw = await persist({
      validity: spokenValidity(),
      taskParameters: {
        clinical_progression_eligible: true,
        input_mode: 'spoken',
        trial_mode: 'production',
      },
    });

    expect(raw).toMatchObject({
      counts_toward_score: true,
      task_parameters: {
        speech_validity: {
          should_score: true,
          should_feed_adaptation: true,
          counts_toward_asr_accuracy: true,
        },
      },
      engagement_flags: {
        counts_toward_score: true,
      },
    });

    const summary = reduceAccuracy([{
      score: raw.score,
      cue_level: raw.cue_level,
      counts_toward_score: raw.counts_toward_score,
      validity_label: raw.validity_label,
      exercise_slug: raw.exercise_slug,
    }]);
    expect(summary).toMatchObject({
      accuracy: 100,
      independent_accuracy: 100,
      scored_trials: 1,
    });
  });

  it('also excludes practice-only attempts when no validity verdict exists', async () => {
    const raw = await persist({
      validity: undefined,
      taskParameters: {
        clinical_progression_eligible: false,
        input_mode: 'typed',
        trial_mode: 'mixed',
      },
      browserTranscript: undefined,
    });

    expect(raw).toMatchObject({
      counts_toward_score: false,
      task_parameters: { clinical_progression_eligible: false },
    });
    expect(raw.browser_transcript).toBeUndefined();
  });

  it('retains the original validity rejection even if a caller requests eligibility', async () => {
    const rejected = classifyUtteranceValidity({
      transcript: '',
      recordingDurationMs: 1600,
    });
    expect(rejected.countsTowardScore).toBe(false);

    const raw = await persist({
      validity: rejected,
      taskParameters: { clinical_progression_eligible: true },
      browserTranscript: undefined,
    });
    expect(raw).toMatchObject({
      counts_toward_score: false,
      task_parameters: {
        speech_validity: { should_score: false },
      },
    });
  });
});
