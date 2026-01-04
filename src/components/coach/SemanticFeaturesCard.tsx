/**
 * SemanticFeaturesCard - Inline mini semantic features exercise
 * 
 * Shows ONE item, user describes its features verbally.
 * Returns success based on speaking (flow, not correctness).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Check, HelpCircle } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { SEMANTIC_TRIALS, SemanticFeatureTrial } from '@/data/semanticFeatureBank';
import { cn } from '@/lib/utils';

interface SemanticFeaturesCardResult {
  success: boolean;
  wordCount: number;
  targetWord: string;
  latencyMs: number | null;
}

interface SemanticFeaturesCardProps {
  difficulty: 'easy' | 'medium';
  onComplete: (result: SemanticFeaturesCardResult) => void;
}

// Feature prompt questions
const FEATURE_PROMPTS = [
  "What is it?",
  "What do you do with it?",
  "Where do you find it?",
  "What does it look like?",
];

export function SemanticFeaturesCard({ difficulty, onComplete }: SemanticFeaturesCardProps) {
  const [phase, setPhase] = useState<'ready' | 'listening' | 'complete'>('ready');
  const [transcript, setTranscript] = useState('');
  const [trial, setTrial] = useState<SemanticFeatureTrial | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  
  const startTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);

  // Select an easy trial on mount
  useEffect(() => {
    const easyTrials = SEMANTIC_TRIALS.filter(t => t.difficulty <= 2);
    const randomTrial = easyTrials[Math.floor(Math.random() * easyTrials.length)];
    setTrial(randomTrial);
    setCurrentPrompt(FEATURE_PROMPTS[Math.floor(Math.random() * FEATURE_PROMPTS.length)]);
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

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const success = wordCount >= 2; // Success if they said anything meaningful

    setTimeout(() => {
      onComplete({
        success,
        wordCount,
        targetWord: trial?.word || '',
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
        <CardContent className="p-4 h-32" />
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 border-primary/20 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Target word display */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary capitalize mb-2">
            {trial.word}
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">{currentPrompt}</span>
          </div>
        </div>

        {/* Instructions/Status */}
        <div className="text-center space-y-3">
          {phase === 'ready' && (
            <>
              <p className="text-sm text-muted-foreground">Describe it in your own words</p>
              <Button onClick={handleStart} className="gap-2">
                <Mic className="w-4 h-4" />
                Start
              </Button>
            </>
          )}

          {phase === 'listening' && (
            <>
              <div className={cn(
                "text-lg font-medium min-h-[56px] max-w-xs mx-auto",
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
              <span className="font-medium">Nice description!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
