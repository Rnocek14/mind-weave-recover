/**
 * ThoughtPromptCard - Inline mini thought continuation exercise
 * 
 * Shows ONE narrowed thought prompt, auto-listens.
 * Returns completion status based on flow.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, MessageCircle, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';

interface ThoughtPromptCardResult {
  success: boolean;
  wordCount: number;
  promptText: string;
  latencyMs: number | null;
}

interface ThoughtPromptCardProps {
  difficulty: 'easy' | 'medium';
  onComplete: (result: ThoughtPromptCardResult) => void;
}

// Simple, narrowed prompts for quick inline use
const QUICK_PROMPTS = [
  "Tell me one thing you ate today.",
  "What's one thing you saw this morning?",
  "Tell me about the weather right now.",
  "What did you do after waking up?",
  "Name one thing in this room.",
  "What's one sound you can hear?",
  "Tell me something you're wearing.",
  "What time of day is it?",
];

export function ThoughtPromptCard({ difficulty, onComplete }: ThoughtPromptCardProps) {
  const [phase, setPhase] = useState<'listening' | 'complete'>('listening');
  const [transcript, setTranscript] = useState('');
  const [prompt] = useState(() => QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)]);
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);

  const handleSpeechResult = useCallback((text: string) => {
    if (!firstWordTimeRef.current && text.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
    setTranscript(text);
  }, []);

  const { startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: false,
  });

  // Auto-start listening
  useEffect(() => {
    if (phase === 'listening') {
      startListening();
    }
    return () => stopListening();
  }, [phase, startListening, stopListening]);

  // Auto-complete after speech detected
  useEffect(() => {
    if (transcript.trim().length >= 3 && phase === 'listening') {
      const timer = setTimeout(() => {
        handleDone();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [transcript, phase]);

  const handleDone = useCallback(() => {
    stopListening();
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current 
      ? firstWordTimeRef.current - startTimeRef.current
      : null;

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const success = wordCount >= 1;

    setTimeout(() => {
      onComplete({
        success,
        wordCount,
        promptText: prompt,
        latencyMs,
      });
    }, 500);
  }, [stopListening, transcript, prompt, onComplete]);

  if (!isSupported) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4 text-center text-muted-foreground">
          Speech not supported
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Prompt display */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <p className="text-lg font-medium text-foreground">
            {prompt}
          </p>
        </div>

        {/* Status */}
        <div className="text-center space-y-3">
          {phase === 'listening' && (
            <>
              <div className={cn(
                "text-lg font-medium min-h-[56px] max-w-xs mx-auto",
                transcript ? "text-foreground" : "text-muted-foreground"
              )}>
                {transcript || '...'}
              </div>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Listening...</span>
              </div>
              {transcript.length > 0 && (
                <Button 
                  variant="secondary" 
                  onClick={handleDone}
                  size="sm"
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  Done
                </Button>
              )}
            </>
          )}

          {phase === 'complete' && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="w-5 h-5" />
              <span className="font-medium">Got it!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
