import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, TrendingDown, Zap, Award, XCircle, Star, Eye } from 'lucide-react';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { useGameSounds } from '@/hooks/useGameSounds';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import { placeReachTapTarget } from '@/lib/reachTap/placeReachTapTarget';

interface ReachTapGameProps {
  totalTrials: number;
  initialDifficulty: number;
  variant?: 'standard' | 'left-side-hunt'; // New: support neglect variant
  slowMode?: boolean; // Gentle mode: longer timers, no penalties
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    difficultyLevel: number;
    targetSize: number;
    targetSide?: 'left' | 'center' | 'right'; // Track which side target appeared
  }) => void;
  onGameComplete: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
  userId?: string;
  sessionId?: string | null;
}

interface TargetPosition {
  x: number;
  y: number;
  size: number;
  appearTime: number;
  side: 'left' | 'center' | 'right'; // Track side for analytics
}

export const ReachTapGame = ({
  totalTrials,
  initialDifficulty,
  variant = 'standard',
  slowMode = true, // Default ON for stroke survivors
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: ReachTapGameProps) => {
  const [currentTrial, setCurrentTrial] = useState(1);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState<TargetPosition | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'miss'>('success');
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  const trialLockedRef = useRef(false);
  const feedbackTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const schedule = (action: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      feedbackTimersRef.current.delete(timer);
      action();
    }, delayMs);
    feedbackTimersRef.current.add(timer);
  };
  useEffect(() => () => {
    for (const timer of feedbackTimersRef.current) clearTimeout(timer);
    feedbackTimersRef.current.clear();
  }, []);
  const completedTrials = Math.max(0, Math.min(
    totalTrials,
    currentTrial - 1 + (showFeedback ? 1 : 0),
  ));
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { playSuccess, playTimeout, playLevelUp, playLevelDown, playStreak } = useGameSounds();
  const engagement = useEngagementMonitor(sessionId || null);
  
  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty: initialDifficulty || 5,
    bounds: { floor: 1, ceiling: 10, suggestedStart: 5 },
    windowSize: 4,
    targetSuccessRate: 0.75,
    adjustmentThreshold: 0.15,
    onDifficultyChange: (newLevel) => {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      
      schedule(() => {
        if (direction === 'up') {
          playLevelUp();
        } else {
          playLevelDown();
        }
      }, 300);
      
      const reason = direction === 'up' 
        ? `Great accuracy! Moving to level ${newLevel}`
        : `Adjusting to level ${newLevel} for better experience`;
      
      onDifficultyChange?.(newLevel, reason);
      schedule(() => setDifficultyChanged(null), 2000);
    },
    userId,
    sessionId,
    exerciseSlug: 'reach-tap',
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
  });

  // Calculate target size in pixels based on difficulty
  const getTargetSize = (difficulty: number, containerWidth: number): number => {
    // Difficulty 1 = large & easy, difficulty 10 = tiny & challenging
    if (slowMode) {
      // Slow mode: 130px (easy) down to 36px (hard)
      const maxPx = 130;
      const minPx = 36;
      return Math.round(maxPx - ((difficulty - 1) / 9) * (maxPx - minPx));
    } else {
      // Normal mode: 100px (easy) down to 24px (hard)
      const maxPx = 100;
      const minPx = 24;
      return Math.round(maxPx - ((difficulty - 1) / 9) * (maxPx - minPx));
    }
  };

  // Calculate timeout based on difficulty
  const getTimeout = (difficulty: number): number => {
    if (slowMode) {
      // Slow mode: 8000ms (easy) -> 4000ms (hard) - way more forgiving
      return Math.max(4000, 8000 - (difficulty * 400));
    } else {
      // Normal mode: 3000ms (easy) -> 1000ms (hard)
      return Math.max(1000, 3000 - (difficulty * 200));
    }
  };

  // Track previous position to ensure targets jump around
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  // Use physical bounds and the target's actual center for position labels.
  // In Left-Side Hunt the previous formula allowed negative X on phones
  // whenever a wide easy target exceeded one third of the play area.
  const generateTarget = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const positioned = placeReachTapTarget({
      width: rect.width,
      height: rect.height,
      desiredSize: getTargetSize(currentDifficulty, rect.width),
      variant,
      previous: lastPositionRef.current,
    });
    if (!positioned) return;
    trialLockedRef.current = false;
    lastPositionRef.current = { x: positioned.x, y: positioned.y };
    setTarget({ ...positioned, appearTime: Date.now() });
  };

  // Start new trial
  useEffect(() => {
    if (currentTrial <= totalTrials && !showFeedback && !target) {
      const delay = currentTrial === 1 ? 500 : 1000;
      const timer = setTimeout(() => {
        generateTarget();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [currentTrial, showFeedback, target, totalTrials]);

  // Auto-timeout if target not hit (only in normal mode)
  useEffect(() => {
    if (!target || showFeedback) return;
    
    // In slow mode, no timeout penalty - let them take their time
    if (slowMode) return;

    const timeout = getTimeout(currentDifficulty);
    const timer = setTimeout(() => {
      handleMiss();
    }, timeout);

    return () => clearTimeout(timer);
  }, [target, showFeedback, currentDifficulty, slowMode]);

  const handleTargetHit = () => {
    if (!target || showFeedback || trialLockedRef.current) return;
    trialLockedRef.current = true;

    const reactionTime = Date.now() - target.appearTime;
    setFeedbackType('success');
    setShowFeedback(true);
    
    const newConsecutiveHits = consecutiveHits + 1;
    setConsecutiveHits(newConsecutiveHits);
    setConsecutiveMisses(0);

    // Play success sound
    playSuccess();
    
    // Play streak sound for 3+ consecutive hits
    if (newConsecutiveHits >= 3 && newConsecutiveHits % 3 === 0) {
      schedule(() => playStreak(), 200);
    }

    // Update score
    const points = Math.max(50, 200 - Math.floor(reactionTime / 10));
    setScore((prev) => prev + points);

    // Update adaptive difficulty tracking and check for adjustment
    updateTrial(true, reactionTime);
    engagement.recordTrial({ correct: true, reactionTimeMs: reactionTime, timeout: false, cueLevel: 0, timestamp: Date.now() });
    checkAndAdjust();

    // Log telemetry (Note: ReachTap adaptations handled by parent component)
    onTrialComplete({
      correct: true,
      reactionTimeMs: reactionTime,
      difficultyLevel: currentDifficulty,
      targetSize: target.size,
      targetSide: target.side,
    });

    // Move to next trial
    schedule(() => {
      setShowFeedback(false);
      setTarget(null);
      
      if (currentTrial >= totalTrials) {
        // Move beyond the playable range before leaving the screen.
        // Otherwise the effect respawns a new target after the last trial.
        setCurrentTrial(totalTrials + 1);
        onGameComplete(score + points);
      } else {
        setCurrentTrial((prev) => prev + 1);
      }
    }, 800);
  };

  const handleMiss = () => {
    if (showFeedback || !target || trialLockedRef.current) return;
    trialLockedRef.current = true;

    setFeedbackType('miss');
    setShowFeedback(true);
    setConsecutiveMisses((prev) => prev + 1);
    setConsecutiveHits(0);

    // Play timeout sound
    playTimeout();

    const reactionTime = target ? Date.now() - target.appearTime : 0;

    // Update adaptive difficulty tracking and check for adjustment
    updateTrial(false, reactionTime);
    engagement.recordTrial({ correct: false, reactionTimeMs: reactionTime, timeout: true, cueLevel: 0, timestamp: Date.now() });
    checkAndAdjust();

    // Log telemetry
    onTrialComplete({
      correct: false,
      reactionTimeMs: reactionTime,
      difficultyLevel: currentDifficulty,
      targetSize: target?.size || 0,
      targetSide: target?.side,
    });

    // Move to next trial
    schedule(() => {
      setShowFeedback(false);
      setTarget(null);
      
      if (currentTrial >= totalTrials) {
        setCurrentTrial(totalTrials + 1);
        onGameComplete(score);
      } else {
        setCurrentTrial((prev) => prev + 1);
      }
    }, 800);
  };

  return (
    <div className="w-full space-y-2 flex flex-col min-h-0 max-h-full overflow-hidden">
      {/* Progress */}
      <div className="space-y-2 flex-shrink-0">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {currentTrial > totalTrials ? 'Practice complete' : `Trial ${currentTrial} of ${totalTrials}`}
          </span>
          <span className="font-medium text-primary">
            Score: {score}
          </span>
        </div>
        <Progress
          aria-label="Completed Reach and Tap trials"
          value={totalTrials > 0 ? (completedTrials / totalTrials) * 100 : 0}
          className="h-2"
        />
      </div>

      {/* Difficulty indicator */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          {difficultyChanged && (
            <div className={`
              px-2 py-1 rounded-full text-xs font-medium animate-slide-up
              ${difficultyChanged === 'up' ? 'bg-success text-white' : 'bg-warning text-white'}
            `}>
              {difficultyChanged === 'up' ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Leveling up!
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Adjusting
                </span>
              )}
            </div>
          )}
          <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
            Level {currentDifficulty}
          </div>
        </div>
        
        {consecutiveHits >= 3 && (
          <div className="flex items-center gap-1 text-success text-sm font-medium animate-pulse">
            <Zap className="w-4 h-4" />
            {consecutiveHits} streak!
          </div>
        )}
      </div>

      {/* Game Area */}
      <div 
        ref={containerRef}
        className={`relative w-full min-h-[280px] sm:min-h-[340px] flex-1 rounded-xl border-4 shadow-glow overflow-hidden ${
          variant === 'left-side-hunt' 
            ? 'bg-gradient-to-r from-amber-100/30 via-muted to-muted dark:from-amber-900/20 border-amber-500' 
            : 'bg-muted border-primary'
        }`}
        onClick={(e) => {
          // If clicking outside target, count as miss
          if (target && !showFeedback) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              
              const isInsideTarget = 
                x >= target.x && 
                x <= target.x + target.size &&
                y >= target.y && 
                y <= target.y + target.size;
              
              if (!isInsideTarget) {
                handleMiss();
              }
            }
          }
        }}
      >
        {/* Left-side hunt zone indicator */}
        {variant === 'left-side-hunt' && (
          <div className="absolute left-0 top-0 bottom-0 w-1/3 border-r-2 border-dashed border-amber-400/40 pointer-events-none">
            <div className="absolute top-2 left-2 flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium bg-amber-100/80 dark:bg-amber-900/50 px-2 py-1 rounded">
              <Eye className="w-3 h-3" />
              Look here!
            </div>
          </div>
        )}

        {/* Instructions when no target */}
        {!target && !showFeedback && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              {variant === 'left-side-hunt' ? (
                <>
                  <Eye className="w-16 h-16 mx-auto text-amber-500 animate-pulse" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Watch the left side...
                  </p>
                </>
              ) : (
                <>
                  <Target className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Get ready...
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Target - different appearance for left-side-hunt */}
        {target && !showFeedback && (
          <button
            aria-label={variant === 'left-side-hunt' ? 'Tap the star target' : 'Tap the target'}
            className={`absolute transition-all animate-scale-in cursor-pointer ${
              variant === 'left-side-hunt'
                ? 'bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 border-4 border-amber-200 shadow-lg shadow-amber-500/30'
                : 'rounded-full bg-primary hover:bg-primary/90 border-4 border-white shadow-glow'
            }`}
            style={{
              left: `${target.x}px`,
              top: `${target.y}px`,
              width: `${target.size}px`,
              height: `${target.size}px`,
              borderRadius: variant === 'left-side-hunt' ? '20%' : '50%',
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTargetHit();
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              {variant === 'left-side-hunt' ? (
                <Star className="w-1/2 h-1/2 text-white fill-white" />
              ) : (
                <div className="w-1/3 h-1/3 bg-white rounded-full" />
              )}
            </div>
          </button>
        )}

        {/* Feedback */}
        {showFeedback && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`
              text-center space-y-2 p-6 rounded-lg animate-scale-in
              ${feedbackType === 'success' 
                ? variant === 'left-side-hunt' ? 'bg-amber-500/20' : 'bg-success/20' 
                : 'bg-destructive/20'}
            `}>
              {feedbackType === 'success' ? (
                <>
                  {variant === 'left-side-hunt' ? (
                    <Eye className="w-16 h-16 mx-auto text-amber-500" />
                  ) : (
                    <Award className="w-16 h-16 mx-auto text-success" />
                  )}
                  <p className={`text-2xl font-bold ${variant === 'left-side-hunt' ? 'text-amber-600 dark:text-amber-400' : 'text-success'}`}>
                    {variant === 'left-side-hunt' ? 'Great awareness!' : 'Great hit!'}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto text-muted-foreground" />
                  <p className="text-2xl font-bold text-muted-foreground">
                    {slowMode ? 'Take your time' : 'Too slow!'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center space-y-1 flex-shrink-0 pb-1">
        <h3 className="text-lg font-semibold">
          {variant === 'left-side-hunt' 
            ? '👀 Hunt for stars on the left side!' 
            : 'Tap the targets as they appear!'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {variant === 'left-side-hunt' 
            ? '🔍 Scan carefully - targets love to hide on the left!'
            : slowMode 
              ? '🕒 Gentle Mode: Take your time - no rush!' 
              : 'React quickly - targets disappear after a few seconds'}
        </p>
      </div>
    </div>
  );
};
