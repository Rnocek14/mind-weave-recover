/**
 * RecallPromptCard - Open category word retrieval
 * 
 * Shows a category prompt (e.g., "Name any fruit").
 * Auto-starts listening since conversation is active.
 * User says ANY word in that category - no specific target.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { getRandomRecallPrompt } from '@/data/recallPromptBank';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface RecallPromptCardProps {
  difficulty?: 'easy' | 'medium';
  onComplete: (result: { success: boolean; word: string; latencyMs: number }) => void;
}

export function RecallPromptCard({ difficulty = 'easy', onComplete }: RecallPromptCardProps) {
  const [prompt] = useState(() => getRandomRecallPrompt(difficulty));
  const [hasAnswered, setHasAnswered] = useState(false);
  const [spokenWord, setSpokenWord] = useState('');
  const [transcript, setTranscript] = useState('');
  const startTimeRef = useRef<number>(Date.now());
  
  // Handle speech result
  const handleSpeechResult = useCallback((text: string) => {
    if (hasAnswered || !text) return;
    setTranscript(text);
    
    // Any speech counts as success for recall prompts
    const word = text.trim().split(' ')[0] || text.trim();
    setSpokenWord(word);
    setHasAnswered(true);
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        success: true,
        word,
        latencyMs,
      });
    }, 1000);
  }, [hasAnswered, onComplete]);

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

        {/* Listening indicator */}
        {!hasAnswered && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Listening...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
