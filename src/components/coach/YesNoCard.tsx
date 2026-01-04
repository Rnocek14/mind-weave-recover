/**
 * YesNoCard - Simplest interaction for the Coach
 * 
 * Shows a yes/no question when user can't initiate speech at all.
 * Any answer counts as success - just gets them speaking.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getRandomYesNoQuestion } from '@/data/yesNoBank';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface YesNoCardProps {
  difficulty?: 'easy' | 'medium';
  onComplete: (result: { answered: boolean; response: 'yes' | 'no' | 'other'; latencyMs: number }) => void;
}

export function YesNoCard({ onComplete }: YesNoCardProps) {
  const [question] = useState(() => getRandomYesNoQuestion());
  const [isListening, setIsListening] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [detectedResponse, setDetectedResponse] = useState<'yes' | 'no' | 'other' | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  
  // Analyze transcript for yes/no
  const analyzeResponse = useCallback((text: string): 'yes' | 'no' | 'other' => {
    const lower = text.toLowerCase().trim();
    const yesWords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'uh-huh', 'mhm', 'correct', 'right'];
    const noWords = ['no', 'nope', 'nah', 'not', 'never', 'uh-uh'];
    
    for (const word of yesWords) {
      if (lower.includes(word)) return 'yes';
    }
    for (const word of noWords) {
      if (lower.includes(word)) return 'no';
    }
    
    // Any speech counts as "other" (they spoke, which is the goal!)
    return text.length > 0 ? 'other' : 'other';
  }, []);

  // Handle speech result
  const handleSpeechResult = useCallback((text: string) => {
    if (hasAnswered || !text) return;
    
    const response = analyzeResponse(text);
    setDetectedResponse(response);
    setHasAnswered(true);
    setIsListening(false);
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        answered: true,
        response,
        latencyMs,
      });
    }, 1000);
  }, [hasAnswered, analyzeResponse, onComplete]);

  const { 
    isListening: recognitionActive,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
  });

  const handleStartListening = () => {
    startTimeRef.current = Date.now();
    setIsListening(true);
    startListening();
  };

  const handleStopListening = () => {
    setIsListening(false);
    stopListening();
  };

  // Manual button responses as fallback
  const handleManualResponse = (response: 'yes' | 'no') => {
    if (hasAnswered) return;
    
    setDetectedResponse(response);
    setHasAnswered(true);
    setIsListening(false);
    stopListening();
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        answered: true,
        response,
        latencyMs,
      });
    }, 500);
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-accent/10">
      <CardContent className="p-6 space-y-4">
        {/* Question */}
        <div className="text-center">
          <p className="text-xl font-medium text-foreground">{question.question}</p>
          <p className="text-sm text-muted-foreground mt-1">Just say yes or no</p>
        </div>

        {/* Success state */}
        {hasAnswered && detectedResponse && (
          <div className="flex items-center justify-center gap-2 py-4 animate-in fade-in zoom-in-95 duration-300">
            <Check className="w-6 h-6 text-green-500" />
            <span className="text-lg font-medium text-green-600 dark:text-green-400">
              Got it!
            </span>
          </div>
        )}

        {/* Voice button */}
        {!hasAnswered && (
          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              variant={isListening || recognitionActive ? "destructive" : "default"}
              className="h-16 w-16 rounded-full"
              onMouseDown={handleStartListening}
              onMouseUp={handleStopListening}
              onTouchStart={handleStartListening}
              onTouchEnd={handleStopListening}
            >
              {isListening || recognitionActive ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              {isListening ? "Listening..." : "Hold to speak"}
            </span>
            
            {/* Manual buttons as fallback */}
            <div className="flex gap-4 mt-2">
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
                onClick={() => handleManualResponse('yes')}
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
                onClick={() => handleManualResponse('no')}
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
