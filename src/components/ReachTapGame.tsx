import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, TrendingDown, Zap, Award, XCircle } from 'lucide-react';
import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { useGameSounds } from '@/hooks/useGameSounds';

interface ReachTapGameProps {
  totalTrials: number;
  initialDifficulty: number;
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    difficultyLevel: number;
    targetSize: number;
  }) => void;
  onGameComplete: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
}

interface TargetPosition {
  x: number;
  y: number;
  size: number;
  appearTime: number;
}

export const ReachTapGame = ({
  totalTrials,
  initialDifficulty,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
}: ReachTapGameProps) => {
  const [currentTrial, setCurrentTrial] = useState(1);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState<TargetPosition | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'miss'>('success');
  const [currentDifficulty, setCurrentDifficulty] = useState(initialDifficulty);
  const [difficultyChanged, setDifficultyChanged] = useState<'up' | 'down' | null>(null);
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef(new AdaptiveDifficultyController());
  const { playSuccess, playTimeout, playLevelUp, playLevelDown, playStreak } = useGameSounds();

  // Calculate target size based on difficulty (level 1-10)
  const getTargetSize = (difficulty: number): number => {
    // Size ranges from 100px (easy) to 40px (hard)
    return Math.max(40, 100 - (difficulty * 6));
  };

  // Calculate timeout based on difficulty
  const getTimeout = (difficulty: number): number => {
    // Timeout ranges from 3000ms (easy) to 1000ms (hard)
    return Math.max(1000, 3000 - (difficulty * 200));
  };

  // Generate random target position
  const generateTarget = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const size = getTargetSize(currentDifficulty);
    
    // Ensure target stays within bounds with padding
    const padding = 20;
    const maxX = containerRect.width - size - padding;
    const maxY = containerRect.height - size - padding;
    
    const x = Math.random() * maxX + padding;
    const y = Math.random() * maxY + padding;

    setTarget({
      x,
      y,
      size,
      appearTime: Date.now(),
    });
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

  // Auto-timeout if target not hit
  useEffect(() => {
    if (!target || showFeedback) return;

    const timeout = getTimeout(currentDifficulty);
    const timer = setTimeout(() => {
      handleMiss();
    }, timeout);

    return () => clearTimeout(timer);
  }, [target, showFeedback, currentDifficulty]);

  const handleTargetHit = () => {
    if (!target || showFeedback) return;

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
      setTimeout(() => playStreak(), 200);
    }

    // Update score
    const points = Math.max(50, 200 - Math.floor(reactionTime / 10));
    setScore((prev) => prev + points);

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(true);
    
    // Check if difficulty should adjust
    const newLevel = controller.adjustLevel(currentDifficulty);
    if (newLevel !== currentDifficulty) {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      setCurrentDifficulty(newLevel);
      
      // Play level change sound
      setTimeout(() => {
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
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

    // Log telemetry
    onTrialComplete({
      correct: true,
      reactionTimeMs: reactionTime,
      difficultyLevel: currentDifficulty,
      targetSize: target.size,
    });

    // Move to next trial
    setTimeout(() => {
      setShowFeedback(false);
      setTarget(null);
      
      if (currentTrial >= totalTrials) {
        onGameComplete(score + points);
      } else {
        setCurrentTrial((prev) => prev + 1);
      }
    }, 800);
  };

  const handleMiss = () => {
    if (showFeedback) return;

    setFeedbackType('miss');
    setShowFeedback(true);
    setConsecutiveMisses((prev) => prev + 1);
    setConsecutiveHits(0);

    // Play timeout sound
    playTimeout();

    const reactionTime = target ? Date.now() - target.appearTime : 0;

    // Update adaptive controller
    const controller = controllerRef.current;
    controller.update(false);
    
    // Check if difficulty should adjust
    const newLevel = controller.adjustLevel(currentDifficulty);
    if (newLevel !== currentDifficulty) {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      setDifficultyChanged(direction);
      setCurrentDifficulty(newLevel);
      
      // Play level change sound
      setTimeout(() => {
        if (direction === 'up') {
          playLevelUp();
        } else {
          playLevelDown();
        }
      }, 300);
      
      const reason = direction === 'up' 
        ? `Great progress! Moving to level ${newLevel}`
        : `Adjusting to level ${newLevel} for better experience`;
      
      onDifficultyChange?.(newLevel, reason);
      setTimeout(() => setDifficultyChanged(null), 2000);
    }

    // Log telemetry
    onTrialComplete({
      correct: false,
      reactionTimeMs: reactionTime,
      difficultyLevel: currentDifficulty,
      targetSize: target?.size || 0,
    });

    // Move to next trial
    setTimeout(() => {
      setShowFeedback(false);
      setTarget(null);
      
      if (currentTrial >= totalTrials) {
        onGameComplete(score);
      } else {
        setCurrentTrial((prev) => prev + 1);
      }
    }, 800);
  };

  return (
    <div className="w-full space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Trial {currentTrial} of {totalTrials}
          </span>
          <span className="font-medium text-primary">
            Score: {score}
          </span>
        </div>
        <Progress
          value={(currentTrial / totalTrials) * 100}
          className="h-2"
        />
      </div>

      {/* Difficulty indicator */}
      <div className="flex justify-between items-center">
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
        className="relative w-full aspect-[4/3] bg-muted rounded-xl border-4 border-primary shadow-glow overflow-hidden"
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
        {/* Instructions when no target */}
        {!target && !showFeedback && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Target className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
              <p className="text-lg font-medium text-muted-foreground">
                Get ready...
              </p>
            </div>
          </div>
        )}

        {/* Target */}
        {target && !showFeedback && (
          <button
            className="absolute rounded-full bg-primary hover:bg-primary/90 transition-all shadow-glow animate-scale-in cursor-pointer border-4 border-white"
            style={{
              left: `${target.x}px`,
              top: `${target.y}px`,
              width: `${target.size}px`,
              height: `${target.size}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTargetHit();
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-1/3 h-1/3 bg-white rounded-full" />
            </div>
          </button>
        )}

        {/* Feedback */}
        {showFeedback && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`
              text-center space-y-2 p-6 rounded-lg animate-scale-in
              ${feedbackType === 'success' ? 'bg-success/20' : 'bg-destructive/20'}
            `}>
              {feedbackType === 'success' ? (
                <>
                  <Award className="w-16 h-16 mx-auto text-success" />
                  <p className="text-2xl font-bold text-success">
                    Great hit!
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto text-destructive" />
                  <p className="text-2xl font-bold text-destructive">
                    Too slow!
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Tap the targets as they appear!</h3>
        <p className="text-sm text-muted-foreground">
          React quickly - targets disappear after a few seconds
        </p>
      </div>
    </div>
  );
};
