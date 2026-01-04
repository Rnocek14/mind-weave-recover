/**
 * RecallPromptCard - Open category word retrieval
 * 
 * Shows a category prompt (e.g., "Name any fruit").
 * User says ANY word in that category - no specific target.
 * Gentler than photo naming since any answer is correct.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check, Sparkles } from 'lucide-react';
import { getRandomRecallPrompt } from '@/data/recallPromptBank';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface RecallPromptCardProps {
  difficulty?: 'easy' | 'medium';
  onComplete: (result: { success: boolean; word: string; latencyMs: number }) => void;
}

export function RecallPromptCard({ difficulty = 'easy', onComplete }: RecallPromptCardProps) {
  const [prompt] = useState(() => getRandomRecallPrompt(difficulty));
  const [isListening, setIsListening] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [spokenWord, setSpokenWord] = useState('');
  const startTimeRef = useRef<number>(Date.now());
  
  // Handle speech result
  const handleSpeechResult = useCallback((text: string) => {
    if (hasAnswered || !text) return;
    
    // Any speech counts as success for recall prompts
    const word = text.trim().split(' ')[0] || text.trim();
    setSpokenWord(word);
    setHasAnswered(true);
    setIsListening(false);
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        success: true,
        word,
        latencyMs,
      });
    }, 1200);
  }, [hasAnswered, onComplete]);

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

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-accent/10">
      <CardContent className="p-6 space-y-4">
        {/* Category icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Prompt */}
        <div className="text-center">
          <p className="text-xl font-medium text-foreground">{prompt.prompt}</p>
          <p className="text-sm text-muted-foreground mt-1">Any word is fine</p>
        </div>

        {/* Success state */}
        {hasAnswered && spokenWord && (
          <div className="flex flex-col items-center gap-2 py-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2">
              <Check className="w-6 h-6 text-green-500" />
              <span className="text-lg font-medium text-green-600 dark:text-green-400">
                Nice!
              </span>
            </div>
            <span className="text-lg text-foreground font-medium">
              "{spokenWord}"
            </span>
          </div>
        )}

        {/* Voice button */}
        {!hasAnswered && (
          <div className="flex flex-col items-center gap-3">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
