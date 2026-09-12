import { useState, useRef, useCallback, useEffect } from 'react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { clampToBounds, type DifficultyBounds } from '@/lib/difficultyBounds';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAdaptationTrialLogger } from '@/hooks/useAdaptationTrialLogger';
import { useAdaptationEventLogger } from '@/hooks/useAdaptationEventLogger';
import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';
import {
  type LevelScale,
  type LevelDescriptor,
  tierToLevel,
  describeLevel,
} from '@/lib/gameLevels';
import {
  publishAdaptiveLevel,
  clearAdaptiveLevel,
} from '@/lib/adaptiveLevelRegistry';

// ============================================================================
// In-Game Adaptive Layer
// 
// Shared hook providing real-time adaptivity DURING gameplay:
// - Difficulty adjustment based on rolling performance window
// - Frustration detection (consecutive errors, stalls)
// - Intervention triggers (hints, breaks, simplification)
// - Telemetry signals for upstream analytics
//
// This is Layer 2 in the three-layer adaptive model:
// Layer 1: Session Planning (Today's Lesson - what to play)
// Layer 2: In-Game Adaptation (this hook - how to respond in real-time)
// Layer 3: Game UI (exercise components - visual presentation)
//
// ARCHITECTURE NOTE: Uses refs as authoritative state inside recordTrial
// to avoid stale closure issues when trials come quickly. State is synced
// for React re-renders but refs are the source of truth for computations.
// ============================================================================

// Frustration levels for graduated response
export type FrustrationLevel = 'none' | 'low' | 'medium' | 'high';

// Intervention types the hook can recommend
export type InterventionType = 
  | 'difficulty_down'      // Auto: reduce level by 1-2
  | 'show_hint'            // Auto: display cue without request
  | 'break_prompt'         // Modal: suggest break
  | 'confidence_boost'     // Modal: show encouragement + stats
  | 'switch_task'          // Suggestion: try different exercise
  | 'session_end';         // Suggestion: end early

// Trial result for tracking
export interface TrialResult {
  correct: boolean;
  reactionTimeMs?: number;
  errorType?: string;
  timedOut?: boolean;
  cueWasShown?: boolean;
}

// Configuration options
export interface InGameAdaptationOptions {
  exerciseSlug: string;
  sessionId: string | null;
  
  initialDifficulty: number;
  bounds: DifficultyBounds;
  
  // Thresholds (with sensible research-aligned defaults)
  windowSize?: number;                  // Default: 4 (rolling window for success rate; was 5 — too large for short 3-round games)
  targetSuccessRate?: number;           // Default: 0.80 (research: 75-85% sweet spot)
  adjustmentThreshold?: number;         // Default: 0.10 (70-90% flow zone)
  
  // Frustration detection thresholds
  frustrationErrorThreshold?: number;   // Default: 3 consecutive errors
  stallThresholdMs?: number;            // Default: 7000ms (was 3000 - too aggressive)
  
  // Feature flags - SPLIT for granular control
  enableAutoHints?: boolean;            // Default: true
  enableDifficultyToasts?: boolean;     // Default: true
  enableDifficultyAutoStepDown?: boolean; // Default: true - difficulty steps down even without UI
  enableInterventionUI?: boolean;       // Default: false - modals/confidence boosts opt-in

  // Cue-dependency safety gate (Phase 2 adaptive intelligence)
  // If provided, escalations are blocked when cue dependency is high but
  // the user hasn't yet shown ≥minTrialsAtLevelForEscalation independent trials.
  getCueDependencyScore?: () => number | null;     // 0..1; null/undefined = unknown
  cueDependencyEscalationThreshold?: number;        // Default: 0.5
  minTrialsAtLevelForEscalation?: number;           // Default: 8

  // Callbacks
  onDifficultyChange?: (level: number, reason: string, direction: 'up' | 'down') => void;
  onFrustrationDetected?: (level: FrustrationLevel) => void;
  onInterventionRequired?: (type: InterventionType) => void;
  /** Fired when an up-escalation is blocked by the cue-dependency gate. */
  onEscalationBlocked?: (info: { reason: string; cueDependencyScore: number; trialsAtLevel: number; level: number }) => void;
  /**
   * Fired AFTER every trial computation with a complete snapshot.
   * Used by useAdaptationTrialLogger to persist per-trial telemetry to Supabase.
   */
  onTrialLogged?: (snapshot: {
    trialIndex: number;
    difficulty: number;
    successRate: number;
    cueDependency: number | null;
    trialsAtLevel: number;
    correct: boolean;
    reactionTimeMs?: number;
    frustration: FrustrationLevel;
    difficultyChange?: { direction: 'up' | 'down'; from: number; to: number; reason: string } | null;
    escalationBlocked?: { reason: string; cueDependencyScore: number; trialsAtLevel: number; level: number } | null;
  }) => void;

  /**
   * Auto-wire useAdaptationTrialLogger inside this hook so every game that uses
   * useInGameAdaptation persists per-trial telemetry to `adaptation_trial_logs`
   * without each game having to call the logger manually.
   *
   * Default: true. Set to false if the parent component already wires its own
   * logger (e.g. PhotoNaming, TwoClues) to avoid double inserts.
   */
  autoLog?: boolean;

  /**
   * Trial mode stamped on the auto-logged `adaptation_trial_logs` rows (and used
   * by the telemetry anomaly detector to route trials). Games that keep autoLog
   * should declare their modality so the rows are not left untagged.
   * Defaults to null (untagged).
   */
  defaultTrialMode?: 'production' | 'recognition' | 'exposure' | 'scaffolded' | 'mixed' | null;

  /**
   * Game's internal tier scale (e.g. {min:1,max:3} or {min:1,max:10}).
   * Used to map `currentDifficulty` onto the canonical 1–10 GameLevel
   * exposed via `currentLevel`. Defaults to {min:1,max:10}.
   */
  levelScale?: LevelScale;
}

// Exported state for external use
export interface InGameAdaptationState {
  currentDifficulty: number;
  frustrationLevel: FrustrationLevel;
  recentSuccessRate: number;
  consecutiveErrors: number;
  trialCount: number;
  
  // Computed recommendations
  recommendedCueType: 'semantic' | 'phonemic' | 'full_word' | null;
  shouldShowIntervention: InterventionType | null;
  shouldSimplifyTask: boolean;
}

/**
 * Stand-in success rate used while the rolling window is still filling.
 * "No evidence yet" must read as calm, never as failure.
 */
const NEUTRAL_SUCCESS_RATE = 1;

export const useInGameAdaptation = (options: InGameAdaptationOptions) => {
  const {
    exerciseSlug,
    sessionId,
    initialDifficulty,
    bounds,
    
    // Thresholds with research-aligned defaults
    windowSize = 4,
    targetSuccessRate = 0.80,
    adjustmentThreshold = 0.10,
    frustrationErrorThreshold = 3,
    stallThresholdMs = 7000,
    
    // Feature flags - split for granular control
    enableAutoHints = true,
    enableDifficultyToasts = true,
    enableDifficultyAutoStepDown = true,  // Core adaptive behavior
    enableInterventionUI = false,          // UI modals opt-in
    
    // Cue-dependency safety gate
    getCueDependencyScore,
    cueDependencyEscalationThreshold = 0.5,
    minTrialsAtLevelForEscalation = 8,

    // Callbacks
    onDifficultyChange,
    onFrustrationDetected,
    onInterventionRequired,
    onEscalationBlocked,
    onTrialLogged,
    autoLog = true,
    defaultTrialMode = null,
    levelScale = { min: 1, max: 10 },
  } = options;

  // ── Auto-wired Phase 4 trial logger ──────────────────────────────────────
  // If a parent already supplies onTrialLogged we still call it; the auto-logger
  // also fires unless autoLog is false. PhotoNamingGame / TwoCluesGame pass
  // autoLog={false} to remain the single writer.
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const { logTrial: autoLogTrial, flush: flushAutoLog } = useAdaptationTrialLogger({
    userId: user?.id,
    profileId: activeProfile?.id ?? null,
    sessionId: sessionId ?? null,
    exerciseSlug: normalizeExerciseSlug(exerciseSlug),
    enabled: autoLog && !!user?.id,
  });

  // Centralized adaptation_events writer — every game using this hook now
  // emits a `difficulty_up` / `difficulty_down` / `frustration_stepdown` row
  // whenever the controller actually moves a level. No per-game wiring needed.
  const { logDifficultyChange: autoLogDifficultyEvent } = useAdaptationEventLogger({
    userId: user?.id,
    profileId: activeProfile?.id ?? null,
  });

  // ===========================================================================
  // AUTHORITATIVE REFS - these are the source of truth inside recordTrial
  // to avoid stale closure issues when trials come quickly
  // ===========================================================================
  const currentDifficultyRef = useRef(initialDifficulty);
  const consecutiveErrorsRef = useRef(0);
  const frustrationLevelRef = useRef<FrustrationLevel>('none');
  const trialCountRef = useRef(0);
  const successRateRef = useRef(0);
  /** Trials accumulated at the current difficulty level (resets on any change). */
  const trialsAtLevelRef = useRef(0);

  // React state for UI re-renders (synced from refs)
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [frustrationLevel, setFrustrationLevel] = useState<FrustrationLevel>('none');
  const [shouldShowIntervention, setShouldShowIntervention] = useState<InterventionType | null>(null);
  const [trialCount, setTrialCount] = useState(0);
  // null until the first trial — a fresh session has UNKNOWN flow, not 0%.
  // Initializing to 0 made every game open with the struggling-band label
  // ("Taking it steady") before the patient had answered anything.
  const [recentSuccessRate, setRecentSuccessRate] = useState<number | null>(null);
  
  // Reaction time tracking for fatigue detection
  const reactionTimesRef = useRef<number[]>([]);
  
  // Stall detection
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stallCallbackRef = useRef<(() => void) | null>(null);
  
  // Adaptive controller (manages rolling window + difficulty logic)
  const controllerRef = useRef(
    new AdaptiveDifficultyController(
      windowSize,
      targetSuccessRate,
      adjustmentThreshold,
      bounds
    )
  );

  // Update bounds when they change
  useEffect(() => {
    controllerRef.current.setBounds(bounds);
  }, [bounds]);

  // A page resolves the patient's persistent clinical level asynchronously, so
  // `initialDifficulty` routinely arrives AFTER the first render. The hook used
  // to keep whatever it saw first, which stranded patients an entire session
  // below their earned level — a render-level load gate cannot help, because
  // React runs the hook before the gate can return.
  //
  // This runs DURING render, not in an effect: React renders child components
  // before it runs the parent's effects, so a game that seeds its content from
  // a prop would already have captured the stale level by the time an effect
  // fired. Adjusting during render re-runs this component immediately, before
  // any child sees the value. (React's documented "adjust state when a prop
  // changes" pattern.) It only applies while no trial has been recorded, so
  // live in-session adaptation is never clobbered.
  // The seed is clamped and non-finite input is ignored: `NaN !== NaN` is
  // always true, so comparing a NaN prop would queue a state update on every
  // render and React would abort the exercise with "Too many re-renders".
  const seedCandidate = Number.isFinite(initialDifficulty)
    ? clampToBounds(initialDifficulty, bounds)
    : null;
  const [seededDifficulty, setSeededDifficulty] = useState(seedCandidate);
  if (seedCandidate !== null && seedCandidate !== seededDifficulty) {
    setSeededDifficulty(seedCandidate);
    // No inner comparison against the ref this block also writes: React may
    // replay a render pass (StrictMode, a discarded concurrent render), and a
    // guard that reads its own mutation would skip the queued state update on
    // the replay and leave state behind the ref.
    if (trialCountRef.current === 0) {
      currentDifficultyRef.current = seedCandidate;
      setCurrentDifficulty(seedCandidate);
    }
  }

  // ===========================================================================
  // Core API: Record a trial result
  // 
  // CRITICAL: All computations use refs, not state, to avoid stale closures.
  // State is updated at the end for React re-renders.
  // ===========================================================================
  const recordTrial = useCallback((result: TrialResult): { 
    difficultyAdjusted: boolean; 
    newDifficulty: number;
    frustrationTriggered: boolean;
    consecutiveErrors: number;
  } => {
    const controller = controllerRef.current;
    
    // Increment trial counters (ref-first)
    trialCountRef.current += 1;
    trialsAtLevelRef.current += 1;
    
    // Track reaction time for fatigue detection
    if (result.reactionTimeMs) {
      reactionTimesRef.current.push(result.reactionTimeMs);
      if (reactionTimesRef.current.length > 10) {
        reactionTimesRef.current.shift();
      }
    }
    
    // Update controller's rolling window
    controller.update(result.correct);
    successRateRef.current = controller.getSuccessRate();
    
    // Track consecutive errors (ref-first, then sync state)
    if (result.correct) {
      consecutiveErrorsRef.current = 0;
    } else {
      consecutiveErrorsRef.current += 1;
    }
    const newConsecutiveErrors = consecutiveErrorsRef.current;
    
    // Compute frustration level from fresh values.
    //
    // The success-rate clauses only mean something once the rolling window is
    // full. On a partial window a single wrong answer reads as 0% and used to
    // trip the emergency two-level step-down on the FIRST trial of a session —
    // exactly what PER_GAME_LEVELING_CONTRACT §1.4 forbids ("Never punish a
    // single trial or a single session"). Until the window fills we hand the
    // classifier a neutral rate so only the consecutive-error clauses can fire,
    // which preserves the documented "4 errors in a row → emergency 2-step
    // step-down" (EXERCISE_ADAPTATION_GUIDE).
    const windowFull = controller.getState().trialCount >= windowSize;
    const newFrustrationLevel = computeFrustrationLevel(
      newConsecutiveErrors,
      windowFull ? successRateRef.current : NEUTRAL_SUCCESS_RATE,
      frustrationErrorThreshold
    );
    
    const frustrationChanged = newFrustrationLevel !== frustrationLevelRef.current;
    if (frustrationChanged) {
      frustrationLevelRef.current = newFrustrationLevel;
      onFrustrationDetected?.(newFrustrationLevel);
    }
    
    // Difficulty adjustment logic
    let difficultyAdjusted = false;
    let newDifficulty = currentDifficultyRef.current;
    // Capture event metadata for onTrialLogged snapshot
    let evtChange: { direction: 'up' | 'down'; from: number; to: number; reason: string } | null = null;
    let evtBlocked: { reason: string; cueDependencyScore: number; trialsAtLevel: number; level: number } | null = null;
    
    // Handle high frustration with emergency step-down
    // Note: step-down happens if enableDifficultyAutoStepDown is true (core behavior)
    // UI interventions (modals) only show if enableInterventionUI is true
    if (newFrustrationLevel === 'high' && enableDifficultyAutoStepDown) {
      const fromLevel = currentDifficultyRef.current;
      newDifficulty = controller.handleFrustration(currentDifficultyRef.current);
      if (newDifficulty !== currentDifficultyRef.current) {
        difficultyAdjusted = true;
        currentDifficultyRef.current = newDifficulty;
        trialsAtLevelRef.current = 0;
        const reason = 'Frustration detected - reducing difficulty';
        evtChange = { direction: 'down', from: fromLevel, to: newDifficulty, reason };
        onDifficultyChange?.(newDifficulty, reason, 'down');
        
        if (enableDifficultyToasts) {
          toast({
            title: "Adjusting difficulty",
            description: "Let's take it a bit easier.",
            duration: 2500,
          });
        }
      }
      
      // Trigger confidence boost intervention (UI modal) if enabled
      if (enableInterventionUI) {
        setShouldShowIntervention('confidence_boost');
        onInterventionRequired?.('confidence_boost');
      }
    } 
    // Normal difficulty adjustment based on rolling window
    else {
      // CRITICAL: Capture previous level BEFORE updating the ref
      const previousLevel = currentDifficultyRef.current;
      const adjustedLevel = controller.adjustLevel(previousLevel);

      if (adjustedLevel !== previousLevel) {
        const proposedDirection = adjustedLevel > previousLevel ? 'up' : 'down';

        // ── Cue-dependency safety gate ────────────────────────────────────
        // Block UP-escalations when the user is still leaning heavily on cues
        // and hasn't shown enough independent trials at the current level.
        // Down-escalations always proceed (safety > escalation).
        if (proposedDirection === 'up' && getCueDependencyScore) {
          const cdScore = getCueDependencyScore();
          if (
            cdScore !== null &&
            cdScore !== undefined &&
            cdScore > cueDependencyEscalationThreshold &&
            trialsAtLevelRef.current < minTrialsAtLevelForEscalation
          ) {
            const blockReason =
              `Escalation blocked: cue_dependency=${cdScore.toFixed(2)} ` +
              `> ${cueDependencyEscalationThreshold}, trials_at_level=` +
              `${trialsAtLevelRef.current} < ${minTrialsAtLevelForEscalation}. ` +
              `Holding level ${previousLevel} and fading cues first.`;

            evtBlocked = {
              reason: blockReason,
              cueDependencyScore: cdScore,
              trialsAtLevel: trialsAtLevelRef.current,
              level: previousLevel,
            };

            // Nothing changed, so do NOT fire onDifficultyChange. It used to be
            // called with direction 'down', which made games announce "Made it
            // easier" / play a level-down sound to a patient who had just done
            // well enough to earn an escalation. Games that want to react to a
            // hold subscribe to onEscalationBlocked, which is what it is for.
            onEscalationBlocked?.(evtBlocked);

            // Skip applying the escalation; do NOT reset trialsAtLevel.
          } else {
            difficultyAdjusted = true;
            newDifficulty = adjustedLevel;
            currentDifficultyRef.current = adjustedLevel;
            trialsAtLevelRef.current = 0;

            const successRate = controller.getSuccessRate();
            const reason = `Success rate ${(successRate * 100).toFixed(0)}% - increasing challenge`;
            evtChange = { direction: 'up', from: previousLevel, to: adjustedLevel, reason };
            onDifficultyChange?.(adjustedLevel, reason, 'up');

            if (enableDifficultyToasts) {
              toast({
                title: 'Great progress!',
                description: "Let's try something a bit harder.",
                duration: 2500,
              });
            }
          }
        } else {
          // Either a down-step, or no gate provided — apply normally.
          difficultyAdjusted = true;
          newDifficulty = adjustedLevel;
          currentDifficultyRef.current = adjustedLevel;
          trialsAtLevelRef.current = 0;

          const direction = proposedDirection;
          const successRate = controller.getSuccessRate();
          const reason = direction === 'up'
            ? `Success rate ${(successRate * 100).toFixed(0)}% - increasing challenge`
            : `Success rate ${(successRate * 100).toFixed(0)}% - providing support`;

          evtChange = { direction, from: previousLevel, to: adjustedLevel, reason };
          onDifficultyChange?.(adjustedLevel, reason, direction);

          if (enableDifficultyToasts) {
            toast({
              title: direction === 'up' ? 'Great progress!' : 'Adjusting difficulty',
              description: direction === 'up'
                ? "Let's try something a bit harder."
                : "Let's try a different approach.",
              duration: 2500,
            });
          }
        }
      }
    }
    
    // Evidence belongs to the level it was gathered at. The rolling window
    // measured performance at the PREVIOUS level, so once the level moves it
    // must not also decide the next move. Without this, a correct streak
    // escalated on EVERY trial after the window filled (L5 → L10 in eight
    // trials) and a step-down kept re-firing off stale trials. The contract
    // asks for sustained evidence at a level before it moves again
    // (PER_GAME_LEVELING_CONTRACT §1.2).
    if (difficultyAdjusted) {
      controller.reset();
    }

    // Sync all state from refs (single batch for React)
    setTrialCount(trialCountRef.current);
    setConsecutiveErrors(consecutiveErrorsRef.current);
    setFrustrationLevel(frustrationLevelRef.current);
    setCurrentDifficulty(currentDifficultyRef.current);
    setRecentSuccessRate(successRateRef.current);

    // Phase 4: emit a complete per-trial snapshot for live logging.
    {
      let cueDep: number | null = null;
      try {
        const v = getCueDependencyScore?.();
        cueDep = v == null ? null : v;
      } catch { /* noop */ }

      const snapshot = {
        trialIndex: trialCountRef.current - 1,
        difficulty: currentDifficultyRef.current,
        successRate: successRateRef.current,
        cueDependency: cueDep,
        trialsAtLevel: trialsAtLevelRef.current,
        correct: result.correct,
        reactionTimeMs: result.reactionTimeMs,
        frustration: frustrationLevelRef.current,
        difficultyChange: evtChange,
        escalationBlocked: evtBlocked,
      };

      // Caller-supplied subscriber (e.g. PhotoNaming/TwoClues forward to logger)
      onTrialLogged?.(snapshot);

      // Auto-wired logger — fires for every adaptive game unless autoLog=false.
      if (autoLog && user?.id) {
        try {
          autoLogTrial({
            trialIndex: snapshot.trialIndex,
            difficulty: snapshot.difficulty,
            cueDependency: snapshot.cueDependency,
            successRate: snapshot.successRate,
            correct: snapshot.correct,
            reactionTimeMs: snapshot.reactionTimeMs ?? null,
            frustration: snapshot.frustration,
            trialsAtLevel: snapshot.trialsAtLevel,
            difficultyChange: snapshot.difficultyChange ?? null,
            escalationBlocked: snapshot.escalationBlocked ?? null,
            trialMode: defaultTrialMode,
          });
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[useInGameAdaptation] autoLog failed', err);
        }
      }

      // Centralized adaptation_events emit — fires whenever the controller
      // actually moved difficulty (up, down, or frustration step-down).
      // No-op for games passing autoLog=false (PhotoNaming/TwoClues already
      // log this event themselves to avoid duplication).
      if (autoLog && evtChange && user?.id) {
        try {
          autoLogDifficultyEvent(
            evtChange.direction,
            evtChange.from,
            evtChange.to,
            successRateRef.current,
            consecutiveErrorsRef.current,
            sessionId ?? null,
            normalizeExerciseSlug(exerciseSlug),
            trialCountRef.current - 1,
          );
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[useInGameAdaptation] difficulty event log failed', err);
        }
      }

      // Dev-only level-change console log — gives an immediate, human-readable
      // signal that the adaptive controller actually moved difficulty.
      // Format: [slug] L{from} → L{to} · success {pct}% · {reason}
      if (import.meta.env.DEV && evtChange) {
        const arrow = evtChange.direction === 'up' ? '↑' : '↓';
        // eslint-disable-next-line no-console
        console.log(
          `%c[adapt] ${normalizeExerciseSlug(exerciseSlug)} ${arrow} L${evtChange.from} → L${evtChange.to}` +
          ` · success ${(successRateRef.current * 100).toFixed(0)}%` +
          ` · trials_at_level reset` +
          ` · reason: ${evtChange.reason}`,
          evtChange.direction === 'up'
            ? 'color:#16a34a;font-weight:600'
            : 'color:#dc2626;font-weight:600',
        );
      }
      if (import.meta.env.DEV && evtBlocked) {
        // eslint-disable-next-line no-console
        console.log(
          `%c[adapt] ${normalizeExerciseSlug(exerciseSlug)} ⛔ escalation blocked at L${evtBlocked.level}` +
          ` · ${evtBlocked.reason}`,
          'color:#d97706;font-weight:600',
        );
      }
    }

    return {
      difficultyAdjusted,
      newDifficulty,
      frustrationTriggered: newFrustrationLevel !== 'none',
      consecutiveErrors: newConsecutiveErrors,
    };
  }, [
    windowSize,
    frustrationErrorThreshold,
    enableDifficultyAutoStepDown,
    enableInterventionUI,
    enableDifficultyToasts,
    onDifficultyChange,
    onFrustrationDetected,
    onInterventionRequired,
    onEscalationBlocked,
    onTrialLogged,
    getCueDependencyScore,
    cueDependencyEscalationThreshold,
    minTrialsAtLevelForEscalation,
    autoLog,
    defaultTrialMode,
    autoLogTrial,
    autoLogDifficultyEvent,
    sessionId,
    exerciseSlug,
    user?.id,
  ]);

  // ===========================================================================
  // Stall Detection: Start/stop stall timer
  // ===========================================================================
  const startStallTimer = useCallback((onStall: () => void) => {
    // Clear existing timer
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
    }
    
    stallCallbackRef.current = onStall;
    
    if (enableAutoHints) {
      stallTimerRef.current = setTimeout(() => {
        stallCallbackRef.current?.();
      }, stallThresholdMs);
    }
  }, [stallThresholdMs, enableAutoHints]);
  
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    stallCallbackRef.current = null;
  }, []);
  
  const resetStallTimer = useCallback(() => {
    if (stallCallbackRef.current && enableAutoHints) {
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => {
        stallCallbackRef.current?.();
      }, stallThresholdMs);
    }
  }, [stallThresholdMs, enableAutoHints, clearStallTimer]);

  // ===========================================================================
  // Intervention Management
  // ===========================================================================
  const acknowledgeIntervention = useCallback(() => {
    setShouldShowIntervention(null);
  }, []);
  
  const requestBreak = useCallback(() => {
    if (enableInterventionUI) {
      setShouldShowIntervention('break_prompt');
      onInterventionRequired?.('break_prompt');
    }
  }, [enableInterventionUI, onInterventionRequired]);

  // ===========================================================================
  // Manual difficulty controls (for external use)
  // ===========================================================================
  /**
   * Manual ease. `steps` defaults to 2 to match the emergency response, but a
   * patient tapping "this is too hard" is asking for the next thing down, not
   * for the four-errors-in-a-row emergency, so callers acting on a direct
   * request should pass 1.
   */
  const stepDown = useCallback((reason: string = 'Manual difficulty reduction', steps: number = 2): number => {
    const floor = controllerRef.current.getBounds().floor;
    const newLevel = Math.max(floor, currentDifficultyRef.current - Math.max(1, Math.round(steps)));
    currentDifficultyRef.current = newLevel;
    trialsAtLevelRef.current = 0;
    // Same reason the rolling window is cleared after an automatic change: the
    // trials in it were gathered at the level we just left, and leaving them
    // would let the next answer re-trigger a step-down off stale evidence.
    controllerRef.current.reset();
    // An explicit choice outranks a clinical floor that resolves later.
    setSeededDifficulty(newLevel);
    setCurrentDifficulty(newLevel);
    onDifficultyChange?.(newLevel, reason, 'down');
    
    if (enableDifficultyToasts) {
      toast({
        title: "Adjusting difficulty",
        description: "Let's try something easier.",
        duration: 2500,
      });
    }
    
    return newLevel;
  }, [onDifficultyChange, enableDifficultyToasts]);
  
  const setBoundsExternal = useCallback((newBounds: DifficultyBounds) => {
    controllerRef.current.setBounds(newBounds);
  }, []);

  // ===========================================================================
  // Session Reset
  // ===========================================================================
  const reset = useCallback((newInitialDifficulty?: number) => {
    const startDifficulty = newInitialDifficulty ?? initialDifficulty;
    
    // Reset controller
    controllerRef.current.reset();
    
    // Reset all refs
    currentDifficultyRef.current = startDifficulty;
    consecutiveErrorsRef.current = 0;
    frustrationLevelRef.current = 'none';
    trialCountRef.current = 0;
    successRateRef.current = 0;
    trialsAtLevelRef.current = 0;
    reactionTimesRef.current = [];
    
    // Sync state
    setSeededDifficulty(startDifficulty);
    setCurrentDifficulty(startDifficulty);
    setConsecutiveErrors(0);
    setFrustrationLevel('none');
    setShouldShowIntervention(null);
    setTrialCount(0);
    setRecentSuccessRate(0);
    
    clearStallTimer();
  }, [initialDifficulty, clearStallTimer]);

  // ===========================================================================
  // Computed State
  // ===========================================================================
  const getState = useCallback((): InGameAdaptationState => {
    return {
      currentDifficulty: currentDifficultyRef.current,
      frustrationLevel: frustrationLevelRef.current,
      recentSuccessRate: successRateRef.current,
      consecutiveErrors: consecutiveErrorsRef.current,
      trialCount: trialCountRef.current,
      recommendedCueType: computeRecommendedCue(consecutiveErrorsRef.current, frustrationLevelRef.current),
      shouldShowIntervention,
      shouldSimplifyTask: frustrationLevelRef.current === 'medium' || frustrationLevelRef.current === 'high',
    };
  }, [shouldShowIntervention]);
  
  // Get cue level based on recent errors (delegate to controller)
  const getCueLevel = useCallback((recentErrorCount: number): number => {
    return controllerRef.current.getCueLevel(recentErrorCount);
  }, []);

  // Check for fatigue via reaction time trend
  const checkFatigue = useCallback((): boolean => {
    const rts = reactionTimesRef.current;
    if (rts.length < 6) return false;
    
    // Compare first half avg to second half avg
    const firstHalf = rts.slice(0, Math.floor(rts.length / 2));
    const secondHalf = rts.slice(Math.floor(rts.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    // If reaction time increased by 30%+, user may be fatiguing
    return avgSecond > avgFirst * 1.3;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStallTimer();
      clearAdaptiveLevel(sessionId, exerciseSlug);
    };
  }, [clearStallTimer, sessionId, exerciseSlug]);

  // Universal 1–10 GameLevel — derived from currentDifficulty + the
  // game's registered levelScale. Source of truth for patient/clinician UI
  // and analytics; internal `currentDifficulty` remains the per-game tier.
  const currentLevel = tierToLevel(currentDifficulty, levelScale);
  const levelDescriptor: LevelDescriptor = describeLevel(currentLevel);

  // Publish to the registry so useExerciseTelemetry can auto-inject game_level
  // without each page hand-threading it. Re-publishes whenever the level
  // moves; cleared in the unmount effect above.
  useEffect(() => {
    publishAdaptiveLevel({
      sessionId,
      exerciseSlug,
      gameLevel: currentLevel,
      internalDifficulty: currentDifficulty,
      source: 'in_game_adaptation',
    });
  }, [sessionId, exerciseSlug, currentLevel, currentDifficulty]);


  return {
    // State (synced from refs for React re-renders)
    currentDifficulty,
    /** Canonical 1–10 game level for UI + telemetry. */
    currentLevel,
    /** Patient-facing label, band, and levers for the current level. */
    levelDescriptor,
    /** Game's tier scale (echoed back for callers that need it). */
    levelScale,
    frustrationLevel,
    consecutiveErrors,
    trialCount,
    recentSuccessRate,
    shouldShowIntervention,
    /** Trials accumulated at the current difficulty level. Resets on any change. */
    trialsAtLevel: trialsAtLevelRef.current,
    
    // Computed (derived from refs for consistency)
    shouldSimplifyTask: frustrationLevel === 'medium' || frustrationLevel === 'high',
    recommendedCueType: computeRecommendedCue(consecutiveErrors, frustrationLevel),
    
    // Core methods
    recordTrial,
    getCueLevel,
    checkFatigue,
    getState,
    reset,
    
    // Stall detection
    startStallTimer,
    clearStallTimer,
    resetStallTimer,
    
    // Manual controls
    stepDown,
    setBounds: setBoundsExternal,
    acknowledgeIntervention,
    requestBreak,
    
    // Controller access for advanced use
    controller: controllerRef.current,

    /**
     * Force-flush the auto-wired adaptation_trial_logs buffer. Call this
     * before unmounting/navigating on game completion so the final trial
     * (and anything still in the FLUSH_INTERVAL buffer) lands in the table.
     * No-op when autoLog is false (the parent owns its own logger).
     */
    flushAutoLog,
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

function computeFrustrationLevel(
  consecutiveErrors: number,
  successRate: number,
  frustrationThreshold: number
): FrustrationLevel {
  // High: 4+ consecutive errors OR very low success rate
  if (consecutiveErrors >= frustrationThreshold + 1 || successRate < 0.5) {
    return 'high';
  }
  
  // Medium: 3 consecutive errors OR low success rate
  if (consecutiveErrors >= frustrationThreshold || successRate < 0.6) {
    return 'medium';
  }
  
  // Low: 2 consecutive errors
  if (consecutiveErrors >= 2) {
    return 'low';
  }
  
  return 'none';
}

function computeRecommendedCue(
  consecutiveErrors: number,
  frustrationLevel: FrustrationLevel
): 'semantic' | 'phonemic' | 'full_word' | null {
  // No cue needed if performing well
  if (consecutiveErrors < 2) return null;
  
  // Escalate cue type based on frustration
  switch (frustrationLevel) {
    case 'high':
      return 'full_word';
    case 'medium':
      return 'phonemic';
    case 'low':
      return 'semantic';
    default:
      return consecutiveErrors >= 2 ? 'semantic' : null;
  }
}
