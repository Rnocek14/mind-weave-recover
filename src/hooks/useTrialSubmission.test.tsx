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


  it('awaits an unawaited final raw-event write before flushing progression and mastery', async () => {
    let resolveWrite!: (ok: boolean) => void;
    mocks.logExerciseEvent.mockImplementation(() => new Promise<boolean>(resolve => {
      resolveWrite = resolve;
    }));
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'fix-sentence',
        progression: p,
        debug: false,
      }),
    );

    let trial!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      // Several actual games issue `void submitTrial(...)`, then immediately
      // call `commitSession()` from onGameComplete in the SAME tick.
      trial = result.current.submitTrial(input);
      commit = result.current.commitSession();
    });

    expect(mocks.logExerciseEvent).toHaveBeenCalledTimes(1);
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushAdaptation).not.toHaveBeenCalled();
    expect(mocks.flushMasteryShadow).not.toHaveBeenCalled();

    await act(async () => {
      resolveWrite(true);
      await Promise.all([trial, commit]);
    });
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(p.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(mocks.flushAdaptation).toHaveBeenCalledTimes(1);
    expect(mocks.flushMasteryShadow).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a raw trial failure, even if an earlier trial buffered successfully', async () => {
    mocks.logExerciseEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'meaning-match',
        progression: p,
        debug: false,
      }),
    );

    let first!: Promise<UnifiedTrialSummary>;
    let second!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      first = result.current.submitTrial(input);
      second = result.current.submitTrial({ ...input, stimulusId: 'second-item' });
      commit = result.current.commitSession();
    });
    const [one, two, outcome] = await Promise.all([first, second, commit]);
    expect(one.ok).toBe(true);
    expect(two.ok).toBe(false);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join(' ')).toMatch(/raw clinical event writes failed: 1/);
    expect(outcome.masteryFlushed).toBe(false);
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushAdaptation).not.toHaveBeenCalled();
    expect(mocks.flushMasteryShadow).not.toHaveBeenCalled();

    // An automatic retry must not silently turn the partial patient session
    // into a complete one after the failed write has left the queue.
    const retry = await result.current.commitSession();
    expect(retry.ok).toBe(false);
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushMasteryShadow).not.toHaveBeenCalled();
  });

  it('preserves per-attempt indices and waits for concurrent raw saves resolving out of order', async () => {
    const resolveWrites: Array<(ok: boolean) => void> = [];
    mocks.logExerciseEvent.mockImplementation(() => new Promise<boolean>(resolve => {
      resolveWrites.push(resolve);
    }));
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'semantic-features',
        progression: p,
        debug: false,
      }),
    );

    let a!: Promise<UnifiedTrialSummary>;
    let b!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      a = result.current.submitTrial({ ...input, stimulusId: 'first' });
      b = result.current.submitTrial({ ...input, stimulusId: 'second' });
      commit = result.current.commitSession();
    });
    await act(async () => {
      resolveWrites[1](true);
      await b;
    });
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.logAdaptationTrial).toHaveBeenCalledWith(expect.objectContaining({ trialIndex: 1 }));

    await act(async () => {
      resolveWrites[0](true);
      await Promise.all([a, commit]);
    });
    expect(mocks.logAdaptationTrial.mock.calls.map(([args]) => args.trialIndex)).toEqual([1, 0]);
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(2);
    expect(p.flushAtSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('includes a trial registered during an already-waiting commit', async () => {
    const resolveWrites: Array<(ok: boolean) => void> = [];
    mocks.logExerciseEvent.mockImplementation(() => new Promise<boolean>(resolve => {
      resolveWrites.push(resolve);
    }));
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'two-clues',
        progression: p,
        debug: false,
      }),
    );

    let first!: Promise<UnifiedTrialSummary>;
    let second!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      first = result.current.submitTrial({ ...input, stimulusId: 'first' });
      commit = result.current.commitSession();
      second = result.current.submitTrial({ ...input, stimulusId: 'second' });
    });
    await act(async () => {
      resolveWrites[0](true);
      await first;
    });
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    await act(async () => {
      resolveWrites[1](true);
      await Promise.all([second, commit]);
    });
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(2);
    expect(p.flushAtSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('coalesces duplicate session finalization into one persisted clinical commit', async () => {
    mocks.logExerciseEvent.mockResolvedValue(true);
    const p = progression();
    const { result } = renderHook(() =>
      useTrialSubmission({
        userId: 'user-1',
        profileId: 'profile-1',
        sessionId: 'session-1',
        exerciseSlug: 'minimal-pairs',
        progression: p,
        debug: false,
      }),
    );

    const [first, second] = await Promise.all([
      result.current.commitSession(),
      result.current.commitSession(),
    ]);
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(p.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(mocks.flushMasteryShadow).toHaveBeenCalledTimes(1);
  });


  it('waits for a pending final trial before committing progression or mastery', async () => {
    let resolveRaw!: (saved: boolean) => void;
    const events: string[] = [];
    mocks.logExerciseEvent.mockImplementation(() => {
      events.push('raw-started');
      return new Promise<boolean>(resolve => { resolveRaw = resolve; });
    });
    mocks.flushAdaptation.mockImplementation(async () => { events.push('adaptation-flush'); });
    const p = progression();
    (p.flushAtSessionEnd as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      events.push('progression-flush');
      return { ok: true };
    });
    mocks.flushMasteryShadow.mockImplementation(async () => { events.push('mastery-flush'); });

    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'fix-sentence', progression: p, debug: false,
    }));

    let submission!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      submission = result.current.submitTrial(input);
      commit = result.current.commitSession();
    });
    expect(events).toEqual(['raw-started']);
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushMasteryShadow).not.toHaveBeenCalled();

    await act(async () => {
      resolveRaw(true);
      await Promise.all([submission, commit]);
    });
    expect(events).toEqual([
      'raw-started', 'adaptation-flush', 'progression-flush', 'mastery-flush',
    ]);
    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(1);
    expect(await commit).toMatchObject({ ok: true, masteryFlushed: true });
  });

  it('does not flush a partial clinical session when a raw insert failed', async () => {
    let resolveRaw!: (saved: boolean) => void;
    mocks.logExerciseEvent.mockImplementation(() =>
      new Promise<boolean>(resolve => { resolveRaw = resolve; }));
    const p = progression();
    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'semantic-features', progression: p, debug: false,
    }));

    let commit!: ReturnType<typeof result.current.commitSession>;
    let submission!: Promise<UnifiedTrialSummary>;
    act(() => {
      submission = result.current.submitTrial(input);
      commit = result.current.commitSession();
    });
    await act(async () => {
      resolveRaw(false);
      await Promise.all([submission, commit]);
    });
    expect(await submission).toMatchObject({ ok: false, routed: { exerciseEvents: false } });
    expect(await commit).toMatchObject({
      ok: false, masteryFlushed: false, progressionSnapshot: null,
      errors: [expect.stringMatching(/raw clinical event writes failed/)],
    });
    expect(p.recordTrialOutcome).not.toHaveBeenCalled();
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    expect(mocks.flushMasteryShadow).not.toHaveBeenCalled();
    expect(mocks.flushAdaptation).not.toHaveBeenCalled();

    // Duplicate finish callbacks must not silently turn the failed session
    // into a success on the second attempt.
    const duplicate = result.current.commitSession();
    expect(duplicate).toBe(commit);
    expect(await duplicate).toMatchObject({ ok: false });
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
  });

  it('tracks concurrent out-of-order raw inserts by submission index, including a late trial', async () => {
    let resolveFirst!: (saved: boolean) => void;
    let resolveSecond!: (saved: boolean) => void;
    mocks.logExerciseEvent
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { resolveSecond = resolve; }));
    const p = progression();
    const { result } = renderHook(() => useTrialSubmission({
      userId: 'user-1', profileId: 'profile-1', sessionId: 'session-1',
      exerciseSlug: 'meaning-match', progression: p, debug: false,
    }));

    let first!: Promise<UnifiedTrialSummary>;
    let second!: Promise<UnifiedTrialSummary>;
    let commit!: ReturnType<typeof result.current.commitSession>;
    act(() => {
      first = result.current.submitTrial({ ...input, level: 1 });
      commit = result.current.commitSession();
      // The second callback is registered after commit starts but while
      // its first raw write is unresolved; both must finish before flush.
      second = result.current.submitTrial({ ...input, level: 2 });
    });
    await act(async () => { resolveSecond(true); await second; });
    expect(p.flushAtSessionEnd).not.toHaveBeenCalled();
    await act(async () => { resolveFirst(true); await Promise.all([first, commit]); });

    expect(p.recordTrialOutcome).toHaveBeenCalledTimes(2);
    expect(p.flushAtSessionEnd).toHaveBeenCalledTimes(1);
    expect(mocks.flushMasteryShadow).toHaveBeenCalledTimes(1);
    expect(mocks.logAdaptationTrial).toHaveBeenCalledWith(
      expect.objectContaining({ trialIndex: 0, difficulty: 1 }));
    expect(mocks.logAdaptationTrial).toHaveBeenCalledWith(
      expect.objectContaining({ trialIndex: 1, difficulty: 2 }));
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
