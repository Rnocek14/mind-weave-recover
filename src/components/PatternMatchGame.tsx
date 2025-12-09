import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Check, X, Star, Award } from 'lucide-react';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useGameSounds } from '@/hooks/useGameSounds';
import type { DifficultyBounds } from '@/lib/difficultyBounds';

interface PatternMatchGameProps {
  totalTrials: number;
  initialDifficulty?: number;
  bounds?: DifficultyBounds;
  slowMode?: boolean;
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    difficultyLevel: number;
    patternSize: number;
  }) => void;
  onGameComplete: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
}

type ShapeType = 'circle' | 'square' | 'triangle' | 'star';
type ColorType = 'red' | 'blue' | 'green' | 'yellow' | 'purple';

interface PatternItem {
  shape: ShapeType;
  color: ColorType;
}

const SHAPES: ShapeType[] = ['circle', 'square', 'triangle', 'star'];
const COLORS: ColorType[] = ['red', 'blue', 'green', 'yellow', 'purple'];

const COLOR_CLASSES: Record<ColorType, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
};

export const PatternMatchGame = ({
  totalTrials,
  initialDifficulty = 3,
  bounds = { floor: 1, ceiling: 8, suggestedStart: 3 },
  slowMode = true,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
}: PatternMatchGameProps) => {
  const [currentTrial, setCurrentTrial] = useState(1);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<'showing' | 'matching' | 'feedback'>('showing');
  const [pattern, setPattern] = useState<PatternItem[]>([]);
  const [options, setOptions] = useState<PatternItem[][]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [feedbackType, setFeedbackType] = useState<'success' | 'incorrect'>('success');
  const [trialStartTime, setTrialStartTime] = useState(0);
  const [showingProgress, setShowingProgress] = useState(100);

  const { playSuccess, playError, playLevelUp, playLevelDown, playStreak } = useGameSounds();

  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.80,
    adjustmentThreshold: 0.15,
    onDifficultyChange: (newLevel) => {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      if (direction === 'up') {
        playLevelUp();
      } else {
        playLevelDown();
      }
      const reason = direction === 'up'
        ? `Great job! Moving to level ${newLevel}`
        : `Adjusting to level ${newLevel}`;
      onDifficultyChange?.(newLevel, reason);
    },
  });

  // Calculate pattern size based on difficulty (2-5 items)
  const getPatternSize = (difficulty: number): number => {
    return Math.min(5, Math.max(2, Math.floor(difficulty / 2) + 1));
  };

  // Calculate number of options based on difficulty (2-4)
  const getOptionCount = (difficulty: number): number => {
    return Math.min(4, Math.max(2, Math.floor(difficulty / 3) + 2));
  };

  // Calculate display time in ms
  const getDisplayTime = (difficulty: number): number => {
    if (slowMode) {
      return Math.max(3000, 6000 - (difficulty * 300)); // 6s -> 3s
    }
    return Math.max(1500, 4000 - (difficulty * 250)); // 4s -> 1.5s
  };

  // Generate random pattern
  const generatePattern = useCallback((size: number): PatternItem[] => {
    return Array.from({ length: size }, () => ({
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, []);

  // Generate options with one correct and rest incorrect
  const generateOptions = useCallback((correctPattern: PatternItem[], count: number): PatternItem[][] => {
    const opts: PatternItem[][] = [correctPattern];
    
    while (opts.length < count) {
      // Create a slightly different pattern
      const wrongPattern = correctPattern.map((item, idx) => {
        // Change 1-2 items to make it different
        if (Math.random() < 0.4) {
          return {
            shape: Math.random() < 0.5 ? SHAPES[Math.floor(Math.random() * SHAPES.length)] : item.shape,
            color: Math.random() < 0.5 ? COLORS[Math.floor(Math.random() * COLORS.length)] : item.color,
          };
        }
        return { ...item };
      });
      
      // Make sure it's actually different
      const isDifferent = wrongPattern.some((item, idx) => 
        item.shape !== correctPattern[idx].shape || item.color !== correctPattern[idx].color
      );
      
      if (isDifferent) {
        opts.push(wrongPattern);
      }
    }
    
    // Shuffle and track correct index
    const shuffled = [...opts].sort(() => Math.random() - 0.5);
    const correctIdx = shuffled.findIndex(opt => 
      opt.every((item, idx) => 
        item.shape === correctPattern[idx].shape && item.color === correctPattern[idx].color
      )
    );
    
    return shuffled;
  }, []);

  // Start a new trial
  const startTrial = useCallback(() => {
    const patternSize = getPatternSize(currentDifficulty);
    const optionCount = getOptionCount(currentDifficulty);
    const newPattern = generatePattern(patternSize);
    const newOptions = generateOptions(newPattern, optionCount);
    
    // Find correct index
    const correctIdx = newOptions.findIndex(opt =>
      opt.every((item, idx) =>
        item.shape === newPattern[idx].shape && item.color === newPattern[idx].color
      )
    );
    
    setPattern(newPattern);
    setOptions(newOptions);
    setCorrectIndex(correctIdx);
    setPhase('showing');
    setShowingProgress(100);
    
    // Show pattern for display time, then switch to matching
    const displayTime = getDisplayTime(currentDifficulty);
    const progressInterval = setInterval(() => {
      setShowingProgress(prev => Math.max(0, prev - (100 / (displayTime / 100))));
    }, 100);
    
    setTimeout(() => {
      clearInterval(progressInterval);
      setPhase('matching');
      setTrialStartTime(Date.now());
    }, displayTime);
  }, [currentDifficulty, generatePattern, generateOptions, slowMode]);

  // Handle option selection
  const handleSelect = (selectedIndex: number) => {
    if (phase !== 'matching') return;
    
    const reactionTimeMs = Date.now() - trialStartTime;
    const correct = selectedIndex === correctIndex;
    
    updateTrial(correct);
    
    if (correct) {
      setScore(s => s + 1);
      playSuccess();
      setFeedbackType('success');
    } else {
      playError();
      setFeedbackType('incorrect');
    }
    
    setPhase('feedback');
    
    onTrialComplete({
      correct,
      reactionTimeMs,
      difficultyLevel: currentDifficulty,
      patternSize: pattern.length,
    });
    
    // After feedback, check difficulty and move to next trial
    setTimeout(() => {
      checkAndAdjust();
      
      if (currentTrial >= totalTrials) {
        onGameComplete(score + (correct ? 1 : 0));
      } else {
        setCurrentTrial(t => t + 1);
        startTrial();
      }
    }, 1500);
  };

  // Start first trial on mount
  useEffect(() => {
    startTrial();
  }, []);

  // Render shape component
  const renderShape = (item: PatternItem, size: number = 40) => {
    const colorClass = COLOR_CLASSES[item.color];
    
    switch (item.shape) {
      case 'circle':
        return (
          <div 
            className={`rounded-full ${colorClass}`} 
            style={{ width: size, height: size }}
          />
        );
      case 'square':
        return (
          <div 
            className={`rounded-md ${colorClass}`} 
            style={{ width: size, height: size }}
          />
        );
      case 'triangle':
        return (
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: `${size/2}px solid transparent`,
              borderRight: `${size/2}px solid transparent`,
              borderBottom: `${size}px solid`,
            }}
            className={`border-b-current ${item.color === 'red' ? 'text-red-500' : item.color === 'blue' ? 'text-blue-500' : item.color === 'green' ? 'text-green-500' : item.color === 'yellow' ? 'text-yellow-500' : 'text-purple-500'}`}
          />
        );
      case 'star':
        return (
          <Star 
            className={`${item.color === 'red' ? 'text-red-500' : item.color === 'blue' ? 'text-blue-500' : item.color === 'green' ? 'text-green-500' : item.color === 'yellow' ? 'text-yellow-500' : 'text-purple-500'}`}
            fill="currentColor"
            size={size}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Pattern Match</h2>
            <p className="text-sm text-muted-foreground">
              Remember and find the matching pattern
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{score}/{currentTrial}</div>
          <div className="text-sm text-muted-foreground">Level {currentDifficulty}</div>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={(currentTrial / totalTrials) * 100} className="h-2" />

      {/* Instructions */}
      <div className="text-center py-2">
        {phase === 'showing' && (
          <div className="space-y-2">
            <p className="text-lg font-medium text-primary animate-pulse">
              👀 Remember this pattern!
            </p>
            <Progress value={showingProgress} className="h-1 w-32 mx-auto" />
          </div>
        )}
        {phase === 'matching' && (
          <p className="text-lg font-medium">
            🎯 Find the matching pattern below
          </p>
        )}
        {phase === 'feedback' && (
          <p className={`text-lg font-medium ${feedbackType === 'success' ? 'text-green-600' : 'text-orange-600'}`}>
            {feedbackType === 'success' ? '✨ Perfect match!' : '🔄 Not quite - keep trying!'}
          </p>
        )}
      </div>

      {/* Pattern display area */}
      <div className="bg-card border rounded-xl p-6 min-h-[120px] flex items-center justify-center">
        {phase === 'showing' && (
          <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
            {pattern.map((item, idx) => (
              <div key={idx} className="p-2 bg-background rounded-lg shadow-sm">
                {renderShape(item, 50)}
              </div>
            ))}
          </div>
        )}
        {phase === 'matching' && (
          <div className="flex items-center gap-4 opacity-30">
            {pattern.map((_, idx) => (
              <div key={idx} className="w-[50px] h-[50px] border-2 border-dashed border-muted-foreground/30 rounded-lg" />
            ))}
          </div>
        )}
        {phase === 'feedback' && (
          <div className="flex items-center gap-4">
            {pattern.map((item, idx) => (
              <div key={idx} className={`p-2 rounded-lg ${feedbackType === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-background'}`}>
                {renderShape(item, 50)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Options grid */}
      {phase === 'matching' && (
        <div className={`grid gap-4 ${options.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
          {options.map((option, optIdx) => (
            <button
              key={optIdx}
              onClick={() => handleSelect(optIdx)}
              className="p-4 bg-card border-2 border-muted hover:border-primary rounded-xl transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {option.map((item, itemIdx) => (
                  <div key={itemIdx}>
                    {renderShape(item, 36)}
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Feedback overlay */}
      {phase === 'feedback' && (
        <div className="flex justify-center">
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full ${
            feedbackType === 'success' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
          }`}>
            {feedbackType === 'success' ? (
              <>
                <Check className="w-5 h-5" />
                <span className="font-medium">Excellent!</span>
              </>
            ) : (
              <>
                <X className="w-5 h-5" />
                <span className="font-medium">The correct pattern was shown above</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Game complete */}
      {currentTrial > totalTrials && (
        <div className="text-center py-8 animate-in fade-in zoom-in">
          <Award className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
          <h3 className="text-2xl font-bold mb-2">Session Complete!</h3>
          <p className="text-muted-foreground">
            You matched {score} out of {totalTrials} patterns
          </p>
        </div>
      )}
    </div>
  );
};
