import { useState, useEffect, useRef } from 'react';
import { Wind, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trackTransitionAction } from '@/lib/sessionFlowAnalytics';
import { getPerformanceTransition, getAdaptationMessage, shouldShowFeedback } from '@/lib/sessionFeedbackCopy';
import { useCoachingMode } from '@/contexts/CoachingModeContext';
import { getTransitionCoaching } from '@/lib/coachingNarrative';
import { getExerciseMicroGuidance } from '@/lib/exerciseMicroGuidance';
import { useUiProfile } from '@/hooks/useUiProfile';

interface ExerciseTransitionOverlayProps {
  type: 'encouragement' | 'micro-pause';
  durationOverride?: number;
  completedCount: number;
  totalCount: number;
  nextExerciseName: string;
  nextExerciseId?: string;
  nextPhase?: 'warmup' | 'primary' | 'secondary' | 'consolidation' | 'support';
  isSupportPivot?: boolean;
  sessionId?: string | null;
  /** Last exercise score for performance-aware messaging */
  lastScore?: number | null;
  onContinue: () => void;
  onEnd: () => void;
}

export const ExerciseTransitionOverlay = ({
  type,
  durationOverride,
  completedCount,
  totalCount,
  nextExerciseName,
  nextExerciseId,
  nextPhase,
  isSupportPivot,
  sessionId,
  lastScore,
  onContinue,
  onEnd,
}: ExerciseTransitionOverlayProps) => {
  const { mode } = useCoachingMode();
  // Jitter for organic rhythm
  const jitter = (Math.random() - 0.5) * 0.6;
  const [timeLeft, setTimeLeft] = useState(() => {
    // Will be re-set in effect below once duration is stable
    return durationOverride ?? (type === 'encouragement' ? 3.5 : 5);
  });
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Performance-aware transition message — with frequency gating
  const [showFeedback] = useState(() => shouldShowFeedback());
  const [feedback] = useState(() => {
    if (isSupportPivot) {
      return { line: "Let's take it easier.", emoji: "💛" };
    }
    return getPerformanceTransition(lastScore ?? null);
  });

  const adaptationMsg = showFeedback ? getAdaptationMessage(lastScore ?? null, nextExerciseName) : null;
  
  // Coaching bridge text (Guided/Full modes)
  const [coachingBridge] = useState(() => 
    getTransitionCoaching({
      mode,
      lastScore: lastScore ?? null,
      nextExerciseName,
      nextExerciseId: nextExerciseId || '',
      completedCount,
      totalCount,
    })
  );
  
  // Exercise micro-guidance (Guided/Full modes)
  const [microGuidance] = useState(() => 
    mode !== 'off' ? getExerciseMicroGuidance(nextExerciseId || '', lastScore) : null
  );

  // Coaching-mode-aware duration: long enough to read, breathe, and orient
  // to the next exercise. Previous 3–3.5s felt like a flash between games.
  // New floors: 5.5s plain encouragement, 6.5s when guidance copy is shown,
  // 8s for the breathing micro-pause. Users can always tap to skip.
  const hasGuidanceContent = !!(microGuidance || coachingBridge);
  const encouragementBase = (mode !== 'off' && hasGuidanceContent) ? 6.5 : 5.5;
  const duration = durationOverride ?? (type === 'encouragement' ? encouragementBase + jitter : 8 + jitter);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Sync timeLeft to computed duration on mount
  useEffect(() => { setTimeLeft(duration); }, []);

  useEffect(() => {
    if (isPaused) return;

    // Drive the countdown from real elapsed time so it always shows the full
    // duration (no off-by-one early exit) regardless of tick alignment.
    const timer = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = durationRef.current - elapsed;
      if (remaining <= 0) {
        trackTransitionAction(
          sessionId ?? null, completedCount, totalCount,
          type, 'auto_advance', Date.now() - startTimeRef.current
        );
        setTimeLeft(0);
        onContinue();
        return;
      }
      setTimeLeft(remaining);
    }, 250);

    return () => clearInterval(timer);
  }, [onContinue, isPaused, sessionId, completedCount, totalCount, type]);

  const handleSkipContinue = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'skip', Date.now() - startTimeRef.current
    );
    onContinue();
  };

  const handleEnd = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'end_session', Date.now() - startTimeRef.current
    );
    onEnd();
  };

  const handleNeedMoreTime = () => {
    trackTransitionAction(
      sessionId ?? null, completedCount, totalCount,
      type, 'need_more_time', Date.now() - startTimeRef.current
    );
    setIsPaused(true);
  };

  // ═══════ Micro-pause (breathing break) ═══════
  if (type === 'micro-pause') {
    return (
      <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in duration-500">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  i < completedCount ? "bg-primary scale-100" : "bg-muted scale-75"
                )}
              />
            ))}
          </div>

          {/* Breathing icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wind className="w-10 h-10 text-primary animate-pulse" />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1">Take a breath</h2>
            <p className="text-muted-foreground text-lg">
              {completedCount} of {totalCount} done
            </p>
          </div>

          {!isPaused && (
            <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
              <div 
                className="h-full bg-primary/40 transition-all duration-1000 ease-linear"
                style={{ width: `${((duration - timeLeft) / duration) * 100}%` }}
              />
            </div>
          )}

          {isPaused && (
            <p className="text-sm text-muted-foreground">Take as long as you need</p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <Button variant="ghost" size="lg" className="flex-1 text-muted-foreground" onClick={handleEnd}>
                End session
              </Button>
              <Button size="lg" className="flex-1" onClick={handleSkipContinue}>
                Continue
              </Button>
            </div>
            {!isPaused && (
              <Button variant="ghost" size="sm" className="text-muted-foreground mx-auto" onClick={handleNeedMoreTime}>
                <Clock className="w-4 h-4 mr-1.5" />
                Need more time
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════ Encouragement overlay — performance-aware ═══════
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
        {/* Progress */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                i < completedCount ? "bg-primary scale-100" : "bg-muted scale-75"
              )}
            />
          ))}
        </div>

        {/* Performance-aware feedback — gated for natural feel */}
        <div className="space-y-1.5">
          {showFeedback && (
            <>
              <p className="text-4xl">{feedback.emoji}</p>
              <h2 className="text-2xl font-bold">{feedback.line}</h2>
            </>
          )}
          
          <p className={cn("text-muted-foreground", !showFeedback && "text-xl font-semibold")}>
            Next: <span className="font-medium">{nextExerciseName}</span>
          </p>
          
          {/* Exercise micro-guidance — Guided/Full modes */}
          {microGuidance && !coachingBridge && (
            <p className="text-sm text-muted-foreground/80 italic">
              {microGuidance}
            </p>
          )}
          
          {/* Coaching bridge — Guided/Full modes */}
          {coachingBridge && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <MessageCircle className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <p className="text-sm text-primary/80 font-medium italic">
                {coachingBridge}
              </p>
            </div>
          )}
          
          {/* Adaptation message — tertiary, smaller */}
          {adaptationMsg && !coachingBridge && (
            <p className="text-xs text-primary/60 font-medium">{adaptationMsg}</p>
          )}
        </div>

        {/* Auto-advance bar */}
        <div className="w-24 mx-auto bg-muted rounded-full h-1 overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${((duration - timeLeft) / duration) * 100}%` }}
          />
        </div>

        <button onClick={handleSkipContinue} className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
          Tap to skip
        </button>
      </div>
    </div>
  );
};
