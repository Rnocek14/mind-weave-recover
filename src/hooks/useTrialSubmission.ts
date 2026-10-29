/**
 * useTrialSubmission — the unified trial-submission React facade.
 *
 * One game-side call site. Fans out to:
 *   • exercise_events                (via useExerciseTelemetry)
 *   • adaptation_trial_logs          (via useAdaptationTrialLogger)
 *   • clinical_progression_state     (buffered → flushed on commitSession)
 *   • user_skill_mastery             (flushMasteryShadow on commitSession)
 *
 * The hook is intentionally a thin orchestrator over the existing primitives.
 * It does NOT introduce new promotion / regression / mastery-enforcement
 * behavior. That comes in the next phase (mastery confidence → level-up gate).
 *
 * Game-specific progression hooks (usePhotoNamingProgression /
 * useFixSentenceProgression) are passed in as the `progression` adapter so
 * their level-aware evidence + progress math is preserved verbatim.
 *
 * See docs/unified-trial-contract.md for the migration checklist.
 */

import { useCallback, useRef } from 'react';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { flushMasteryShadow } from '@/lib/mastery/flushMasteryShadow';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { applyValidityGate } from '@/lib/clinical/applyValidityGate';
import { recordLastTrial } from '@/lib/feedback/lastTrial';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';
import type {
  CommitSessionResult,
  UnifiedTrialInput,
  UnifiedTrialSummary,
} from '@/lib/trial/types';

/**
 * Adapter the caller passes in for the game-specific progression hook.
 * Both `usePhotoNamingProgression` and `useFixSentenceProgression` already
 * expose this shape verbatim — nothing to refactor in those hooks.
 */
export interface ProgressionAdapter {
  recordTrialOutcome: (t: { correct: boolean; support: SupportLevel }) => void;
  flushAtSessionEnd: (params: { sessionId: string | null }) => Promise<{
    ok: boolean;
    error?: string;
    skipped?: boolean;
    snapshot?: {
      prev: { level: number; progressPct: number };
      next: { level: number; progressPct: number };
      leveledUp: boolean;
      evidenceMet?: boolean;
      progressDelta?: number;
    };
  }>;
  state?: { currentLevel: number; progressPct: number; supportBaseline: number } | null;
  __bufferedTrialCount?: () => number;
}

interface Options {
  userId: string | null | undefined;
  profileId: string | null | undefined;
  sessionId: string | null;
  exerciseSlug: string;
  /** Pass the game's progression hook here. Optional (Minimal Pairs has none yet). */
  progression?: ProgressionAdapter | null;
  /**
   * Feature flag: enable verbose [submitTrial] logs proving fan-out. Defaults
   * to dev-mode only; turn on in prod to debug a specific call site.
   */
  debug?: boolean;
}

const DEBUG_DEFAULT = import.meta.env.DEV;

export function useTrialSubmission(opts: Options) {
  const debug = opts.debug ?? DEBUG_DEFAULT;
  const canonicalSlug = normalizeExerciseSlug(opts.exerciseSlug);

  // Layer 1 — clinical raw event (exercise_events).
  const { logTrial: logExerciseEvent, startTrial, calculateReactionTime } =
    useExerciseTelemetry(opts.sessionId, canonicalSlug);

  // Layer 2 — per-trial adaptation telemetry. This logger only fires for
  // trials that carry taskParameters.unified_route_adaptation_log === true
  // (see gate in submitTrial below), which games set when their in-game
  // adaptation hook is autoLog:false and the page owns the writer. Games
  // that auto-wire via useInGameAdaptation (autoLog:true) never pass the
  // flag, so there is no double insert.
  const { logTrial: logAdaptationTrial, flush: flushAdaptation } = useAdaptationTrialLogger({
    userId: opts.userId,
    profileId: opts.profileId,
    sessionId: opts.sessionId,
    exerciseSlug: canonicalSlug,
    enabled: true,
  });

  const scopeKey = JSON.stringify([
    opts.userId ?? null,
    opts.profileId ?? null,
    opts.sessionId,
    canonicalSlug,
  ]);
  const scopeRef = useRef(scopeKey);
  const trialCountRef = useRef(0);
  // Track the original input AND stable attempt identity for any unconfirmed
  // answer. A counter alone cannot recover missing exercise_events rows.
  const failedSubmissionsRef = useRef(new Map<string, {
    input: UnifiedTrialInput;
    trialOrdinal: number;
  }>());
  const inFlightSubmissionsRef = useRef(new Set<Promise<UnifiedTrialSummary>>());
  const retryInFlightRef = useRef<Promise<{
    ok: boolean;
    recovered: number;
    remaining: number;
  }> | null>(null);

  // A hook may be reused for a different patient or session on navigation.
  // Never offer a previous patient's unconfirmed answers to the new session.
  if (scopeRef.current !== scopeKey) {
    scopeRef.current = scopeKey;
    trialCountRef.current = 0;
    failedSubmissionsRef.current = new Map();
    inFlightSubmissionsRef.current = new Set();
    retryInFlightRef.current = null;
  }

  /**
   * One trial in. Fans out to all subsystems. Returns a routing summary so
   * call sites can prove (in dev) that every layer received the trial.
   */
  const performSubmitTrial = useCallback(
    async (
      input: UnifiedTrialInput,
      trialOrdinal: number,
      isRecovery: boolean,
    ): Promise<UnifiedTrialSummary> => {
      const summary: UnifiedTrialSummary = {
        ok: true,
        routed: {
          exerciseEvents: false,
          adaptationTrialLogs: false,
          progressionBuffered: false,
        },
        progression: null,
      };

      // 0) Remember this trial in memory so the app-root report control can
      // attach real context ("said X, wanted Y, scored Z") to a one-tap
      // report without any game needing to know the feature exists. Purely
      // in-memory and non-throwing — feedback must never be able to break a
      // practice session.
      if (!isRecovery) {
        recordLastTrial({
          exerciseSlug: canonicalSlug,
          sessionId: opts.sessionId,
          level: input.level,
          trialIndex: typeof input.trialIndex === 'number' ? input.trialIndex : null,
          stimulusId: input.stimulusId ?? null,
          expected: input.expectedResponse ?? null,
          userResponse: input.userResponse ?? null,
          browserTranscript: input.browserTranscript ?? null,
          isCorrect: input.isCorrect,
          cueLevel: input.cueLevel ?? null,
        });
      }

      // 1) exercise_events (raw clinical record) — always.
      try {
        const rawPersisted = await logExerciseEvent({
          correct: input.isCorrect,
          reactionTimeMs: input.latencyMs ?? undefined,
          cueLevel: input.cueLevel ?? undefined,
          errorType: input.errorType,
          errorClassification: input.errorClassification,
          whisperTranscript: input.whisperTranscript ?? undefined,
          whisperConfidence: input.whisperConfidence ?? undefined,
          browserTranscript: input.browserTranscript ?? undefined,
          attemptId: input.attemptId ?? undefined,
          trialIndex: typeof input.trialIndex === 'number' ? input.trialIndex : undefined,
          acousticMetrics: input.acousticMetrics,
          audioStoragePath: input.audioStoragePath ?? undefined,
          audioMimeType: input.audioMimeType ?? undefined,
          recordingDurationMs: input.recordingDurationMs ?? undefined,
          cueTypeGiven: input.cueTypeGiven ?? undefined,
          cueWasEffective: input.cueWasEffective ?? undefined,
          timeToSuccessAfterCueMs: input.timeToSuccessAfterCueMs ?? undefined,
          taskParameters: {
            ...(input.taskParameters ?? {}),
            // Carry the unified contract fields through for queryability.
            unified_trial_v1: true,
            stimulus_id: input.stimulusId ?? null,
            expected_response: input.expectedResponse ?? null,
            user_response: input.userResponse ?? null,
            support_used: input.supportUsed,
            trial_mode: input.trialMode ?? null,
            accuracy_score: input.accuracyScore ?? null,
            attempts: input.attempts ?? null,
            fatigue_signal: input.fatigueSignal ?? null,
            frustration_signal: input.frustrationSignal ?? null,
          },
          validity: input.validity ?? undefined,
        } as any);
        summary.routed.exerciseEvents = rawPersisted === true;
        if (!summary.routed.exerciseEvents) {
          summary.ok = false;
        }
      } catch (err) {
        summary.ok = false;
        console.warn('[submitTrial] exercise_events write failed', err);
      }

      // A pending request can finish after the active patient/session changes.
      // Do not feed its result to the new hook's progression or telemetry.
      if (scopeRef.current !== scopeKey) {
        summary.ok = false;
        return summary;
      }

      // 2) adaptation_trial_logs.
      // IMPORTANT: games that auto-wire this via useInGameAdaptation
      // (autoLog:true) or a hand-wired useAdaptationTrialLogger (PhotoNaming,
      // TwoClues) must NOT also pass the flag below — that would double-insert.
      // Games whose adaptation hook is autoLog:false opt in by setting
      // taskParameters.unified_route_adaptation_log = true, making this
      // pathway their single adaptation writer.
      try {
        if (
          summary.routed.exerciseEvents &&
          input.taskParameters?.unified_route_adaptation_log === true
        ) {
          logAdaptationTrial({
            trialIndex: trialOrdinal - 1,
            difficulty: input.level,
            cueLevel: input.cueLevel ?? null,
            correct: input.isCorrect,
            reactionTimeMs: input.latencyMs ?? null,
            frustration: input.frustrationSignal ?? null,
            fatigue: input.fatigueSignal ?? null,
            trialMode: input.trialMode ?? null,
            gradedScore: input.accuracyScore ?? null,
            validity: input.validity ? { label: input.validity.validity, reason: input.validity.reason } : null,
          });
          // Only mark routed when this pathway actually logged. Games that
          // auto-wire the logger via useInGameAdaptation own their own routing;
          // marking true unconditionally previously masked games that wrote
          // NOTHING to adaptation_trial_logs.
          summary.routed.adaptationTrialLogs = true;
        }
      } catch (err) {
        console.warn('[submitTrial] adaptation_trial_logs queue failed', err);
      }

      // 3) clinical_progression_state — buffer only (flush on commit).
      // Validity gate (spec §5.8): attempts the classifier ruled non-scorable
      // (filler-only / no-response / background noise / ASR failure) must NOT
      // feed clinical progression — a broken mic is not a struggle session.
      // The row is still recorded to telemetry above for audit; it just
      // doesn't move the ladder. Trials with no validity verdict (tap-based
      // games, legacy callers) buffer as before.
      const validityAllowsProgression =
        !input.validity || applyValidityGate(input.validity).shouldFeedAdaptation;
      try {
        if (
          opts.progression &&
          summary.routed.exerciseEvents &&
          validityAllowsProgression
        ) {
          opts.progression.recordTrialOutcome({
            correct: input.isCorrect,
            support: input.supportUsed,
          });
          summary.routed.progressionBuffered = true;
        }
      } catch (err) {
        console.warn('[submitTrial] progression buffer failed', err);
      }

      summary.progression = opts.progression?.state
        ? {
            level: opts.progression.state.currentLevel,
            progressPct: opts.progression.state.progressPct,
            supportBaseline: opts.progression.state.supportBaseline,
            bufferedTrialCount: opts.progression.__bufferedTrialCount?.() ?? trialCountRef.current,
          }
        : null;

      if (debug) {
        console.info('[submitTrial] fan-out', {
          game: canonicalSlug,
          level: input.level,
          isCorrect: input.isCorrect,
          supportUsed: input.supportUsed,
          stimulusId: input.stimulusId,
          routed: summary.routed,
          progression: summary.progression,
        });
      }

      return summary;
    },
    [canonicalSlug, debug, logAdaptationTrial, logExerciseEvent, opts.progression, opts.sessionId, scopeKey]
  );

  const enqueueSubmission = useCallback((
    input: UnifiedTrialInput,
    trialOrdinal: number,
    isRecovery: boolean,
  ): Promise<UnifiedTrialSummary> => {
    // Register synchronously so commitSession cannot run past a final
    // in-flight clinical write. Both retries and original saves use the
    // identical attempt ID, which the database enforces as unique.
    const submissionScope = scopeKey;
    const submission = performSubmitTrial(input, trialOrdinal, isRecovery);
    inFlightSubmissionsRef.current.add(submission);
    void submission.then(
      (summary) => {
        if (scopeRef.current !== submissionScope) return;
        inFlightSubmissionsRef.current.delete(submission);
        if (summary.ok) {
          failedSubmissionsRef.current.delete(input.attemptId!);
        } else {
          failedSubmissionsRef.current.set(input.attemptId!, { input, trialOrdinal });
        }
      },
      () => {
        if (scopeRef.current !== submissionScope) return;
        inFlightSubmissionsRef.current.delete(submission);
        failedSubmissionsRef.current.set(input.attemptId!, { input, trialOrdinal });
      },
    );
    return submission;
  }, [performSubmitTrial, scopeKey]);

  const submitTrial = useCallback((input: UnifiedTrialInput): Promise<UnifiedTrialSummary> => {
    // Generate the immutable attempt identity BEFORE the first network call.
    // The lower telemetry layer otherwise allocates a new ID per call,
    // making an explicit retry capable of writing a second clinical row.
    const stableInput: UnifiedTrialInput = {
      ...input,
      attemptId: input.attemptId?.trim() || crypto.randomUUID(),
    };
    const trialOrdinal = ++trialCountRef.current;
    return enqueueSubmission(stableInput, trialOrdinal, false);
  }, [enqueueSubmission]);

  const waitForPendingSubmissions = useCallback(async () => {
    // Drain all writes, including those registered while an earlier one
    // settles; don't rely on a single snapshot at the final-trial boundary.
    while (inFlightSubmissionsRef.current.size > 0) {
      await Promise.allSettled(Array.from(inFlightSubmissionsRef.current));
    }
  }, []);

  const retryFailedSubmissions = useCallback((): Promise<{
    ok: boolean;
    recovered: number;
    remaining: number;
  }> => {
    if (retryInFlightRef.current) return retryInFlightRef.current;
    const retryScope = scopeKey;
    const run = (async () => {
      await waitForPendingSubmissions();
      if (scopeRef.current !== retryScope) {
        return { ok: false, recovered: 0, remaining: 0 };
      }

      let recovered = 0;
      // Replay ONLY previously unconfirmed answers in original attempt order,
      // with unchanged source fields and attempt IDs. No game scoring changes.
      const failures = [...failedSubmissionsRef.current.values()]
        .sort((a, b) => a.trialOrdinal - b.trialOrdinal);
      for (const failed of failures) {
        if (scopeRef.current !== retryScope) {
          return { ok: false, recovered, remaining: 0 };
        }
        try {
          const summary = await enqueueSubmission(
            failed.input,
            failed.trialOrdinal,
            true,
          );
          if (summary.ok) recovered += 1;
        } catch {
          // The rejected attempt remains in the ledger for a later retry.
        }
      }
      const remaining = failedSubmissionsRef.current.size;
      return { ok: remaining === 0, recovered, remaining };
    })();
    retryInFlightRef.current = run;
    void run.then(
      () => { if (retryInFlightRef.current === run) retryInFlightRef.current = null; },
      () => { if (retryInFlightRef.current === run) retryInFlightRef.current = null; },
    );
    return run;
  }, [enqueueSubmission, scopeKey, waitForPendingSubmissions]);

  /**
   * Flush all session-end work atomically:
   *   • progression.flushAtSessionEnd  (per-game level/progress upsert)
   *   • flushMasteryShadow             (longitudinal user_skill_mastery upsert)
   *   • drain any queued adaptation rows
   */
  const commitSession = useCallback(async (): Promise<CommitSessionResult> => {
    const errors: string[] = [];
    let progressionSnapshot: { level: number; progressPct: number } | null = null;
    let recapSnapshot: CommitSessionResult['progressionSnapshot'] = null;
    let masteryFlushed = false;

    // Do NOT flush progression or mastery with missing clinical raw events.
    // This prevents a partially logged session from being presented as saved.
    await waitForPendingSubmissions();
    if (scopeRef.current !== scopeKey) {
      errors.push('session context changed during save');
    }
    if (failedSubmissionsRef.current.size > 0) {
      errors.push(`unconfirmed trial submissions: ${failedSubmissionsRef.current.size}`);
    }
    if (errors.length > 0) {
      return {
        ok: false,
        progression: null,
        progressionSnapshot: null,
        masteryFlushed: false,
        errors,
      };
    }

    try {
      await flushAdaptation();
    } catch (err) {
      errors.push(`adaptation flush: ${(err as Error).message ?? err}`);
    }

    if (opts.progression) {
      try {
        const r = await opts.progression.flushAtSessionEnd({ sessionId: opts.sessionId ?? null });
        if (!r.ok) errors.push(`progression flush: ${r.error ?? 'unknown'}`);
        if (r.snapshot) {
          recapSnapshot = {
            prev: r.snapshot.prev,
            next: r.snapshot.next,
            leveledUp: r.snapshot.leveledUp,
            evidenceMet: r.snapshot.evidenceMet,
            progressDelta: r.snapshot.progressDelta,
          };
        }
        if (opts.progression.state) {
          progressionSnapshot = {
            level: opts.progression.state.currentLevel,
            progressPct: opts.progression.state.progressPct,
          };
        }
      } catch (err) {
        errors.push(`progression flush threw: ${(err as Error).message ?? err}`);
      }
    }

    if (opts.userId && opts.profileId && opts.sessionId) {
      try {
        await flushMasteryShadow({
          sessionId: opts.sessionId,
          userId: opts.userId,
          profileId: opts.profileId,
        });
        masteryFlushed = true;
      } catch (err) {
        errors.push(`mastery flush: ${(err as Error).message ?? err}`);
      }
    }

    if (debug) {
      console.info('[commitSession] complete', {
        game: canonicalSlug,
        sessionId: opts.sessionId,
        progression: progressionSnapshot,
        recapSnapshot,
        masteryFlushed,
        errors,
      });
    }

    return {
      ok: errors.length === 0,
      progression: progressionSnapshot,
      progressionSnapshot: recapSnapshot,
      masteryFlushed,
      errors,
    };
  }, [canonicalSlug, debug, flushAdaptation, opts.progression, opts.profileId, opts.sessionId, opts.userId, scopeKey, waitForPendingSubmissions]);

  return { submitTrial, retryFailedSubmissions, commitSession, startTrial, calculateReactionTime };
}
