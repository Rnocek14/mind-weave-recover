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

  const trialCountRef = useRef(0);
  // Store ALL submissions since the last commit, including already resolved
  // ones. A completed failed insert must not disappear before the final
  // commit detects the missing clinical raw record.
  const uncommittedTrialsRef = useRef<Promise<UnifiedTrialSummary>[]>([]);
  const commitPromiseRef = useRef<Promise<CommitSessionResult> | null>(null);

  /**
   * One trial in. Fans out to all subsystems. Register the promise
   * SYNCHRONOUSLY, before returning control to the game. Several game
   * callbacks intentionally don't await it and immediately fire onComplete.
   */
  const submitTrial = useCallback(
    (input: UnifiedTrialInput): Promise<UnifiedTrialSummary> => {
      // Capture the index at submission time, BEFORE an awaited raw write.
      // Completion order must not change a patient's trial identity.
      const trialIndex = trialCountRef.current++;
      const pending = (async (): Promise<UnifiedTrialSummary> => {
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
            clinical_progression_eligible: input.clinicalProgressionEligible !== false,
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
            trialIndex,
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
          validityAllowsProgression &&
          input.clinicalProgressionEligible !== false
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
      })();
      uncommittedTrialsRef.current.push(pending);
      return pending;
    },
    [canonicalSlug, debug, logAdaptationTrial, logExerciseEvent, opts.progression]
  );

  /**
   * Coordinate session-end writes (NOT a cross-table database transaction):
   *   • progression.flushAtSessionEnd  (per-game level/progress upsert)
   *   • flushMasteryShadow             (longitudinal user_skill_mastery upsert)
   *   • drain any queued adaptation rows
   */
  const commitSession = useCallback((): Promise<CommitSessionResult> => {
    // Two completion callbacks must not start two independent progression
    // flushes. In a session with a raw write failure, retain that failure
    // result rather than allowing a second attempt to silently promote from
    // an incomplete set of patient attempts.
    if (commitPromiseRef.current) return commitPromiseRef.current;
    const commit = (async (): Promise<CommitSessionResult> => {
    const errors: string[] = [];
    let progressionSnapshot: { level: number; progressPct: number } | null = null;
    let recapSnapshot: CommitSessionResult['progressionSnapshot'] = null;
    let masteryFlushed = false;

    // Await every event's real result before computing persisted clinical
    // progression or mastery. If any raw attempt could not be persisted,
    // fail CLOSED: a partial session must not advance a clinical level.
    // A loop also catches trial callbacks registered during an earlier wait.
    let rawTrialFailures = 0;
    while (uncommittedTrialsRef.current.length > 0) {
      const batch = uncommittedTrialsRef.current.splice(0);
      const settled = await Promise.allSettled(batch);
      for (const outcome of settled) {
        if (outcome.status === 'rejected' || !outcome.value.ok ||
            !outcome.value.routed.exerciseEvents) {
          rawTrialFailures += 1;
        }
      }
    }
    if (rawTrialFailures > 0) {
      errors.push(`raw clinical event writes failed: ${rawTrialFailures} of this session's trial submissions; progression and mastery were not flushed`);
      console.warn('[commitSession] fail-closed: raw clinical evidence incomplete', {
        game: canonicalSlug, sessionId: opts.sessionId,
        rawTrialFailures,
      });
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
    })();
    commitPromiseRef.current = commit;
    return commit;
  }, [canonicalSlug, debug, flushAdaptation, opts.progression, opts.profileId, opts.sessionId, opts.userId]);

  return { submitTrial, commitSession, startTrial, calculateReactionTime };
}
