/**
 * YesNoCard - Simplest interaction for the Coach
 * 
 * Shows a yes/no question. User can tap buttons or speak.
 * Auto-listens since conversation is already active.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { getRandomYesNoQuestion } from '@/data/yesNoBank';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface YesNoCardProps {
  difficulty?: 'easy' | 'medium';
  onComplete: (result: { answered: boolean; response: 'yes' | 'no' | 'other'; latencyMs: number }) => void;
}

export function YesNoCard({ onComplete }: YesNoCardProps) {
  const [question] = useState(() => getRandomYesNoQuestion());
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
    
    // Any speech counts as "other"
    return text.length > 0 ? 'other' : 'other';
  }, []);

  // Handle speech result
  const handleSpeechResult = useCallback((text: string) => {
    if (hasAnswered || !text) return;
    
    const response = analyzeResponse(text);
    setDetectedResponse(response);
    setHasAnswered(true);
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        answered: true,
        response,
        latencyMs,
      });
    }, 800);
  }, [hasAnswered, analyzeResponse, onComplete]);

  const { 
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
  });

  // Auto-start listening
  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  // Manual button responses as fallback
  const handleManualResponse = (response: 'yes' | 'no') => {
    if (hasAnswered) return;
    
    setDetectedResponse(response);
    setHasAnswered(true);
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
          <p className="text-sm text-muted-foreground mt-1">Say yes or no, or tap below</p>
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

        {/* Buttons (always visible as fallback) */}
        {!hasAnswered && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2 min-w-[100px]"
                onClick={() => handleManualResponse('yes')}
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2 min-w-[100px]"
                onClick={() => handleManualResponse('no')}
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Listening...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
