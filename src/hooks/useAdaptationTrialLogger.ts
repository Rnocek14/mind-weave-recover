/**
 * useAdaptationTrialLogger
 *
 * Phase 4 — Real-world adaptive validation.
 *
 * Captures one row per trial in `adaptation_trial_logs` and detects
 * anomalies (unsafe escalation, missing narration, stale adaptation)
 * which are written to `adaptation_anomalies`.
 *
 * Buffered + best-effort: never throws into the gameplay loop.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { classifyReason, narrateAdaptation, type AdaptationDirection } from '@/lib/adaptationNarrator';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

export interface TrialLogInput {
  trialIndex: number;
  difficulty: number;
  cueLevel?: number | null;
  cueDependency?: number | null;     // 0..1
  successRate?: number | null;
  correct: boolean;
  reactionTimeMs?: number | null;
  frustration?: string | null;
  fatigue?: string | null;
  recommendedAction?: string | null;
  trialsAtLevel?: number | null;
  difficultyChange?: {
    direction: 'up' | 'down';
    from: number;
    to: number;
    reason: string;
    narration?: string;
  } | null;
  escalationBlocked?: {
    reason: string;
    cueDependencyScore: number;
    trialsAtLevel: number;
    level: number;
  } | null;
  /**
   * Speech Validity Gate (Phase 1).
   * If present and not 'valid_attempt', the trial is dropped from
   * adaptation logs and only an audit anomaly is recorded.
   */
  validity?: {
    label: string;
    reason?: string;
  } | null;
  /**
   * Granular mastery telemetry (frozen progression theory v0.3.0-spec).
   * All fields are optional — writers adopt them per game as the
   * archetype rollout progresses. Validated by a soft DB trigger.
   */
  trialMode?: 'production' | 'recognition' | 'exposure' | 'scaffolded' | 'mixed' | null;
  /** Continuous [0..1] evidence; do NOT threshold upstream. */
  gradedScore?: number | null;
  /** Multi-dimensional named scores (e.g. {coverage, coherence}). */
  scoreVector?: Record<string, number> | null;
  signalGranularity?: 'boolean' | 'graded' | 'multi-dimensional' | null;
  /** Open-ended scaffold rung (0 = full support, higher = less). */
  scaffoldLevel?: number | null;
  dominantAxis?:
    | 'content-complexity'
    | 'pressure-retention'
    | 'scaffold-independence'
    | 'recognition-to-production'
    | 'mixed'
    | null;
  archetype?: 'content-expanding' | 'performance-pressure' | 'hybrid' | 'open-ended' | null;
}

interface Options {
  userId: string | undefined | null;
  /** Active patient profile id — attributes telemetry per profile (multi-patient households). */
  profileId?: string | undefined | null;
  sessionId: string | null | undefined;
  exerciseSlug: string;
  /** Default true in dev, false in prod. */
  enabled?: boolean;
  /** cue dependency threshold for unsafe-escalation detection (default 0.5). */
  cueDependencyThreshold?: number;
  minTrialsAtLevel?: number;
  /** if no adaptation event in this many trials with success>target, flag stale */
  staleAdaptationWindow?: number;
}

interface PendingRow {
  user_id: string;
  profile_id: string | null;
  session_id: string | null;
  exercise_slug: string;
  trial_index: number;
  difficulty: number;
  cue_level: number | null;
  cue_dependency: number | null;
  success_rate: number | null;
  correct: boolean;
  reaction_time_ms: number | null;
  frustration: string | null;
  fatigue: string | null;
  recommended_action: string | null;
  trials_at_level: number | null;
  difficulty_change_direction: string | null;
  difficulty_change_from: number | null;
  difficulty_change_to: number | null;
  difficulty_change_reason: string | null;
  narration: string | null;
  escalation_blocked: boolean;
  escalation_block_reason: string | null;
  trial_mode: string | null;
  graded_score: number | null;
  score_vector: Record<string, number> | null;
  signal_granularity: string | null;
  scaffold_level: number | null;
  dominant_axis: string | null;
  archetype: string | null;
}

interface AnomalyRow {
  user_id: string;
  session_id: string | null;
  exercise_slug: string;
  trial_index: number;
  anomaly_type: string;
  severity: 'info' | 'warn' | 'critical';
  detail: string;
  evidence: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 2500;
const MAX_BUFFER = 25;

// Offline/retry outbox — unflushed rows survive network failures and page
// closes via localStorage, keyed per user so RLS can accept them on replay.
const OUTBOX_CAP = 200;
const outboxKey = (userId: string) => `adaptation_trial_outbox_v1:${userId}`;

function readOutbox(userId: string): PendingRow[] {
  try {
    const raw = localStorage.getItem(outboxKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(r => r && r.user_id === userId) : [];
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, rows: PendingRow[]) {
  try {
    if (rows.length === 0) {
      localStorage.removeItem(outboxKey(userId));
      return;
    }
    // Merge with whatever another logger instance already saved, newest last.
    const existing = readOutbox(userId);
    const merged = [...existing, ...rows].slice(-OUTBOX_CAP);
    localStorage.setItem(outboxKey(userId), JSON.stringify(merged));
  } catch {
    // Storage unavailable (private mode/quota) — nothing more we can do.
  }
}

function takeOutbox(userId: string): PendingRow[] {
  const rows = readOutbox(userId);
  try {
    localStorage.removeItem(outboxKey(userId));
  } catch { /* ignore */ }
  return rows;
}

export function useAdaptationTrialLogger(opts: Options) {
  const enabled = opts.enabled ?? true;
  const cueThreshold = opts.cueDependencyThreshold ?? 0.5;
  const minTrials = opts.minTrialsAtLevel ?? 8;
  const staleWindow = opts.staleAdaptationWindow ?? 15;
  // Canonical slug — guarantees adaptation_trial_logs joins with exercise_events.
  const canonicalSlug = useMemo(
    () => normalizeExerciseSlug(opts.exerciseSlug),
    [opts.exerciseSlug]
  );

  const trialBuf = useRef<PendingRow[]>([]);
  const anomalyBuf = useRef<AnomalyRow[]>([]);
  const lastAdaptationTrialRef = useRef<number>(-1);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest known non-null profileId. Lets us stamp rows that were buffered
  // before the active profile finished loading (timing race that produced
  // null profile_id on early trials for Pattern Match / Photo Naming).
  const profileIdRef = useRef<string | null>(opts.profileId ?? null);
  if (opts.profileId) profileIdRef.current = opts.profileId;
  const nullProfileWarnedRef = useRef(false);

  const consecutiveFailuresRef = useRef(0);
  const failureReportedRef = useRef(false);

  const flush = useCallback(async () => {
    if (trialBuf.current.length === 0 && anomalyBuf.current.length === 0) return;
    const trials = trialBuf.current.splice(0, trialBuf.current.length);
    const anomalies = anomalyBuf.current.splice(0, anomalyBuf.current.length);
    // Backfill profile_id for rows buffered before the profile finished loading.
    // Guard: warn once if we still cannot resolve a profile while a session exists.
    for (const t of trials) {
      if (!t.profile_id && profileIdRef.current) {
        t.profile_id = profileIdRef.current;
      }
      if (!t.profile_id && t.session_id && !nullProfileWarnedRef.current) {
        nullProfileWarnedRef.current = true;
        console.warn(
          '[adaptation_trial_logs] profile_id is null while session_id is set — ' +
            'active profile may not be loaded. Trial will be logged unattributed.',
          { session_id: t.session_id, exercise_slug: t.exercise_slug },
        );
      }
    }
    let hadFailure = false;
    let trialsFailed = false;
    try {
      if (trials.length > 0) {
        const { error } = await supabase.from('adaptation_trial_logs' as any).insert(trials as any);
        if (error) {
          hadFailure = true;
          trialsFailed = true;
          // Phase 2: was dev-only. Promoted to error in all envs so prod
          // failures (RLS, schema drift) are visible.
          console.error('[adaptation_trial_logs] insert failed', { error: error.message, count: trials.length });
        }
      }
      if (anomalies.length > 0) {
        const { error } = await supabase.from('adaptation_anomalies' as any).insert(anomalies as any);
        if (error) {
          hadFailure = true;
          console.error('[adaptation_anomalies] insert failed', { error: error.message, count: anomalies.length });
        }
      }
    } catch (err) {
      hadFailure = true;
      trialsFailed = trials.length > 0;
      console.error('[adaptationLogger] flush threw', err);
    }
    if (trialsFailed) {
      // Failed inserts go BACK into the buffer (front, preserving order) so
      // the next interval retries them. Page-death persistence is handled by
      // the pagehide handler below, which moves the buffer to a localStorage
      // outbox replayed on the next mount.
      trialBuf.current.unshift(...trials.slice(-OUTBOX_CAP));
    }
    if (hadFailure) {
      consecutiveFailuresRef.current += 1;
      // After 3 consecutive failed flushes within a session, emit one
      // exercise_events row so prod telemetry-write failures are queryable.
      if (consecutiveFailuresRef.current >= 3 && !failureReportedRef.current && opts.userId && opts.sessionId) {
        failureReportedRef.current = true;
        void supabase.from('exercise_events' as any).insert({
          user_id: opts.userId,
          session_id: opts.sessionId,
          exercise_slug: canonicalSlug,
          event_type: 'telemetry_write_failure',
          inputs: { consecutive_failures: consecutiveFailuresRef.current },
        } as any);
      }
    } else {
      consecutiveFailuresRef.current = 0;
    }
  }, [opts.userId, opts.sessionId, canonicalSlug]);

  useEffect(() => {
    if (!enabled) return;
    flushTimer.current = setInterval(() => { void flush(); }, FLUSH_INTERVAL_MS);
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
      void flush();
    };
  }, [enabled, flush]);

  // Replay rows a previous page load failed to deliver (takeOutbox clears the
  // key synchronously, so concurrent logger instances can't double-restore).
  useEffect(() => {
    if (!enabled || !opts.userId) return;
    const orphaned = takeOutbox(opts.userId);
    if (orphaned.length > 0) {
      trialBuf.current.unshift(...orphaned);
      void flush();
    }
  }, [enabled, opts.userId, flush]);

  // Real page death (close/navigate away): the async insert may never finish,
  // so move undelivered rows to the outbox for replay on the next visit.
  // SPA unmounts don't fire pagehide — the cleanup `void flush()` covers those.
  useEffect(() => {
    if (!enabled || !opts.userId) return;
    const userId = opts.userId;
    const persistPending = () => {
      if (trialBuf.current.length === 0) return;
      const rows = trialBuf.current.splice(0, trialBuf.current.length);
      writeOutbox(userId, rows);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('pagehide', persistPending);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', persistPending);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, opts.userId, flush]);

  const logTrial = useCallback((input: TrialLogInput) => {
    if (!enabled || !opts.userId) return;
    // Skip rows that would land with session_id = NULL — these are the result of
    // a logger being initialized before the standalone session row finishes
    // creating. Dropping them is preferable to polluting telemetry with
    // un-attributable trials.
    if (!opts.sessionId) {
      if (import.meta.env.DEV) {
        console.debug('[adaptationLogger] skipping trial — sessionId not yet ready', {
          exercise: canonicalSlug,
          trialIndex: input.trialIndex,
        });
      }
      return;
    }

    // Speech Validity Gate — invalid attempts must NOT feed adaptation.
    // Record an audit-only anomaly so clinicians can see what was filtered.
    if (input.validity && input.validity.label !== 'valid_attempt') {
      anomalyBuf.current.push({
        user_id: opts.userId,
        session_id: opts.sessionId ?? null,
        exercise_slug: canonicalSlug,
        trial_index: input.trialIndex,
        anomaly_type: `validity_filtered:${input.validity.label}`,
        severity: 'info',
        detail: input.validity.reason ?? `Trial filtered by validity gate (${input.validity.label}).`,
        evidence: { validity: input.validity.label },
      });
      if (anomalyBuf.current.length >= MAX_BUFFER) void flush();
      return;
    }

    const dir: AdaptationDirection | null = input.escalationBlocked
      ? 'hold'
      : (input.difficultyChange?.direction ?? null);

    const narration = input.difficultyChange?.narration
      ?? (dir
        ? narrateAdaptation({
            direction: dir,
            reasonKind: input.escalationBlocked
              ? 'cue_dependency_hold'
              : classifyReason(input.difficultyChange?.reason),
          })
        : null);

    const row: PendingRow = {
      user_id: opts.userId,
      profile_id: opts.profileId ?? null,
      session_id: opts.sessionId ?? null,
      exercise_slug: canonicalSlug,
      trial_index: input.trialIndex,
      difficulty: input.difficulty,
      cue_level: input.cueLevel ?? null,
      cue_dependency: input.cueDependency ?? null,
      success_rate: input.successRate ?? null,
      correct: input.correct,
      reaction_time_ms: input.reactionTimeMs ?? null,
      frustration: input.frustration ?? null,
      fatigue: input.fatigue ?? null,
      recommended_action: input.recommendedAction ?? null,
      trials_at_level: input.trialsAtLevel ?? null,
      difficulty_change_direction: input.difficultyChange?.direction ?? null,
      difficulty_change_from: input.difficultyChange?.from ?? null,
      difficulty_change_to: input.difficultyChange?.to ?? null,
      difficulty_change_reason: input.difficultyChange?.reason ?? null,
      narration: narration ?? null,
      escalation_blocked: !!input.escalationBlocked,
      escalation_block_reason: input.escalationBlocked?.reason ?? null,
      trial_mode: input.trialMode ?? null,
      graded_score: input.gradedScore ?? null,
      score_vector: input.scoreVector ?? null,
      signal_granularity: input.signalGranularity ?? null,
      scaffold_level: input.scaffoldLevel ?? null,
      dominant_axis: input.dominantAxis ?? null,
      archetype: input.archetype ?? null,
    };

    trialBuf.current.push(row);

    // ── Anomaly detection ────────────────────────────────────────────────
    // 1. Unsafe escalation: an UP change while cue dependency was high & few trials at level.
    if (
      input.difficultyChange?.direction === 'up' &&
      (input.cueDependency ?? 0) > cueThreshold &&
      (input.trialsAtLevel ?? 0) < minTrials
    ) {
      anomalyBuf.current.push({
        user_id: opts.userId,
        session_id: opts.sessionId ?? null,
        exercise_slug: canonicalSlug,
        trial_index: input.trialIndex,
        anomaly_type: 'unsafe_escalation',
        severity: 'critical',
        detail: `UP escalation while cue_dependency=${input.cueDependency} > ${cueThreshold} and trials_at_level=${input.trialsAtLevel} < ${minTrials}`,
        evidence: {
          cueDependency: input.cueDependency,
          trialsAtLevel: input.trialsAtLevel,
          from: input.difficultyChange.from,
          to: input.difficultyChange.to,
        },
      });
      if (import.meta.env.DEV) {
        console.error('[adaptationLogger] UNSAFE ESCALATION', row);
      }
    }

    // 2. Missing narration on a difficulty change.
    if (input.difficultyChange && (!narration || narration.trim() === '')) {
      anomalyBuf.current.push({
        user_id: opts.userId,
        session_id: opts.sessionId ?? null,
        exercise_slug: canonicalSlug,
        trial_index: input.trialIndex,
        anomaly_type: 'missing_narration',
        severity: 'warn',
        detail: `Difficulty change ${input.difficultyChange.from}→${input.difficultyChange.to} produced empty narration`,
        evidence: { reason: input.difficultyChange.reason },
      });
    }

    // 3. Track adaptation activity for staleness check.
    if (input.difficultyChange || input.escalationBlocked) {
      lastAdaptationTrialRef.current = input.trialIndex;
    } else if (
      lastAdaptationTrialRef.current >= 0 &&
      input.trialIndex - lastAdaptationTrialRef.current >= staleWindow &&
      (input.successRate ?? 0) > 0.9
    ) {
      anomalyBuf.current.push({
        user_id: opts.userId,
        session_id: opts.sessionId ?? null,
        exercise_slug: canonicalSlug,
        trial_index: input.trialIndex,
        anomaly_type: 'stale_adaptation',
        severity: 'warn',
        detail: `No adaptation event in ${staleWindow}+ trials despite success_rate=${input.successRate}`,
        evidence: { lastAdaptationAt: lastAdaptationTrialRef.current, successRate: input.successRate },
      });
      lastAdaptationTrialRef.current = input.trialIndex; // avoid spamming
    }

    if (trialBuf.current.length >= MAX_BUFFER) void flush();
  }, [enabled, opts.userId, opts.sessionId, canonicalSlug, cueThreshold, minTrials, staleWindow, flush]);

  return { logTrial, flush };
}
