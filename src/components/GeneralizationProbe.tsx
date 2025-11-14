/**
 * Generalization Probe Assessment Component
 * Administers untrained probe trials to measure true learning vs memorization
 * Uses minimal cues and focuses on baseline performance measurement
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Brain, TrendingUp, Lightbulb } from 'lucide-react';
import { useGeneralizationProbe, type ProbeResult } from '@/hooks/useGeneralizationProbe';
import { classifySpeechError } from '@/lib/errorClassifier';
import { getCueText } from '@/lib/cueGenerator';
import { useToast } from '@/hooks/use-toast';

interface GeneralizationProbeProps {
  difficultyLevel: number;
  onComplete: (results: ProbeResult[]) => void;
  onSkip?: () => void;
}

export const GeneralizationProbe = ({ 
  difficultyLevel, 
  onComplete,
  onSkip 
}: GeneralizationProbeProps) => {
  const { state, recordResult, nextTrial, getSummary } = useGeneralizationProbe(difficultyLevel, 5);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [cueLevel, setCueLevel] = useState(0);
  const [showCue, setShowCue] = useState(false);
  const { toast } = useToast();

  // Reset trial state when new trial starts
  useEffect(() => {
    if (state.currentTrial && !showFeedback) {
      setTrialStartTime(Date.now());
      setSelectedAnswer(null);
      setCueLevel(0);
      setShowCue(false);
    }
  }, [state.currentTrial, showFeedback]);

  // Handle probe completion
  useEffect(() => {
    if (state.isComplete) {
      const summary = getSummary();
      toast({
        title: "Progress Check Complete!",
        description: `You named ${summary.correctCount} out of ${summary.totalTrials} new words correctly (${Math.round(summary.accuracy * 100)}%)`,
        duration: 5000
      });
      
      setTimeout(() => {
        onComplete(state.results);
      }, 2000);
    }
  }, [state.isComplete, state.results, onComplete, getSummary, toast]);

  const handleAnswerSelect = async (answer: string) => {
    if (showFeedback || !state.currentTrial) return;
    
    setSelectedAnswer(answer);
    const reactionTime = Date.now() - trialStartTime;
    
    // Classify error
    const errorClassification = await classifySpeechError(
      answer,
      state.currentTrial.target,
      0.9,
      {
        trialNumber: state.trialNumber,
        previousErrors: [],
        category: state.currentTrial.category,
        features: state.currentTrial.features
      }
    );
    
    const correct = errorClassification.errorType === 'correct' || 
                    errorClassification.errorType === 'self_corrected';
    
    setFeedbackCorrect(correct);
    setShowFeedback(true);
    
    // Record result
    const result: ProbeResult = {
      word: state.currentTrial.target,
      correct,
      errorType: errorClassification.errorType,
      cuesNeeded: cueLevel,
      reactionTimeMs: reactionTime,
      difficulty: state.currentTrial.computed_difficulty
    };
    
    recordResult(result);
    
    // Auto-advance after delay
    setTimeout(() => {
      setShowFeedback(false);
      nextTrial();
    }, 1500);
  };

  const handleShowCue = () => {
    if (cueLevel >= 2 || !state.currentTrial) return; // Max 2 cues for probes
    
    const newCueLevel = cueLevel + 1;
    setCueLevel(newCueLevel);
    setShowCue(true);
    
    toast({
      title: "Hint provided",
      description: "Take your time - this helps us understand your progress",
      duration: 2000
    });
  };

  if (!state.currentTrial) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading progress check...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Progress Check</CardTitle>
              <CardDescription>
                Let's see how you're doing with some new words we haven't practiced
              </CardDescription>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="space-y-2 mt-4">
            <div className="flex justify-between text-sm">
              <span>Trial {state.trialNumber} of {state.totalTrials}</span>
              <span>{Math.round((state.trialNumber - 1) / state.totalTrials * 100)}%</span>
            </div>
            <Progress value={(state.trialNumber - 1) / state.totalTrials * 100} />
          </div>
        </CardHeader>
      </Card>

      {/* Image Display */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Image */}
            <div className="relative">
              <div className="w-full max-w-md mx-auto aspect-square bg-muted rounded-xl flex items-center justify-center border-4 border-primary shadow-glow overflow-hidden">
                <img
                  src={state.currentTrial.imageUrl}
                  alt="Name this object"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback for placeholder images
                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            </div>

            {/* Instruction */}
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-1">What is this?</h3>
              <p className="text-sm text-muted-foreground">
                Choose the correct word
              </p>
            </div>

            {/* Cue Display */}
            {showCue && state.currentTrial && (
              <div className="bg-accent/20 border-2 border-accent rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-accent mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-accent mb-1">Hint:</p>
                    <p className="text-sm text-foreground">
                      {getCueText(cueLevel, state.currentTrial.category, state.currentTrial.target)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Answer Choices */}
            <div className="grid grid-cols-2 gap-3">
              {state.choices.map((choice) => (
                <Button
                  key={choice}
                  onClick={() => handleAnswerSelect(choice)}
                  disabled={showFeedback}
                  variant={
                    showFeedback && selectedAnswer === choice
                      ? feedbackCorrect
                        ? 'default'
                        : 'destructive'
                      : 'outline'
                  }
                  className="h-auto py-4 text-lg relative"
                >
                  {choice}
                  {showFeedback && selectedAnswer === choice && (
                    <span className="ml-2">
                      {feedbackCorrect ? (
                        <CheckCircle2 className="w-5 h-5 inline" />
                      ) : (
                        <XCircle className="w-5 h-5 inline" />
                      )}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Hint Button */}
            {!showFeedback && cueLevel < 2 && (
              <div className="flex justify-center">
                <Button
                  onClick={handleShowCue}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <Lightbulb className="w-4 h-4" />
                  Need a hint?
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skip Option */}
      {onSkip && state.trialNumber === 1 && !showFeedback && (
        <div className="text-center">
          <Button
            onClick={onSkip}
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            Skip progress check for now
          </Button>
        </div>
      )}

      {/* Info Footer */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Why are we doing this?</p>
              <p>
                This progress check uses new words you haven't practiced to see if you're truly learning, 
                not just memorizing. It helps us track your real improvement over time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
