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
import { buildPatternChoices, PATTERN_SHAPES, PATTERN_COLORS, type PatternItem } from '@/lib/patternMatch/buildPatternChoices';
import { getPatternPracticeStage, patternRuleForTrial, buildPatternPracticeChoices, type PatternPracticeLevel, type PatternMatchRule } from '@/lib/patternMatch/practiceStages';

interface PatternMatchGameProps {
  totalTrials: number;
  initialDifficulty?: number;
  bounds?: DifficultyBounds;
  slowMode?: boolean;
  practiceLevel?: PatternPracticeLevel | null;
  onTrialComplete: (result: {
    correct: boolean;
    reactionTimeMs: number;
    difficultyLevel: number;
    patternSize: number;
    practiceStage?: number;
    matchRule?: PatternMatchRule;
    supportShown?: boolean;
    skipped?: boolean;
  }) => void;
  onGameComplete: (finalScore: number) => void;
  onDifficultyChange?: (newLevel: number, reason: string) => void;
  userId?: string;
  sessionId?: string | null;
}

type ColorType = PatternItem['color'];
const SHAPES = PATTERN_SHAPES;
const COLORS = PATTERN_COLORS;

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
  practiceLevel = null,
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
  const [practiceRule, setPracticeRule] = useState<PatternMatchRule>('exact');
  const [revealed, setRevealed] = useState(false);
  const stage = getPatternPracticeStage(practiceLevel);
  // The previous progress bar displayed 50% BEFORE the first trial of a
  // two-round game and 100% before the patient answered the last round.
  // This is completed-work feedback, not the current item number.
  const completedTrials = Math.max(0, Math.min(
    totalTrials,
    currentTrial - 1 + (phase === 'feedback' ? 1 : 0),
  ));

  const selectionLockedRef = useRef(false);
  const displayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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

  const clearDisplayTimers = useCallback(() => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    displayTimeoutRef.current = null;
    progressIntervalRef.current = null;
  }, []);

  const startTrial = useCallback(() => {
    clearDisplayTimers();
    selectionLockedRef.current = false;
    setRevealed(false);
    const patternSize = stage?.patternSize ?? getPatternSize(currentDifficulty);
    const optionCount = stage?.optionCount ?? getOptionCount(currentDifficulty);
    const newPattern = generatePattern(patternSize);
    const rule = stage ? patternRuleForTrial(stage, currentTrial) : 'exact';
    const { options: newOptions, correctIndex: correctIdx } = stage
      ? buildPatternPracticeChoices(newPattern, optionCount, rule)
      : buildPatternChoices(newPattern, optionCount);
    setPracticeRule(rule);
    setPattern(newPattern);
    setOptions(newOptions);
    setCorrectIndex(correctIdx);
    setPhase('showing');
    setShowingProgress(100);
    
    const displayTime = stage?.previewMs ?? getDisplayTime(currentDifficulty);
    // L1/L2 are simultaneous visual matching, not memory recall.
    if (stage?.visibleAtAnswer) {
      setPhase('matching');
      setTrialStartTime(Date.now());
      return;
    }
    progressIntervalRef.current = setInterval(() => {
      setShowingProgress(prev => Math.max(0, prev - (100 / (displayTime / 100))));
    }, 100);
    displayTimeoutRef.current = setTimeout(() => {
      clearDisplayTimers();
      setPhase('matching');
      setTrialStartTime(Date.now());
    }, displayTime);
  }, [clearDisplayTimers, currentDifficulty, generatePattern, slowMode, stage?.level, currentTrial]);

  // A new round must use the UPDATED difficulty, not the closed-over level
  // from the previous round's feedback timeout.
  const startTrialRef = useRef(startTrial);
  startTrialRef.current = startTrial;
  useEffect(() => {
    if (currentTrial <= totalTrials) startTrialRef.current();
  }, [currentTrial, totalTrials]);

  useEffect(() => () => {
    clearDisplayTimers();
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
  }, [clearDisplayTimers]);

  const handleSelect = (selectedIndex: number) => {
    if (phase !== 'matching' || selectionLockedRef.current) return;
    selectionLockedRef.current = true;
    const reactionTimeMs = Date.now() - trialStartTime;
    const correct = selectedIndex === correctIndex;
    // Externally selected practice stages never alter the adaptive level.
    if (!stage) updateTrial(correct, reactionTimeMs);
    engagement.recordTrial({ correct, reactionTimeMs, timeout: false,
      cueLevel: stage?.visibleAtAnswer || revealed ? 1 : 0, timestamp: Date.now() });
    if (correct) { setScore(s => s + 1); playSuccess(); setFeedbackType('success'); }
    else { playError(); setFeedbackType('incorrect'); }
    setPhase('feedback');
    onTrialComplete({
      correct, reactionTimeMs,
      difficultyLevel: stage?.level ?? currentDifficulty,
      patternSize: pattern.length,
      practiceStage: stage?.level,
      matchRule: practiceRule,
      supportShown: !!stage?.visibleAtAnswer || revealed,
      skipped: false,
    });
    feedbackTimeoutRef.current = setTimeout(() => {
      feedbackTimeoutRef.current = null;
      if (!stage) checkAndAdjust();
      if (currentTrial >= totalTrials) {
        onGameComplete(score + (correct ? 1 : 0));
      } else {
        setCurrentTrial(t => t + 1);
      }
    }, 1500);
  };

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
    <div className="flex flex-col gap-3 sm:gap-4 my-auto w-full max-w-3xl mx-auto">
      {/* Compact header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">Trial {currentTrial}/{totalTrials}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold text-base">{score}/{completedTrials}</span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {stage ? `Practice ${stage.level}/8` : `Lv ${currentDifficulty}`}
          </span>
        </div>
      </div>

      <Progress aria-label="Completed pattern trials" value={totalTrials > 0 ? (completedTrials / totalTrials) * 100 : 0} className="h-1.5" />

      {/* Phase instruction */}
      <div className="text-center">
        {phase === 'showing' && (
          <div className="space-y-2">
            <p className="text-base sm:text-lg font-semibold text-primary">👀 Remember this pattern</p>
            <Progress value={showingProgress} className="h-1.5 w-32 mx-auto" />
          </div>
        )}
        {phase === 'matching' && <p className="text-base sm:text-lg font-semibold">
          {practiceRule === 'shape' ? '🎯 Match the SHAPES in order' :
            practiceRule === 'color' ? '🎯 Match the COLORS in order' : '🎯 Find the matching pattern'}
        </p>}
        {phase === 'feedback' && (
          <p className={cn("text-base sm:text-lg font-semibold", feedbackType === 'success' ? 'text-green-600' : 'text-orange-600')}>
            {feedbackType === 'success' ? '✨ Perfect match!' : '🔄 Not quite — keep going'}
          </p>
        )}
      </div>

      {stage && <p className="text-center text-sm text-muted-foreground">
        Stage {stage.level}: {stage.instruction}
      </p>}

      {/* Pattern display — generous, hero card */}
      <div className="bg-gradient-to-br from-card to-muted/30 border-2 rounded-2xl p-6 sm:p-8 min-h-[140px] sm:min-h-[180px] flex items-center justify-center shadow-sm">
        {phase === 'showing' && (
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center animate-in fade-in zoom-in duration-300">
            {pattern.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-background rounded-xl shadow-md">
                {renderShape(item, getShapeSize('display'))}
              </div>
            ))}
          </div>
        )}
        {phase === 'matching' && (
          (stage?.visibleAtAnswer || revealed) ? (
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
              {pattern.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-background rounded-xl shadow-md">
                  {renderShape(item, getShapeSize('display'))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center opacity-40">
              {pattern.map((_, idx) => (
                <div key={idx} className="border-2 border-dashed border-muted-foreground/40 rounded-xl"
                  style={{ width: getShapeSize('display') + 20, height: getShapeSize('display') + 20 }} />
              ))}
            </div>
          )
        )}
        {phase === 'feedback' && (
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
            {pattern.map((item, idx) => (
              <div key={idx} className={cn("p-2.5 rounded-xl shadow-md", feedbackType === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-background')}>
                {renderShape(item, getShapeSize('display'))}
              </div>
            ))}
          </div>
        )}
      </div>

      {phase === 'matching' && stage && !stage.visibleAtAnswer && !revealed && (
        <Button variant="outline" size="lg" onClick={() => setRevealed(true)}>
          Show the pattern again (help)
        </Button>
      )}

      {/* Options — large touch targets */}
      {phase === 'matching' && (
        <div
          className="grid gap-3 mx-auto w-full"
          style={{
            gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))`,
            maxWidth: options.length <= 2 ? '32rem' : undefined,
          }}
        >
          {options.map((option, optIdx) => (
            <button
              key={optIdx}
              onClick={() => handleSelect(optIdx)}
              aria-label={`Pattern choice ${optIdx + 1} of ${options.length}`}
              className="p-4 bg-card border-2 border-muted hover:border-primary hover:shadow-md rounded-2xl transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary min-h-[88px]"
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
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
