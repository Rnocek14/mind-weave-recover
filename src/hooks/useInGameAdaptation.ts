import { useState, useRef, useCallback, useEffect } from 'react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { toast } from '@/hooks/use-toast';

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
  windowSize?: number;                  // Default: 5 (rolling window for success rate)
  targetSuccessRate?: number;           // Default: 0.80 (research: 75-85% sweet spot)
  adjustmentThreshold?: number;         // Default: 0.10 (70-90% flow zone)
  
  // Frustration detection thresholds
  frustrationErrorThreshold?: number;   // Default: 3 consecutive errors
  stallThresholdMs?: number;            // Default: 7000ms (was 3000 - too aggressive)
  
  // Feature flags
  enableAutoHints?: boolean;            // Default: true
  enableDifficultyToasts?: boolean;     // Default: true
  enableInterventions?: boolean;        // Default: false (opt-in)
  
  // Callbacks
  onDifficultyChange?: (level: number, reason: string, direction: 'up' | 'down') => void;
  onFrustrationDetected?: (level: FrustrationLevel) => void;
  onInterventionRequired?: (type: InterventionType) => void;
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

export const useInGameAdaptation = (options: InGameAdaptationOptions) => {
  const {
    exerciseSlug,
    sessionId,
    initialDifficulty,
    bounds,
    
    // Thresholds with research-aligned defaults
    windowSize = 5,
    targetSuccessRate = 0.80,
    adjustmentThreshold = 0.10,
    frustrationErrorThreshold = 3,
    stallThresholdMs = 7000,
    
    // Feature flags
    enableAutoHints = true,
    enableDifficultyToasts = true,
    enableInterventions = false,
    
    // Callbacks
    onDifficultyChange,
    onFrustrationDetected,
    onInterventionRequired,
  } = options;

  // Core state
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [frustrationLevel, setFrustrationLevel] = useState<FrustrationLevel>('none');
  const [shouldShowIntervention, setShouldShowIntervention] = useState<InterventionType | null>(null);
  const [trialCount, setTrialCount] = useState(0);
  
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

  // =========================================================================
  // Core API: Record a trial result
  // =========================================================================
  const recordTrial = useCallback((result: TrialResult): { 
    difficultyAdjusted: boolean; 
    newDifficulty: number;
    frustrationTriggered: boolean;
  } => {
    const controller = controllerRef.current;
    setTrialCount(prev => prev + 1);
    
    // Track reaction time for fatigue detection
    if (result.reactionTimeMs) {
      reactionTimesRef.current.push(result.reactionTimeMs);
      if (reactionTimesRef.current.length > 10) {
        reactionTimesRef.current.shift();
      }
    }
    
    // Update controller's rolling window
    controller.update(result.correct);
    
    // Track consecutive errors
    let newConsecutiveErrors = consecutiveErrors;
    if (result.correct) {
      newConsecutiveErrors = 0;
      setConsecutiveErrors(0);
    } else {
      newConsecutiveErrors = consecutiveErrors + 1;
      setConsecutiveErrors(newConsecutiveErrors);
    }
    
    // Compute frustration level
    const newFrustrationLevel = computeFrustrationLevel(
      newConsecutiveErrors,
      controller.getSuccessRate(),
      frustrationErrorThreshold
    );
    
    if (newFrustrationLevel !== frustrationLevel) {
      setFrustrationLevel(newFrustrationLevel);
      onFrustrationDetected?.(newFrustrationLevel);
    }
    
    // Check if difficulty should adjust
    let difficultyAdjusted = false;
    let newDifficulty = currentDifficulty;
    
    // Handle high frustration with emergency step-down
    if (newFrustrationLevel === 'high' && enableInterventions) {
      newDifficulty = controller.handleFrustration(currentDifficulty);
      if (newDifficulty !== currentDifficulty) {
        difficultyAdjusted = true;
        setCurrentDifficulty(newDifficulty);
        onDifficultyChange?.(newDifficulty, 'Frustration detected - reducing difficulty', 'down');
        
        if (enableDifficultyToasts) {
          toast({
            title: "Adjusting difficulty",
            description: "Let's take it a bit easier.",
            duration: 2500,
          });
        }
      }
      
      // Trigger confidence boost intervention
      setShouldShowIntervention('confidence_boost');
      onInterventionRequired?.('confidence_boost');
    } 
    // Normal difficulty adjustment based on rolling window
    else {
      const adjustedLevel = controller.adjustLevel(currentDifficulty);
      if (adjustedLevel !== currentDifficulty) {
        difficultyAdjusted = true;
        newDifficulty = adjustedLevel;
        setCurrentDifficulty(adjustedLevel);
        
        const direction = adjustedLevel > currentDifficulty ? 'up' : 'down';
        const successRate = controller.getSuccessRate();
        const reason = direction === 'up' 
          ? `Success rate ${(successRate * 100).toFixed(0)}% - increasing challenge`
          : `Success rate ${(successRate * 100).toFixed(0)}% - providing support`;
        
        onDifficultyChange?.(adjustedLevel, reason, direction);
        
        if (enableDifficultyToasts) {
          toast({
            title: direction === 'up' ? "Great progress!" : "Adjusting difficulty",
            description: direction === 'up' 
              ? "Let's try something a bit harder."
              : "Let's try a different approach.",
            duration: 2500,
          });
        }
      }
    }
    
    return {
      difficultyAdjusted,
      newDifficulty,
      frustrationTriggered: newFrustrationLevel !== 'none',
    };
  }, [
    currentDifficulty, 
    consecutiveErrors, 
    frustrationLevel, 
    frustrationErrorThreshold,
    enableInterventions,
    enableDifficultyToasts,
    onDifficultyChange, 
    onFrustrationDetected,
    onInterventionRequired
  ]);

  // =========================================================================
  // Stall Detection: Start/stop stall timer
  // =========================================================================
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

  // =========================================================================
  // Intervention Management
  // =========================================================================
  const acknowledgeIntervention = useCallback(() => {
    setShouldShowIntervention(null);
  }, []);
  
  const requestBreak = useCallback(() => {
    if (enableInterventions) {
      setShouldShowIntervention('break_prompt');
      onInterventionRequired?.('break_prompt');
    }
  }, [enableInterventions, onInterventionRequired]);

  // =========================================================================
  // Manual difficulty controls (for external use)
  // =========================================================================
  const stepDown = useCallback((reason: string = 'Manual difficulty reduction'): number => {
    const newLevel = controllerRef.current.handleFrustration(currentDifficulty);
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
  }, [currentDifficulty, onDifficultyChange, enableDifficultyToasts]);
  
  const setBoundsExternal = useCallback((newBounds: DifficultyBounds) => {
    controllerRef.current.setBounds(newBounds);
  }, []);

  // =========================================================================
  // Session Reset
  // =========================================================================
  const reset = useCallback((newInitialDifficulty?: number) => {
    controllerRef.current.reset();
    setCurrentDifficulty(newInitialDifficulty ?? initialDifficulty);
    setConsecutiveErrors(0);
    setFrustrationLevel('none');
    setShouldShowIntervention(null);
    setTrialCount(0);
    reactionTimesRef.current = [];
    clearStallTimer();
  }, [initialDifficulty, clearStallTimer]);

  // =========================================================================
  // Computed State
  // =========================================================================
  const getState = useCallback((): InGameAdaptationState => {
    const controller = controllerRef.current;
    return {
      currentDifficulty,
      frustrationLevel,
      recentSuccessRate: controller.getSuccessRate(),
      consecutiveErrors,
      trialCount,
      recommendedCueType: computeRecommendedCue(consecutiveErrors, frustrationLevel),
      shouldShowIntervention,
      shouldSimplifyTask: frustrationLevel === 'medium' || frustrationLevel === 'high',
    };
  }, [currentDifficulty, frustrationLevel, consecutiveErrors, trialCount, shouldShowIntervention]);
  
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
    };
  }, [clearStallTimer]);

  return {
    // State
    currentDifficulty,
    frustrationLevel,
    consecutiveErrors,
    trialCount,
    shouldShowIntervention,
    
    // Computed
    shouldSimplifyTask: frustrationLevel === 'medium' || frustrationLevel === 'high',
    recommendedCueType: computeRecommendedCue(consecutiveErrors, frustrationLevel),
    recentSuccessRate: controllerRef.current.getSuccessRate(),
    
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
