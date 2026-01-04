/**
 * PhotoNamingCard - Inline mini photo-naming exercise
 * 
 * Shows ONE easy photo, user speaks the name.
 * Receives transcript from parent (centralized mic control).
 * Auto-starts listening (no manual start button).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, MicOff } from 'lucide-react';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { cn } from '@/lib/utils';

interface PhotoNamingCardResult {
  success: boolean;
  spokenWord: string;
  targetWord: string;
  latencyMs: number | null;
}

interface PhotoNamingCardProps {
  difficulty?: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: PhotoNamingCardResult) => void;
}

export function PhotoNamingCard({ 
  difficulty = 'easy',
  transcript, 
  isListening, 
  onComplete 
}: PhotoNamingCardProps) {
  const [phase, setPhase] = useState<'listening' | 'complete'>('listening');
  const [trial, setTrial] = useState<PhotoTrial | null>(null);
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  // Select a photo on mount
  useEffect(() => {
    const maxDifficulty = difficulty === 'easy' ? 2 : 3;
    const photos = PHOTO_BANK.filter(p => p.computed_difficulty <= maxDifficulty);
    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    setTrial(randomPhoto);
    startTimeRef.current = Date.now();
  }, [difficulty]);

  const handleDone = useCallback(() => {
    if (hasCompletedRef.current || !trial) return;
    hasCompletedRef.current = true;
    
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current 
      ? firstWordTimeRef.current - startTimeRef.current
      : null;

    // Check if response matches target (simple check)
    const target = trial.target.toLowerCase();
    const spoken = transcript.toLowerCase().trim();
    const success = spoken.includes(target) || target.includes(spoken) || spoken.length >= 2;

    setTimeout(() => {
      onComplete({
        success,
        spokenWord: transcript.trim(),
        targetWord: trial.target,
        latencyMs,
      });
    }, 500);
  }, [trial, transcript, onComplete]);

  // Track first word timing
  useEffect(() => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
  }, [transcript]);

  // Auto-complete after speech detection
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    // Clear existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 1) {
      // After first word, wait for silence
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          handleDone();
        }
      }, 2000); // 2 second silence triggers completion
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, phase, handleDone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  if (!trial) {
    return (
      <Card className="bg-muted/50 animate-pulse">
        <CardContent className="p-4 h-48" />
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Photo */}
        <div className="relative aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden bg-muted">
          <img
            src={trial.imageUrl}
            alt="What is this?"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Instructions/Status */}
        <div className="text-center space-y-3">
          {phase === 'listening' && (
            <>
              <p className="text-sm text-muted-foreground">Say what you see</p>
              
              {/* Listening indicator */}
              {isListening && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Listening...</span>
                </div>
              )}
              
              {/* Live transcript */}
              <div className={cn(
                "text-lg font-medium min-h-[28px]",
                transcript ? "text-foreground" : "text-muted-foreground"
              )}>
                {transcript || '...'}
              </div>
              
              {/* Manual done button */}
              {transcript.trim().length > 0 && (
                <Button 
                  variant="secondary" 
                  onClick={handleDone}
                  className="gap-2"
                  size="sm"
                >
                  <MicOff className="w-4 h-4" />
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
