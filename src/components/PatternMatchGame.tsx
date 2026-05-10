import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, X, Star, Award } from 'lucide-react';
import { useAdaptiveDifficulty } from '@/hooks/useAdaptiveDifficulty';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
  userId?: string;
  sessionId?: string | null;
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
  userId,
  sessionId,
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
  
  const isMobile = useIsMobile();
  
  const getShapeSize = (context: 'display' | 'option'): number => {
    if (context === 'display') return isMobile ? 48 : 72;
    return isMobile ? 36 : 56;
  };

  const { playSuccess, playError, playLevelUp, playLevelDown } = useGameSounds();
  const engagement = useEngagementMonitor(sessionId || null);

  const {
    currentDifficulty,
    updateTrial,
    checkAndAdjust,
  } = useAdaptiveDifficulty({
    initialDifficulty,
    bounds,
    windowSize: 4,
    targetSuccessRate: 0.80,
    adjustmentThreshold: 0.10,
    onDifficultyChange: (newLevel) => {
      const direction = newLevel > currentDifficulty ? 'up' : 'down';
      if (direction === 'up') playLevelUp(); else playLevelDown();
      onDifficultyChange?.(newLevel, direction === 'up' ? `Level ${newLevel}` : `Level ${newLevel}`);
    },
    userId,
    sessionId,
    exerciseSlug: 'pattern-match',
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
  });

  const getPatternSize = (difficulty: number): number => Math.min(5, Math.max(2, Math.floor(difficulty / 2) + 1));
  const getOptionCount = (difficulty: number): number => Math.min(4, Math.max(2, Math.floor(difficulty / 3) + 2));
  const getDisplayTime = (difficulty: number): number => {
    if (slowMode) return Math.max(3000, 6000 - (difficulty * 300));
    return Math.max(1500, 4000 - (difficulty * 250));
  };

  const generatePattern = useCallback((size: number): PatternItem[] => {
    return Array.from({ length: size }, () => ({
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, []);

  const generateOptions = useCallback((correctPattern: PatternItem[], count: number): PatternItem[][] => {
    const opts: PatternItem[][] = [correctPattern];
    while (opts.length < count) {
      const wrongPattern = correctPattern.map((item) => {
        if (Math.random() < 0.4) {
          return {
            shape: Math.random() < 0.5 ? SHAPES[Math.floor(Math.random() * SHAPES.length)] : item.shape,
            color: Math.random() < 0.5 ? COLORS[Math.floor(Math.random() * COLORS.length)] : item.color,
          };
        }
        return { ...item };
      });
      const isDifferent = wrongPattern.some((item, idx) => 
        item.shape !== correctPattern[idx].shape || item.color !== correctPattern[idx].color
      );
      if (isDifferent) opts.push(wrongPattern);
    }
    return [...opts].sort(() => Math.random() - 0.5);
  }, []);

  const startTrial = useCallback(() => {
    const patternSize = getPatternSize(currentDifficulty);
    const optionCount = getOptionCount(currentDifficulty);
    const newPattern = generatePattern(patternSize);
    const newOptions = generateOptions(newPattern, optionCount);
    const correctIdx = newOptions.findIndex(opt =>
      opt.every((item, idx) => item.shape === newPattern[idx].shape && item.color === newPattern[idx].color)
    );
    setPattern(newPattern);
    setOptions(newOptions);
    setCorrectIndex(correctIdx);
    setPhase('showing');
    setShowingProgress(100);
    
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

  const handleSelect = (selectedIndex: number) => {
    if (phase !== 'matching') return;
    const reactionTimeMs = Date.now() - trialStartTime;
    const correct = selectedIndex === correctIndex;
    updateTrial(correct, reactionTimeMs);
    engagement.recordTrial({ correct, reactionTimeMs, timeout: false, cueLevel: 0, timestamp: Date.now() });
    if (correct) { setScore(s => s + 1); playSuccess(); setFeedbackType('success'); }
    else { playError(); setFeedbackType('incorrect'); }
    setPhase('feedback');
    onTrialComplete({ correct, reactionTimeMs, difficultyLevel: currentDifficulty, patternSize: pattern.length });
    setTimeout(() => {
      checkAndAdjust();
      if (currentTrial >= totalTrials) { onGameComplete(score + (correct ? 1 : 0)); }
      else { setCurrentTrial(t => t + 1); startTrial(); }
    }, 1500);
  };

  useEffect(() => { startTrial(); }, []);

  const renderShape = (item: PatternItem, size: number = 40) => {
    const colorClass = COLOR_CLASSES[item.color];
    switch (item.shape) {
      case 'circle': return <div className={`rounded-full ${colorClass}`} style={{ width: size, height: size }} />;
      case 'square': return <div className={`rounded-md ${colorClass}`} style={{ width: size, height: size }} />;
      case 'triangle': return (
        <div style={{ width: 0, height: 0, borderLeft: `${size/2}px solid transparent`, borderRight: `${size/2}px solid transparent`, borderBottom: `${size}px solid` }}
          className={`border-b-current ${item.color === 'red' ? 'text-red-500' : item.color === 'blue' ? 'text-blue-500' : item.color === 'green' ? 'text-green-500' : item.color === 'yellow' ? 'text-yellow-500' : 'text-purple-500'}`} />
      );
      case 'star': return (
        <Star className={`${item.color === 'red' ? 'text-red-500' : item.color === 'blue' ? 'text-blue-500' : item.color === 'green' ? 'text-green-500' : item.color === 'yellow' ? 'text-yellow-500' : 'text-purple-500'}`}
          fill="currentColor" size={size} />
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Compact header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{currentTrial}/{totalTrials}</span>
        <div className="text-right">
          <span className="font-bold">{score}/{currentTrial}</span>
          <span className="text-xs text-muted-foreground ml-2">Lv {currentDifficulty}</span>
        </div>
      </div>

      <Progress value={(currentTrial / totalTrials) * 100} className="h-1.5" />

      {/* Phase instruction — compact */}
      <div className="text-center py-1">
        {phase === 'showing' && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">👀 Remember this pattern!</p>
            <Progress value={showingProgress} className="h-1 w-24 mx-auto" />
          </div>
        )}
        {phase === 'matching' && <p className="text-sm font-medium">🎯 Find the match</p>}
        {phase === 'feedback' && (
          <p className={cn("text-sm font-medium", feedbackType === 'success' ? 'text-green-600' : 'text-orange-600')}>
            {feedbackType === 'success' ? '✨ Perfect!' : '🔄 Not quite'}
          </p>
        )}
      </div>

      {/* Pattern display */}
      <div className="bg-card border rounded-xl p-3 sm:p-4 min-h-[80px] flex items-center justify-center">
        {phase === 'showing' && (
          <div className="flex items-center gap-2 flex-wrap justify-center animate-in fade-in zoom-in duration-300">
            {pattern.map((item, idx) => (
              <div key={idx} className="p-1.5 bg-background rounded-lg shadow-sm">
                {renderShape(item, getShapeSize('display'))}
              </div>
            ))}
          </div>
        )}
        {phase === 'matching' && (
          <div className="flex items-center gap-2 flex-wrap justify-center opacity-30">
            {pattern.map((_, idx) => (
              <div key={idx} className="border-2 border-dashed border-muted-foreground/30 rounded-lg"
                style={{ width: getShapeSize('display'), height: getShapeSize('display') }} />
            ))}
          </div>
        )}
        {phase === 'feedback' && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {pattern.map((item, idx) => (
              <div key={idx} className={cn("p-1.5 rounded-lg", feedbackType === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-background')}>
                {renderShape(item, getShapeSize('display'))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Options — large touch targets */}
      {phase === 'matching' && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((option, optIdx) => (
            <button
              key={optIdx}
              onClick={() => handleSelect(optIdx)}
              className="p-3 bg-card border-2 border-muted hover:border-primary rounded-xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary min-h-[64px]"
            >
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {option.map((item, itemIdx) => (
                  <div key={itemIdx}>{renderShape(item, getShapeSize('option'))}</div>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Game complete */}
      {currentTrial > totalTrials && (
        <div className="text-center py-6 animate-in fade-in zoom-in">
          <Award className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
          <h3 className="text-xl font-bold mb-1">Session Complete!</h3>
          <p className="text-muted-foreground text-sm">
            {score} out of {totalTrials} patterns matched
          </p>
        </div>
      )}
    </div>
  );
};
