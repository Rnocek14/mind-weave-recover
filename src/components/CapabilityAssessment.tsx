import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HelpCircle, ArrowRight, SkipForward } from 'lucide-react';
import { CapabilityGracefulExit, type CaregiverObservations } from './CapabilityGracefulExit';
import { useCapabilityAssessment } from '@/hooks/useCapabilityAssessment';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  calculateVisionScore,
  calculateMotorScore,
  calculateAttentionScore,
  calculateConfidence,
  shouldGracefullyExit,
  type TrialResult,
  type Level0Result,
  type Level1Result,
  type Level2Result,
  type AssessmentResult,
} from '@/lib/capabilityAssessor';

interface CapabilityAssessmentProps {
  userId: string;
  profileId: string;
  clinicalProfile?: any;
  onComplete: (result: AssessmentResult) => void;
  onExit: () => void;
}

type AssessmentLevel = 0 | 1 | 2;
type Shape = 'circle' | 'square' | 'triangle';
type Color = 'red' | 'blue' | 'yellow';

interface MatchingTrial {
  reference: { shape: Shape; color: Color };
  options: Array<{ shape: Shape; color: Color; position: number }>;
  correctPosition: number;
}

export const CapabilityAssessment = ({
  userId,
  profileId,
  clinicalProfile,
  onComplete,
  onExit,
}: CapabilityAssessmentProps) => {
  const { saveAssessment } = useCapabilityAssessment(userId, profileId);
  const { speak } = useTextToSpeech();
  
  const [showIntro, setShowIntro] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<AssessmentLevel>(0);
  const [trialNumber, setTrialNumber] = useState(0);
  const [targetPosition, setTargetPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [targetSize, setTargetSize] = useState(200);
  const [showTarget, setShowTarget] = useState(true);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  
  // Level 0 state
  const [level0Result, setLevel0Result] = useState<Level0Result>({
    oriented: false,
    attempts: 0,
  });
  
  // Level 1 state
  const [level1Taps, setLevel1Taps] = useState<number[]>([]);
  const [level1Result, setLevel1Result] = useState<Level1Result>({
    discoveredCauseEffect: false,
    repeatTaps: 0,
    consistentInteraction: false,
  });
  
  // Level 2 state
  const [level2Trials, setLevel2Trials] = useState<TrialResult[]>([]);
  const [currentMatchingTrial, setCurrentMatchingTrial] = useState<MatchingTrial | null>(null);
  
  // Graceful exit state
  const [showGracefulExit, setShowGracefulExit] = useState(false);
  const [exitReason, setExitReason] = useState<AssessmentResult['retryReason']>();
  
  // Inactivity detection state
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0);
  const [offTargetClicks, setOffTargetClicks] = useState(0);
  const [showRedirectHint, setShowRedirectHint] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const totalTrials = 3 + 5 + 6; // Level 0: 3, Level 1: 5, Level 2: 6
  const completedTrials = trialNumber;
  const progressPercent = (completedTrials / totalTrials) * 100;

  // Generate random position for target
  const generateTargetPosition = useCallback(() => {
    const padding = 100;
    
    if (typeof window === 'undefined') {
      // Safe fallback for SSR
      return { x: 200, y: 300 };
    }
    
    const maxX = window.innerWidth - padding;
    const maxY = window.innerHeight - padding;
    return {
      x: Math.random() * (maxX - padding) + padding,
      y: Math.random() * (maxY - padding) + padding,
    };
  }, []);

  // Generate matching trial for Level 2
  const generateMatchingTrial = useCallback((): MatchingTrial => {
    const shapes: Shape[] = ['circle', 'square', 'triangle'];
    const colors: Color[] = ['red', 'blue', 'yellow'];
    
    const refShape = shapes[Math.floor(Math.random() * shapes.length)];
    const refColor = colors[Math.floor(Math.random() * colors.length)];
    
    const correctPosition = Math.random() < 0.5 ? 0 : 1;
    
    // Generate distractor (different shape OR different color)
    let distractorShape = refShape;
    let distractorColor = refColor;
    
    if (Math.random() < 0.5) {
      // Different shape, same color
      distractorShape = shapes.filter(s => s !== refShape)[Math.floor(Math.random() * 2)];
    } else {
      // Different color, same shape
      distractorColor = colors.filter(c => c !== refColor)[Math.floor(Math.random() * 2)];
    }
    
    return {
      reference: { shape: refShape, color: refColor },
      options: correctPosition === 0 
        ? [
            { shape: refShape, color: refColor, position: 0 },
            { shape: distractorShape, color: distractorColor, position: 1 },
          ]
        : [
            { shape: distractorShape, color: distractorColor, position: 0 },
            { shape: refShape, color: refColor, position: 1 },
          ],
      correctPosition,
    };
  }, []);

  // Initialize trials
  useEffect(() => {
    if (currentLevel === 0) {
      setTargetPosition(generateTargetPosition());
      setTrialStartTime(Date.now());
      setInactivitySeconds(0);
      setShowHint(false);
    } else if (currentLevel === 2 && !currentMatchingTrial) {
      setCurrentMatchingTrial(generateMatchingTrial());
      setTrialStartTime(Date.now());
      setInactivitySeconds(0);
      setShowHint(false);
    }
  }, [currentLevel, currentMatchingTrial, generateTargetPosition, generateMatchingTrial]);

  // Inactivity timer
  useEffect(() => {
    if (showIntro || showGracefulExit) return;
    
    inactivityTimerRef.current = setInterval(() => {
      setInactivitySeconds(prev => {
        const next = prev + 1;
        
        // At 5 seconds: Show visual hint
        if (next === 5) {
          setShowHint(true);
        }
        
        // At 8 seconds: Play audio prompt
        if (next === 8) {
          if (currentLevel === 0 || currentLevel === 1) {
            speak("Tap the circle").catch(console.error);
          } else if (currentLevel === 2) {
            speak("Choose the matching shape").catch(console.error);
          }
        }
        
        // At 12 seconds: Record timeout and move on
        if (next === 12) {
          handleTimeout();
        }
        
        return next;
      });
    }, 1000);
    
    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [currentLevel, showIntro, showGracefulExit, trialNumber]);

  const resetInactivityTimer = useCallback(() => {
    setInactivitySeconds(0);
    setShowHint(false);
  }, []);

  const handleTimeout = useCallback(() => {
    resetInactivityTimer();
    setConsecutiveTimeouts(prev => prev + 1);
    
    if (currentLevel === 0) {
      // Level 0: Record timeout attempt
      setLevel0Result(prev => ({
        ...prev,
        attempts: prev.attempts + 1,
      }));
      
      // Move to next position or trigger graceful exit
      if (trialNumber >= 2) {
        setCurrentLevel(1);
        setTrialNumber(0);
      } else {
        setTargetPosition(generateTargetPosition());
        setTrialNumber(prev => prev + 1);
        setTrialStartTime(Date.now());
      }
    } else if (currentLevel === 1) {
      // Level 1: Record as missed interaction
      if (trialNumber >= 4) {
        // Move to Level 2 with low interaction data
        setLevel1Result({
          discoveredCauseEffect: false,
          repeatTaps: level1Taps.length,
          consistentInteraction: false,
        });
        setCurrentLevel(2);
        setTrialNumber(0);
      } else {
        setTargetPosition(generateTargetPosition());
        setTrialNumber(prev => prev + 1);
        setTrialStartTime(Date.now());
      }
    } else if (currentLevel === 2) {
      // Level 2: Record timeout trial
      const trial: TrialResult = {
        level: 2,
        trialNumber,
        timestamp: Date.now(),
        response: 'timeout',
        position: targetPosition,
      };
      
      setLevel2Trials(prev => [...prev, trial]);
      setTrialNumber(prev => prev + 1);
      
      if (trialNumber >= 5) {
        completeAssessment([...level2Trials, trial]);
      } else {
        setCurrentMatchingTrial(generateMatchingTrial());
        setTrialStartTime(Date.now());
      }
    }
  }, [currentLevel, trialNumber, targetPosition, level1Taps, level2Trials, generateTargetPosition, generateMatchingTrial, resetInactivityTimer]);

  const handleTargetTap = useCallback(() => {
    resetInactivityTimer();
    setConsecutiveTimeouts(0); // Reset consecutive timeouts on successful interaction
    const reactionTime = Date.now() - trialStartTime;
    
    if (currentLevel === 0) {
      // Level 0: Visual orientation test
      setLevel0Result({
        oriented: true,
        responseTime: reactionTime,
        attempts: level0Result.attempts + 1,
      });
      
      // Show confetti feedback
      setShowTarget(false);
      setTimeout(() => {
        setShowTarget(true);
        setTargetPosition(generateTargetPosition());
        setTrialNumber(prev => prev + 1);
        setTrialStartTime(Date.now());
        
        // After 3 trials, move to Level 1
        if (trialNumber >= 2) {
          setCurrentLevel(1);
          setTrialNumber(0);
        }
      }, 1000);
      
    } else if (currentLevel === 1) {
      // Level 1: Cause-effect discovery
      const tapTime = Date.now();
      setLevel1Taps(prev => [...prev, tapTime]);
      
      // Show reward animation
      setShowTarget(false);
      setTimeout(() => {
        setShowTarget(true);
        setTargetPosition(generateTargetPosition());
        setTrialNumber(prev => prev + 1);
        setTrialStartTime(Date.now());
        
        // After 5 trials, analyze and move to Level 2
        if (trialNumber >= 4) {
          const taps = [...level1Taps, tapTime];
          const intervals = taps.slice(1).map((t, i) => t - taps[i]);
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          
          setLevel1Result({
            discoveredCauseEffect: taps.length >= 3,
            repeatTaps: taps.length,
            consistentInteraction: avgInterval < 5000,
            avgInterTapInterval: avgInterval,
          });
          
          setCurrentLevel(2);
          setTrialNumber(0);
        }
      }, 800);
    }
  }, [currentLevel, trialNumber, trialStartTime, level0Result, level1Taps, generateTargetPosition]);

  const handleMatchingChoice = useCallback((chosenPosition: number) => {
    if (!currentMatchingTrial) return;
    
    resetInactivityTimer();
    setConsecutiveTimeouts(0); // Reset consecutive timeouts on successful interaction
    const reactionTime = Date.now() - trialStartTime;
    const isCorrect = chosenPosition === currentMatchingTrial.correctPosition;
    
    const trial: TrialResult = {
      level: 2,
      trialNumber,
      timestamp: Date.now(),
      response: isCorrect ? 'hit' : 'miss',
      reactionTimeMs: reactionTime,
      position: targetPosition,
    };
    
    setLevel2Trials(prev => [...prev, trial]);
    setTrialNumber(prev => prev + 1);
    
    // After 6 trials, complete assessment
    if (trialNumber >= 5) {
      completeAssessment([...level2Trials, trial]);
    } else {
      // Next trial
      setCurrentMatchingTrial(generateMatchingTrial());
      setTrialStartTime(Date.now());
    }
  }, [currentMatchingTrial, trialNumber, trialStartTime, targetPosition, level2Trials, generateMatchingTrial]);

  const completeAssessment = useCallback(async (finalLevel2Trials: TrialResult[]) => {
    const level2Result: Level2Result = {
      accuracy: finalLevel2Trials.filter(t => t.response === 'hit').length / finalLevel2Trials.length,
      avgReactionTime: finalLevel2Trials.reduce((sum, t) => sum + (t.reactionTimeMs || 0), 0) / finalLevel2Trials.length,
      consistentHand: true,
      trials: finalLevel2Trials,
    };
    
    const visionScore = calculateVisionScore(level0Result, level2Result);
    const motorScore = calculateMotorScore(level1Result, level2Result);
    const attentionScore = calculateAttentionScore(level1Result, level2Result);
    const confidence = calculateConfidence(level0Result, level1Result, level2Result);
    
    const result: AssessmentResult = {
      level0: level0Result,
      level1: level1Result,
      level2: level2Result,
      scores: {
        vision: visionScore,
        motor: motorScore,
        attention: attentionScore,
        confidence,
      },
      behavioralFlags: {
        canOrient: level0Result.oriented,
        canTap: level1Result.repeatTaps > 0,
        understandsCauseEffect: level1Result.discoveredCauseEffect,
        canMatchPatterns: level2Result.accuracy > 0.5,
      },
      completed: true,
      needsRetry: false,
    };
    
    await saveAssessment(result, clinicalProfile);
    onComplete(result);
  }, [level0Result, level1Result, saveAssessment, clinicalProfile, onComplete]);

  // Track off-target clicks
  const handleAreaClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (currentLevel === 0 || currentLevel === 1) {
      // For dot-tapping levels, any click outside the target is off-target
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON') {
        setOffTargetClicks(prev => prev + 1);
        setShowRedirectHint(true);
        setTimeout(() => setShowRedirectHint(false), 1500);
      }
    }
  }, [currentLevel]);

  // Check for graceful exit conditions
  useEffect(() => {
    // Count actual timeouts from Level 2 trials
    const timeoutCount = level2Trials.filter(t => t.response === 'timeout').length;
    const exitCheck = shouldGracefullyExit(level0Result, timeoutCount, consecutiveTimeouts, offTargetClicks);
    if (exitCheck.shouldExit && !showGracefulExit) {
      setShowGracefulExit(true);
      setExitReason(exitCheck.reason);
    }
  }, [level0Result, level2Trials, consecutiveTimeouts, offTargetClicks, showGracefulExit]);

  const handleGracefulPause = async (observations?: CaregiverObservations) => {
    // If we have caregiver observations, save them with a partial assessment
    if (observations) {
      const partialResult: AssessmentResult = {
        level0: level0Result,
        level1: level1Result,
        level2: {
          accuracy: 0,
          avgReactionTime: 0,
          consistentHand: false,
          trials: level2Trials,
        },
        scores: {
          vision: 0,
          motor: 0,
          attention: 0,
          confidence: 0,
        },
        behavioralFlags: {
          canOrient: level0Result.oriented,
          canTap: level1Result.repeatTaps > 0,
          understandsCauseEffect: level1Result.discoveredCauseEffect,
          canMatchPatterns: false,
        },
        completed: false,
        needsRetry: true,
        retryReason: exitReason,
      };
      
      const clinicalWithObservations = {
        ...clinicalProfile,
        caregiver_observations: observations,
      };
      
      await saveAssessment(partialResult, clinicalWithObservations);
    }
    
    onExit();
  };

  const renderShape = (shape: Shape, color: Color, size: number = 80) => {
    const colorMap = {
      red: '#ef4444',
      blue: '#3b82f6',
      yellow: '#eab308',
    };
    
    const shapeStyle = {
      width: `${size}px`,
      height: `${size}px`,
      backgroundColor: colorMap[color],
    };
    
    if (shape === 'circle') {
      return <div style={{ ...shapeStyle, borderRadius: '50%' }} />;
    } else if (shape === 'square') {
      return <div style={shapeStyle} />;
    } else {
      return (
        <div style={{ 
          width: 0,
          height: 0,
          borderLeft: `${size/2}px solid transparent`,
          borderRight: `${size/2}px solid transparent`,
          borderBottom: `${size}px solid ${colorMap[color]}`,
        }} />
      );
    }
  };

  if (showGracefulExit && exitReason) {
    return (
      <CapabilityGracefulExit
        reason={exitReason}
        onPause={handleGracefulPause}
        onContinue={() => {
          setShowGracefulExit(false);
          setConsecutiveTimeouts(0);
          setOffTargetClicks(0);
          resetInactivityTimer();
        }}
      />
    );
  }

  // Intro screen
  if (showIntro) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-6">
        <div className="max-w-lg space-y-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Quick Baseline Check</h2>
            <p className="text-muted-foreground">
              This is a 2–3 minute baseline check so we can safely match exercises
              to your current abilities. You won't do this every day—only when we
              need to re-check.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What to expect:</p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
              <li>Tap big dots so we know you can see and touch the screen</li>
              <li>Tap dots as they appear to check reaction speed</li>
              <li>Match shapes to check visual attention</li>
            </ul>
          </div>

          <Button onClick={() => setShowIntro(false)} size="lg" className="w-full">
            Start Check
          </Button>
        </div>
      </div>
    );
  }

  // Get step info based on current level
  const stepInfo = currentLevel === 0 
    ? { step: 1, title: 'Tap the Dot' }
    : currentLevel === 1 
    ? { step: 2, title: 'Follow the Dots' }
    : { step: 3, title: 'Match the Shapes' };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Progress bar - visual only, no text */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Step {stepInfo.step}: {stepInfo.title}</h2>
          <span className="text-xs text-muted-foreground">Step {stepInfo.step} of 3</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Assessment area */}
      <div className="flex-1 relative" onClick={handleAreaClick}>
        {/* Redirect hint for off-target clicks */}
        {showRedirectHint && (
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg animate-fade-in pointer-events-none"
          >
            <ArrowRight className="h-5 w-5" />
            <span className="text-sm font-medium">Tap the circle</span>
          </div>
        )}

        {(currentLevel === 0 || currentLevel === 1) && showTarget && (
          <button
            onClick={handleTargetTap}
            className={showHint ? 'assessment-target-pulse' : ''}
            style={{
              position: 'absolute',
              left: `${targetPosition.x}px`,
              top: `${targetPosition.y}px`,
              width: `${targetSize}px`,
              height: `${targetSize}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              backgroundColor: currentLevel === 0 ? '#ef4444' : '#eab308',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
            }}
          />
        )}

        {currentLevel === 2 && currentMatchingTrial && (
          <div className="flex flex-col items-center justify-center h-full gap-12 p-8">
            {/* Reference shape */}
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-muted rounded-lg">
                {renderShape(currentMatchingTrial.reference.shape, currentMatchingTrial.reference.color, 120)}
              </div>
            </div>

            {/* Options */}
            <div className="flex gap-8">
              {currentMatchingTrial.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleMatchingChoice(option.position)}
                  className="p-6 bg-card hover:bg-accent rounded-lg transition-all hover:scale-110 border-2 border-border"
                >
                  {renderShape(option.shape, option.color, 100)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Help, Skip, and Exit buttons */}
      <div className="p-4 flex justify-between items-center gap-4">
        <Button 
          variant="outline" 
          size="lg" 
          onClick={() => setShowGracefulExit(true)}
          className={`flex items-center gap-2 ${offTargetClicks >= 5 ? 'ring-2 ring-primary animate-pulse' : ''}`}
        >
          <HelpCircle className="h-5 w-5" />
          Need Help?
        </Button>
        
        <div className="flex items-center gap-2">
          {inactivitySeconds >= 3 && (
            <Button 
              variant="secondary" 
              size="lg" 
              onClick={handleTimeout}
              className="flex items-center gap-2"
            >
              <SkipForward className="h-5 w-5" />
              Skip
            </Button>
          )}
          
          <Button variant="ghost" size="sm" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
};
