import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logExerciseEvent: vi.fn(),
  startTrial: vi.fn(),
  calculateReactionTime: vi.fn(),
  logAdaptationTrial: vi.fn(),
  flushAdaptation: vi.fn(),
  flushMasteryShadow: vi.fn(),
  recordLastTrial: vi.fn(),
}));

vi.mock('@/hooks/useExerciseTelemetry', () => ({
  useExerciseTelemetry: () => ({
    logTrial: mocks.logExerciseEvent,
    startTrial: mocks.startTrial,
    calculateReactionTime: mocks.calculateReactionTime,
  }),
}));

vi.mock('@/hooks/useAdaptationTrialLogger', () => ({
  useAdaptationTrialLogger: () => ({
    logTrial: mocks.logAdaptationTrial,
    flush: mocks.flushAdaptation,
  }),
}));

vi.mock('@/lib/mastery/flushMasteryShadow', () => ({
  flushMasteryShadow: mocks.flushMasteryShadow,
}));

vi.mock('@/lib/feedback/lastTrial', () => ({
  recordLastTrial: mocks.recordLastTrial,
}));

import { useTrialSubmission, type ProgressionAdapter } from './useTrialSubmission';
import type { UnifiedTrialInput, UnifiedTrialSummary } from '@/lib/trial/types';
import { classifySynonymRoundEvidence } from '@/lib/synonymGenerator/roundEvidence';

const input: UnifiedTrialInput = {
  profileId: 'profile-1',
  sessionId: 'session-1',
  gameId: 'photo-naming',
  level: 1,
  isCorrect: true,
  supportUsed: 'independent',
  latencyMs: 500,
  taskParameters: {
    unified_route_adaptation_log: true,
  },
};

function progression(): ProgressionAdapter {
  return {
    recordTrialOutcome: vi.fn(),
    flushAtSessionEnd: vi.fn(async () => ({ ok: true })),
    state: { currentLevel: 1, progressPct: 25, supportBaseline: 0 },
    __bufferedTrialCount: vi.fn(() => 1),
  };
}

describe('useTrialSubmission persistence gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushAdaptation.mockResolvedValue(undefined);
    mocks.flushMasteryShadow.mockResolvedValue(undefined);
  });

  it('does not route adaptation or progression when the raw clinical event was not persisted', async () => {
    mocks.logExerciseEvent.mockResolvedValue(false);
    const p = progression();

    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'photo-naming',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial(input);
    });

    expect(mocks.logExerciseEvent).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      ok: false,
      routed: {
        exerciseEvents: false,
        adaptationTrialLogs: false,
        progressionBuffered: false,
      },
    });
    expect(mocks.logAdaptationTrial).not.toHaveBeenCalled();
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
  });

  it('preserves a typed practice record while excluding it from spoken clinical progression', async () => {
    mocks.logExerciseEvent.mockResolvedValue(true);
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'category-fluency',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial({
        ...input,
        gameId: 'category-fluency',
        trialMode: 'mixed',
        clinicalProgressionEligible: false,
        taskParameters: {
          unified_route_adaptation_log: true,
          input_mode: 'typed',
        },
      });
    });

    expect(summary).toMatchObject({
      ok: true,
      routed: {
        exerciseEvents: true,
        adaptationTrialLogs: true,
        progressionBuffered: false,
      },
    });
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
    expect(mocks.logExerciseEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        taskParameters: expect.objectContaining({
          clinical_progression_eligible: false,
          trial_mode: 'mixed',
          input_mode: 'typed',
        }),
      }),
    );
    expect(mocks.logAdaptationTrial).toHaveBeenCalledWith(
      expect.objectContaining({ trialMode: 'mixed' }),
    );
  });

  it('logs spoken-vs-typed synonym provenance without buffering typed clinical success', async () => {
    mocks.logExerciseEvent.mockResolvedValue(true);
    const p = progression();
    const evidence = classifySynonymRoundEvidence({ timeLimitSec: 25, durationSec: 25,
      inputMode: 'typed', completionReason: 'timer', difficulty: 5, matchCount: 8,
    });
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'synonym-generator',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial({
        ...input,
        gameId: 'synonym-generator',
        level: 5,
        isCorrect: evidence.practiceSuccessful,
        trialMode: evidence.trialMode,
        clinicalProgressionEligible: evidence.clinicalProgressionEligible,
        supportUsed: 'open_response',
        taskParameters: {
          unified_route_adaptation_log: true,
          input_mode: 'typed',
          completion_reason: 'timer',
          required_matches: evidence.requiredMatches,
        },
      });
    });

    expect(summary).toMatchObject({
      ok: true,
      routed: {
        exerciseEvents: true,
        adaptationTrialLogs: true,
        progressionBuffered: false,
      },
    });
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
    expect(mocks.logExerciseEvent).toHaveBeenCalledWith(expect.objectContaining({
      correct: true,
      taskParameters: expect.objectContaining({
        clinical_progression_eligible: false,
        trial_mode: 'mixed',
        input_mode: 'typed',
        required_matches: 4,
      }),
    }));
    expect(mocks.logAdaptationTrial).toHaveBeenCalledWith(
      expect.objectContaining({ trialMode: 'mixed', correct: true }),
    );
  });

  it('routes each downstream layer once after the raw clinical event is persisted', async () => {
    mocks.logExerciseEvent.mockResolvedValue(true);
    const p = progression();

    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'photo-naming',
        progression: p,
        debug: false,
      }),
    );

    let summary: UnifiedTrialSummary | undefined;
    await act(async () => {
      summary = await result.current.submitTrial(input);
    });

    expect(mocks.logExerciseEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAdaptationTrial).toHaveBeenCalledTimes(1);
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      ok: true,
      routed: {
        exerciseEvents: true,
        adaptationTrialLogs: true,
        progressionBuffered: true,
      },
    });
  });
});
