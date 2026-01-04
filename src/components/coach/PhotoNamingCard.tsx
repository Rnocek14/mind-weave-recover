/**
 * PhotoNamingCard - Inline mini photo-naming exercise
 * 
 * Shows ONE easy photo, user speaks the name.
 * Returns success/word/latency, takes 10-20 seconds max.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { cn } from '@/lib/utils';

interface PhotoNamingCardResult {
  success: boolean;
  spokenWord: string;
  targetWord: string;
  latencyMs: number | null;
}

interface PhotoNamingCardProps {
  difficulty: 'easy' | 'medium';
  onComplete: (result: PhotoNamingCardResult) => void;
}

export function PhotoNamingCard({ difficulty, onComplete }: PhotoNamingCardProps) {
  const [phase, setPhase] = useState<'ready' | 'listening' | 'complete'>('ready');
  const [transcript, setTranscript] = useState('');
  const [trial, setTrial] = useState<PhotoTrial | null>(null);
  
  const startTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);

  // Select an easy photo on mount
  useEffect(() => {
    const easyPhotos = PHOTO_BANK.filter(p => p.computed_difficulty <= 2);
    const randomPhoto = easyPhotos[Math.floor(Math.random() * easyPhotos.length)];
    setTrial(randomPhoto);
  }, []);

  const handleSpeechResult = useCallback((text: string) => {
    if (!firstWordTimeRef.current && text.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
    setTranscript(text);
  }, []);

  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: false,
  });

  const handleStart = () => {
    setTranscript('');
    startTimeRef.current = Date.now();
    firstWordTimeRef.current = null;
    setPhase('listening');
    startListening();
  };

  const handleDone = () => {
    stopListening();
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current && startTimeRef.current
      ? firstWordTimeRef.current - startTimeRef.current
      : null;

    // Check if response matches target (simple check)
    const target = trial?.target.toLowerCase() || '';
    const spoken = transcript.toLowerCase().trim();
    const success = spoken.includes(target) || target.includes(spoken);

    // Brief delay before reporting completion
    setTimeout(() => {
      onComplete({
        success,
        spokenWord: transcript,
        targetWord: trial?.target || '',
        latencyMs,
      });
    }, 500);
  };

  if (!isSupported) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4 text-center text-muted-foreground">
          Speech not supported
        </CardContent>
      </Card>
    );
  }

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
          {phase === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground">Say what you see</p>
              <Button onClick={handleStart} className="gap-2">
                <Mic className="w-4 h-4" />
                Start
              </Button>
            </>
          )}

          {phase === 'listening' && (
            <>
              <div className={cn(
                "text-lg font-medium min-h-[28px]",
                transcript ? "text-foreground" : "text-muted-foreground"
              )}>
                {transcript || '...'}
              </div>
              <Button 
                variant="secondary" 
                onClick={handleDone}
                className="gap-2"
              >
                <MicOff className="w-4 h-4" />
                Done
              </Button>
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
