import { useState, useRef, useCallback, useEffect } from 'react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';
import { SuccessBandController, type SuccessBandConfig, type SuccessBandState } from '@/lib/successBandController';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import { tierToLevel, type LevelScale } from '@/lib/gameLevels';
import {
  publishAdaptiveLevel,
  clearAdaptiveLevel,
} from '@/lib/adaptiveLevelRegistry';

interface UseAdaptiveDifficultyOptions {
  initialDifficulty: number;
  bounds: DifficultyBounds;
  windowSize?: number;
  targetSuccessRate?: number;
  adjustmentThreshold?: number;
  onDifficultyChange?: (newLevel: number) => void;
  // Logging context
  userId?: string;
  profileId?: string;
  sessionId?: string | null;
  exerciseSlug?: string;
  // Success-band controller config
  successBandConfig?: Partial<SuccessBandConfig>;

  // ── Phase 1 parity with useInGameAdaptation ─────────────────────────────
  /** Optional cue-dependency safety gate. Returns 0..1 or null. */
  getCueDependencyScore?: () => number | null;
  cueDependencyEscalationThreshold?: number; // default 0.5
  minTrialsAtLevelForEscalation?: number;     // default 8
  /** Auto-write per-trial rows into adaptation_trial_logs. Default true. */
  autoLog?: boolean;
  /**
   * Game's internal tier scale used to compute the canonical 1–10 level
   * published into the adaptive level registry. Defaults to {min:1,max:10}
   * (i.e. passthrough), matching how this hook has historically been used.
   */
  levelScale?: LevelScale;
}

export const useAdaptiveDifficulty = ({
  initialDifficulty,
  bounds,
  windowSize = 4, // was 5 — matches useInGameAdaptation so adaptation can trigger within a 3-round session
  targetSuccessRate = 0.80,
  adjustmentThreshold = 0.15,
  onDifficultyChange,
  userId,
  profileId,
  sessionId,
  exerciseSlug,
  successBandConfig,
  getCueDependencyScore,
  cueDependencyEscalationThreshold = 0.5,
  minTrialsAtLevelForEscalation = 8,
  autoLog = true,
  levelScale = { min: 1, max: 10 },
}: UseAdaptiveDifficultyOptions) => {
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const trialIndexRef = useRef(0);
  const trialsAtLevelRef = useRef(0);
  const lastTrialCorrectRef = useRef<boolean | null>(null);
  const lastTrialReactionRef = useRef<number | undefined>(undefined);

  const controllerRef = useRef(
    new AdaptiveDifficultyController(
      windowSize,
      targetSuccessRate,
      adjustmentThreshold,
      bounds
    )
  );

  // Success-band controller for 70-85% optimal challenge zone
  const bandRef = useRef(new SuccessBandController(successBandConfig));

  // Adaptation event logger - only active if userId provided
  const { logDifficultyChange } = useAdaptationEventLogger({
    userId,
    profileId,
  });

  // Per-trial telemetry logger (Phase 4) — auto-wired so legacy games show up too
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const effectiveUserId = userId ?? user?.id;
  // Always thread the active patient profile so adaptation_trial_logs.profile_id
  // matches sessions.profile_id even when the caller (e.g. PatternMatchGame)
  // doesn't pass profileId explicitly.
  const effectiveProfileId = profileId ?? activeProfile?.id ?? null;
  const { logTrial: autoLogTrial } = useAdaptationTrialLogger({
    userId: effectiveUserId,
    profileId: effectiveProfileId,
    sessionId: sessionId ?? null,
    exerciseSlug: normalizeExerciseSlug(exerciseSlug ?? 'unknown'),
    enabled: autoLog && !!effectiveUserId && !!exerciseSlug,
  });

  // Update bounds when they change
  useEffect(() => {
    controllerRef.current.setBounds(bounds);
  }, [bounds]);

  // Publish current adaptive level into the registry so useExerciseTelemetry
  // can auto-inject `game_level` without per-page wiring. Cleared on unmount.
  useEffect(() => {
    if (!exerciseSlug) return;
    publishAdaptiveLevel({
      sessionId: sessionId ?? null,
      exerciseSlug,
      gameLevel: tierToLevel(currentDifficulty, levelScale),
      internalDifficulty: currentDifficulty,
      source: 'adaptive_difficulty',
    });
  }, [exerciseSlug, sessionId, currentDifficulty, levelScale]);

  useEffect(() => {
    return () => {
      if (exerciseSlug) clearAdaptiveLevel(sessionId ?? null, exerciseSlug);
    };
  }, [exerciseSlug, sessionId]);

  // Update a trial result — feeds both the legacy controller AND success-band
  const updateTrial = useCallback((wasCorrect: boolean, reactionTimeMs?: number) => {
    controllerRef.current.update(wasCorrect);
    bandRef.current.recordTrial(wasCorrect);
    trialIndexRef.current += 1;
    trialsAtLevelRef.current += 1;
    lastTrialCorrectRef.current = wasCorrect;
    lastTrialReactionRef.current = reactionTimeMs;
  }, []);

  // Check if difficulty should adjust and return the result
  const checkAndAdjust = useCallback((): { adjusted: boolean; newLevel: number; blocked?: boolean } => {
    const previousLevel = currentDifficulty;
    const proposedLevel = controllerRef.current.adjustLevel(currentDifficulty);
    const proposedDirection: 'up' | 'down' | null =
      proposedLevel > previousLevel ? 'up' : proposedLevel < previousLevel ? 'down' : null;

    let newLevel = previousLevel;
    let adjusted = false;
    let blocked = false;
    let blockedReason: string | null = null;
    let blockedCueDep: number | null = null;

    if (proposedDirection === 'up' && getCueDependencyScore) {
      const cd = getCueDependencyScore();
      if (
        cd !== null &&
        cd !== undefined &&
        cd > cueDependencyEscalationThreshold &&
        trialsAtLevelRef.current < minTrialsAtLevelForEscalation
      ) {
        blocked = true;
        blockedCueDep = cd;
        blockedReason =
          `Escalation blocked: cue_dependency=${cd.toFixed(2)} > ${cueDependencyEscalationThreshold}, ` +
          `trials_at_level=${trialsAtLevelRef.current} < ${minTrialsAtLevelForEscalation}`;
      }
    }

    if (proposedDirection && !blocked) {
      newLevel = proposedLevel;
      adjusted = true;
      setCurrentDifficulty(newLevel);
      onDifficultyChange?.(newLevel);
      trialsAtLevelRef.current = 0;

      // Log adaptation event if we have userId
      if (effectiveUserId && exerciseSlug) {
        const state = controllerRef.current.getState();
        logDifficultyChange(
          proposedDirection,
          previousLevel,
          newLevel,
          state.successRate,
          0,
          sessionId,
          exerciseSlug,
          trialIndexRef.current
        );
      }
    }

    // Per-trial telemetry — fires regardless of whether difficulty changed,
    // so /dev/session-replay shows activity for these legacy games too.
    if (autoLog && effectiveUserId && exerciseSlug && lastTrialCorrectRef.current !== null) {
      const state = controllerRef.current.getState();
      let cueDep: number | null = null;
      try {
        const v = getCueDependencyScore?.();
        cueDep = v == null ? null : v;
      } catch { /* noop */ }

      autoLogTrial({
        trialIndex: trialIndexRef.current - 1,
        difficulty: adjusted ? newLevel : previousLevel,
        cueDependency: cueDep,
        successRate: state.successRate,
        correct: lastTrialCorrectRef.current,
        reactionTimeMs: lastTrialReactionRef.current ?? null,
        trialsAtLevel: trialsAtLevelRef.current,
        difficultyChange: adjusted && proposedDirection
          ? {
              direction: proposedDirection,
              from: previousLevel,
              to: newLevel,
              reason: proposedDirection === 'up'
                ? `Success rate ${(state.successRate * 100).toFixed(0)}% - increasing challenge`
                : `Success rate ${(state.successRate * 100).toFixed(0)}% - providing support`,
            }
          : null,
        escalationBlocked: blocked
          ? {
              reason: blockedReason ?? 'cue_dependency_hold',
              cueDependencyScore: blockedCueDep ?? 0,
              trialsAtLevel: trialsAtLevelRef.current,
              level: previousLevel,
            }
          : null,
      });
    }

    return { adjusted, newLevel: adjusted ? newLevel : previousLevel, blocked };
  }, [
    currentDifficulty,
    onDifficultyChange,
    effectiveUserId,
    exerciseSlug,
    sessionId,
    logDifficultyChange,
    autoLog,
    autoLogTrial,
    getCueDependencyScore,
    cueDependencyEscalationThreshold,
    minTrialsAtLevelForEscalation,
  ]);

  // Emergency step down
  const stepDown = useCallback((): number => {
    const previousLevel = currentDifficulty;
    const newLevel = controllerRef.current.handleFrustration(currentDifficulty);
    setCurrentDifficulty(newLevel);
    onDifficultyChange?.(newLevel);
    if (newLevel !== previousLevel) trialsAtLevelRef.current = 0;

    // Log frustration stepdown
    if (effectiveUserId && exerciseSlug && newLevel !== previousLevel) {
      const state = controllerRef.current.getState();
      logDifficultyChange(
        'down',
        previousLevel,
        newLevel,
        state.successRate,
        3,
        sessionId,
        exerciseSlug,
        trialIndexRef.current
      );
    }

    return newLevel;
  }, [currentDifficulty, onDifficultyChange, effectiveUserId, exerciseSlug, sessionId, logDifficultyChange]);

  // Update bounds dynamically
  const setBounds = useCallback((newBounds: DifficultyBounds) => {
    controllerRef.current.setBounds(newBounds);
  }, []);

  // Get current controller state for debugging
  const getState = useCallback(() => {
    return controllerRef.current.getState();
  }, []);

  // Reset controller for new session
  const reset = useCallback(() => {
    controllerRef.current.reset();
    bandRef.current.reset();
    trialIndexRef.current = 0;
    trialsAtLevelRef.current = 0;
    lastTrialCorrectRef.current = null;
    lastTrialReactionRef.current = undefined;
  }, []);

  // Get cue level based on recent errors
  const getCueLevel = useCallback((recentErrorCount: number): number => {
    return controllerRef.current.getCueLevel(recentErrorCount);
  }, []);

  // Get current success rate
  const getSuccessRate = useCallback((): number => {
    return controllerRef.current.getSuccessRate();
  }, []);

  // Get success-band state
  const getSuccessBandState = useCallback((): SuccessBandState => {
    return bandRef.current.getState();
  }, []);

  // Acknowledge success-band recommendation (resets persistence counters)
  const acknowledgeSuccessBand = useCallback(() => {
    bandRef.current.acknowledge();
  }, []);

  return {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
    stepDown,
    setBounds,
    getCueLevel,
    getSuccessRate,
    getState,
    reset,
    getSuccessBandState,
    acknowledgeSuccessBand,
    controller: controllerRef.current,
  };
};
