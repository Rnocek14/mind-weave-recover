/**
 * PhraseStarterCard - Inline starter phrase selection
 * 
 * Offers 2-3 starter phrases to choose from, user picks one and continues.
 * Helps with speech initiation when overwhelmed.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';

interface PhraseStarterCardResult {
  success: boolean;
  starterUsed: string;
  continuation: string;
  latencyMs: number | null;
}

interface PhraseStarterCardProps {
  difficulty: 'easy' | 'medium';
  onComplete: (result: PhraseStarterCardResult) => void;
}

// Starter phrase sets - each set has 3 options
const STARTER_SETS = [
  ["I was thinking about...", "I remember...", "The thing is..."],
  ["What I mean is...", "It's kind of like...", "I wanted to say..."],
  ["One thing I know is...", "I noticed that...", "It made me think..."],
  ["Actually...", "Well...", "So..."],
];

export function PhraseStarterCard({ difficulty, onComplete }: PhraseStarterCardProps) {
  const [phase, setPhase] = useState<'choosing' | 'listening' | 'complete'>('choosing');
  const [transcript, setTranscript] = useState('');
  const [starters, setStarters] = useState<string[]>([]);
  const [selectedStarter, setSelectedStarter] = useState<string>('');
  
  const startTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);

  // Select a random starter set on mount
  useEffect(() => {
    const randomSet = STARTER_SETS[Math.floor(Math.random() * STARTER_SETS.length)];
    setStarters(randomSet);
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

  const handleSelectStarter = (starter: string) => {
    setSelectedStarter(starter);
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

    const success = transcript.trim().length > 0;

    setTimeout(() => {
      onComplete({
        success,
        starterUsed: selectedStarter,
        continuation: transcript,
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

  return (
    <Card className="bg-card border-2 border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {phase === 'choosing' && (
          <>
            <p className="text-center text-muted-foreground mb-3">
              Pick one to start with
            </p>
            <div className="space-y-2">
              {starters.map((starter, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => handleSelectStarter(starter)}
                >
                  <Mic className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{starter}</span>
                </Button>
              ))}
            </div>
          </>
        )}

        {phase === 'listening' && (
          <div className="text-center space-y-3">
            <div className="text-sm text-muted-foreground">
              Starting with: <span className="font-medium text-foreground">{selectedStarter}</span>
            </div>
            <div className={cn(
              "text-lg font-medium min-h-[56px] max-w-xs mx-auto",
              transcript ? "text-foreground" : "text-muted-foreground"
            )}>
              {transcript || '(continue speaking...)'}
            </div>
            <Button 
              variant="secondary" 
              onClick={handleDone}
              className="gap-2"
            >
              <MicOff className="w-4 h-4" />
              Done
            </Button>
          </div>
        )}

        {phase === 'complete' && (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="w-5 h-5" />
              <span className="font-medium">Nice start!</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
