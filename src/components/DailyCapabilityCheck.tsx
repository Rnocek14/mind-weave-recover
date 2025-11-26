import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { TrialResult } from "@/lib/capabilityAssessor";

interface DailyCapabilityCheckProps {
  onComplete: (results: {
    passed: boolean;
    needsFullAssessment: boolean;
    quickScores: { vision: number; motor: number; attention: number };
    trialData: TrialResult[];
  }) => void;
}

type CheckPhase = "intro" | "orientation" | "tapping" | "complete";

export const DailyCapabilityCheck = ({ onComplete }: DailyCapabilityCheckProps) => {
  const [phase, setPhase] = useState<CheckPhase>("intro");
  const [currentTrial, setCurrentTrial] = useState(0);
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
  const [targetSize, setTargetSize] = useState(120);
  const [trials, setTrials] = useState<TrialResult[]>([]);
  const [showTarget, setShowTarget] = useState(false);
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [showHint, setShowHint] = useState(false);
  
  const trialStartRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { speak } = useTextToSpeech();

  const totalTrials = 4; // 1 orientation + 3 tapping trials

  useEffect(() => {
    if (phase === "orientation" || phase === "tapping") {
      startInactivityTimer();
    }
    return () => clearInactivityTimer();
  }, [phase, currentTrial]);

  const startInactivityTimer = () => {
    clearInactivityTimer();
    setInactivitySeconds(0);
    setShowHint(false);
    
    inactivityTimerRef.current = setInterval(() => {
      setInactivitySeconds(prev => {
        const next = prev + 1;
        if (next === 5) setShowHint(true);
        if (next === 8) speak("Tap the circle");
        if (next === 12) handleTimeout();
        return next;
      });
    }, 1000);
  };

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    setInactivitySeconds(0);
    setShowHint(false);
  };

  const handleTimeout = () => {
    clearInactivityTimer();
    const trial: TrialResult = {
      level: phase === "orientation" ? 0 : 1,
      trialNumber: currentTrial,
      response: 'timeout',
      reactionTimeMs: 12000,
      timestamp: Date.now(),
    };
    
    const newTrials = [...trials, trial];
    setTrials(newTrials);

    // If orientation fails, escalate immediately
    if (phase === "orientation") {
      onComplete({
        passed: false,
        needsFullAssessment: true,
        quickScores: { vision: 3, motor: 3, attention: 3 },
        trialData: newTrials,
      });
      return;
    }

    nextTrial(newTrials);
  };

  const handleStart = () => {
    setPhase("orientation");
    setShowTarget(true);
    setTargetPosition({ x: 50, y: 50 });
    setTargetSize(120);
    trialStartRef.current = Date.now();
  };

  const handleTap = () => {
    if (!trialStartRef.current) return;
    
    clearInactivityTimer();
    const reactionTime = Date.now() - trialStartRef.current;
    
    const trial: TrialResult = {
      level: phase === "orientation" ? 0 : 1,
      trialNumber: currentTrial,
      response: 'hit',
      reactionTimeMs: reactionTime,
      timestamp: Date.now(),
    };

    const newTrials = [...trials, trial];
    setTrials(newTrials);

    if (phase === "orientation") {
      // Passed orientation, move to tapping
      setPhase("tapping");
      setCurrentTrial(0);
      nextTappingTrial();
    } else {
      nextTrial(newTrials);
    }
  };

  const nextTrial = (trialData: TrialResult[]) => {
    if (currentTrial >= 2) {
      // All trials complete
      completeCheck(trialData);
    } else {
      setCurrentTrial(prev => prev + 1);
      setTimeout(nextTappingTrial, 800);
    }
  };

  const nextTappingTrial = () => {
    // Randomize position
    const x = 25 + Math.random() * 50;
    const y = 25 + Math.random() * 50;
    setTargetPosition({ x, y });
    
    // Vary size slightly
    setTargetSize(100 - currentTrial * 10);
    setShowTarget(true);
    trialStartRef.current = Date.now();
  };

  const completeCheck = (trialData: TrialResult[]) => {
    setPhase("complete");
    clearInactivityTimer();

    // Calculate quick scores
    const successfulTrials = trialData.filter(t => t.response === 'hit');
    const avgRT = successfulTrials.length > 0
      ? successfulTrials.reduce((sum, t) => sum + (t.reactionTimeMs || 0), 0) / successfulTrials.length
      : 10000;

    const successRate = successfulTrials.length / trialData.length;
    const timeoutCount = trialData.filter(t => t.response === 'timeout').length;

    // Quick scoring logic
    const vision = successRate > 0.7 ? 7 : successRate > 0.5 ? 5 : 3;
    const motor = avgRT < 800 ? 8 : avgRT < 1200 ? 6 : 4;
    const attention = timeoutCount === 0 ? 8 : timeoutCount === 1 ? 6 : 4;

    // Decide if full assessment needed
    const needsFullAssessment = 
      successRate < 0.5 || 
      timeoutCount >= 2 || 
      avgRT > 2000;

    onComplete({
      passed: !needsFullAssessment,
      needsFullAssessment,
      quickScores: { vision, motor, attention },
      trialData,
    });
  };

  const progress = phase === "intro" ? 0 : ((currentTrial + (phase === "tapping" ? 1 : 0)) / totalTrials) * 100;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-full max-w-2xl p-8">
        {phase === "intro" && (
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Quick Daily Check</h2>
              <p className="text-muted-foreground text-lg">
                Let's do a quick 30-second warmup to calibrate today's exercises
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-6 space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-semibold">1</span>
                </div>
                <p className="text-foreground">Tap the circle when it appears</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-semibold">2</span>
                </div>
                <p className="text-foreground">Follow it as it moves</p>
              </div>
            </div>
            <Button size="lg" onClick={handleStart} className="w-full">
              Start Check (30 seconds)
            </Button>
          </div>
        )}

        {(phase === "orientation" || phase === "tapping") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-muted-foreground">
                Daily Check Progress
              </span>
              <span className="text-sm font-medium">
                {currentTrial + (phase === "tapping" ? 1 : 0)} / {totalTrials}
              </span>
            </div>
            <Progress value={progress} className="mb-8" />
            
            <div 
              className="relative bg-muted/30 rounded-2xl overflow-hidden"
              style={{ height: "400px" }}
            >
              {showHint && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  Tap the circle
                </div>
              )}

              {showTarget && (
                <button
                  onClick={handleTap}
                  className="absolute rounded-full bg-primary hover:bg-primary/90 transition-all cursor-pointer assessment-target-pulse"
                  style={{
                    width: `${targetSize}px`,
                    height: `${targetSize}px`,
                    left: `${targetPosition.x}%`,
                    top: `${targetPosition.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-label="Tap target"
                />
              )}
            </div>
          </div>
        )}

        {phase === "complete" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">Check complete...</h3>
          </div>
        )}
      </div>
    </div>
  );
};
