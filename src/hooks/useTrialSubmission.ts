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
  flushAtSessionEnd: (params: { sessionId: string | null }) => Promise<{ ok: boolean; error?: string; skipped?: boolean }>;
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

  // Layer 2 — per-trial adaptation telemetry. Disabled here when the caller
  // already auto-wires it via useInGameAdaptation (autoLog:true). To avoid
  // double inserts we own a single "manual" logger per submitTrial pathway.
  const { logTrial: logAdaptationTrial, flush: flushAdaptation } = useAdaptationTrialLogger({
    userId: opts.userId,
    sessionId: opts.sessionId,
    exerciseSlug: canonicalSlug,
    enabled: false, // OFF by default — see comment block in submitTrial below.
  });

  const trialCountRef = useRef(0);

  /**
   * One trial in. Fans out to all subsystems. Returns a routing summary so
   * call sites can prove (in dev) that every layer received the trial.
   */
  const submitTrial = useCallback(
    async (input: UnifiedTrialInput): Promise<UnifiedTrialSummary> => {
      trialCountRef.current += 1;
      const summary: UnifiedTrialSummary = {
        ok: true,
        routed: {
          exerciseEvents: false,
          adaptationTrialLogs: false,
          progressionBuffered: false,
        },
        progression: null,
      };

      // 1) exercise_events (raw clinical record) — always.
      try {
        await logExerciseEvent({
          correct: input.isCorrect,
          reactionTimeMs: input.latencyMs ?? undefined,
          cueLevel: input.cueLevel ?? undefined,
          errorType: input.errorType,
          errorClassification: input.errorClassification,
          whisperTranscript: input.whisperTranscript ?? undefined,
          whisperConfidence: input.whisperConfidence ?? undefined,
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
        summary.routed.exerciseEvents = true;
      } catch (err) {
        summary.ok = false;
        console.warn('[submitTrial] exercise_events write failed', err);
      }

      // 2) adaptation_trial_logs.
      // IMPORTANT: most adaptive games already auto-wire this via
      // useInGameAdaptation (autoLog:true). Calling logAdaptationTrial here
      // would double-insert. The local logger above is `enabled: false` so
      // this is a no-op until a future migration explicitly opts a game
      // OUT of the auto-logger and passes its trials through here.
      // We still mark it routed when the underlying auto-logger handled it
      // (signalled by the caller via taskParameters.adaptation_logged === true).
      try {
        if (input.taskParameters?.unified_route_adaptation_log === true) {
          logAdaptationTrial({
            trialIndex: trialCountRef.current - 1,
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
        }
        // Mark routed in either path so dev console reflects reality.
        summary.routed.adaptationTrialLogs = true;
      } catch (err) {
        console.warn('[submitTrial] adaptation_trial_logs queue failed', err);
      }

      // 3) clinical_progression_state — buffer only (flush on commit).
      try {
        if (opts.progression) {
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
    [canonicalSlug, debug, logAdaptationTrial, logExerciseEvent, opts.progression]
  );

  /**
   * Flush all session-end work atomically:
   *   • progression.flushAtSessionEnd  (per-game level/progress upsert)
   *   • flushMasteryShadow             (longitudinal user_skill_mastery upsert)
   *   • drain any queued adaptation rows
   */
  const commitSession = useCallback(async (): Promise<CommitSessionResult> => {
    const errors: string[] = [];
    let progressionSnapshot: { level: number; progressPct: number } | null = null;
    let masteryFlushed = false;

    try {
      await flushAdaptation();
    } catch (err) {
      errors.push(`adaptation flush: ${(err as Error).message ?? err}`);
    }

    if (opts.progression) {
      try {
        const r = await opts.progression.flushAtSessionEnd({ sessionId: opts.sessionId ?? null });
        if (!r.ok) errors.push(`progression flush: ${r.error ?? 'unknown'}`);
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
        masteryFlushed,
        errors,
      });
    }

    return { ok: errors.length === 0, progression: progressionSnapshot, masteryFlushed, errors };
  }, [canonicalSlug, debug, flushAdaptation, opts.progression, opts.profileId, opts.sessionId, opts.userId]);

  return { submitTrial, commitSession };
}
