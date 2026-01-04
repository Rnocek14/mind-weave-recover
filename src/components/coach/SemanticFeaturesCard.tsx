/**
 * SemanticFeaturesCard - Context-aware semantic features exercise
 * 
 * Uses the last topic from conversation OR falls back to a random word.
 * Receives transcript from parent (centralized mic control).
 * Returns success based on speaking (flow, not correctness).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, HelpCircle, Loader2 } from 'lucide-react';
import { SEMANTIC_TRIALS, SemanticFeatureTrial } from '@/data/semanticFeatureBank';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { cn } from '@/lib/utils';

interface SemanticFeaturesCardResult {
  success: boolean;
  wordCount: number;
  targetWord: string;
  latencyMs: number | null;
}

interface SemanticFeaturesCardProps {
  difficulty: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: SemanticFeaturesCardResult) => void;
  conversationContext?: string;
}

// Feature prompt questions
const FEATURE_PROMPTS = [
  "What is it?",
  "What do you do with it?",
  "Where do you find it?",
  "What does it look like?",
];

// Extract a topic word from conversation context
function extractTopicFromContext(context?: string): string | null {
  if (!context) return null;
  
  // Common nouns to look for from conversation
  const words = context.toLowerCase().split(/\s+/);
  
  // Look for matching words in our trial bank
  const trialWords = SEMANTIC_TRIALS.map(t => t.word.toLowerCase());
  for (const word of words.reverse()) { // Start from most recent
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (trialWords.includes(cleanWord)) {
      return cleanWord;
    }
  }
  
  return null;
}

export function SemanticFeaturesCard({ 
  difficulty, 
  transcript, 
  isListening, 
  onComplete, 
  conversationContext 
}: SemanticFeaturesCardProps) {
  const [phase, setPhase] = useState<'listening' | 'complete'>('listening');
  const [trial, setTrial] = useState<SemanticFeatureTrial | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState('');
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  // Select trial based on context or random
  useEffect(() => {
    const topicFromContext = extractTopicFromContext(conversationContext);
    
    let selectedTrial: SemanticFeatureTrial;
    
    if (topicFromContext) {
      // Try to find a matching trial
      const matchingTrial = SEMANTIC_TRIALS.find(t => t.word.toLowerCase() === topicFromContext);
      if (matchingTrial) {
        selectedTrial = matchingTrial;
      } else {
        // Fallback to easy trial
        const easyTrials = SEMANTIC_TRIALS.filter(t => t.difficulty <= 2);
        selectedTrial = easyTrials[Math.floor(Math.random() * easyTrials.length)];
      }
    } else {
      // Random easy trial
      const easyTrials = SEMANTIC_TRIALS.filter(t => t.difficulty <= 2);
      selectedTrial = easyTrials[Math.floor(Math.random() * easyTrials.length)];
    }
    
    setTrial(selectedTrial);
    setCurrentPrompt(FEATURE_PROMPTS[Math.floor(Math.random() * FEATURE_PROMPTS.length)]);
  }, [conversationContext]);

  // Track first word timing
  useEffect(() => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
  }, [transcript]);

  const handleDone = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current 
      ? firstWordTimeRef.current - startTimeRef.current
      : null;

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const success = wordCount >= 1; // Any speech counts

    setTimeout(() => {
      onComplete({
        success,
        wordCount,
        targetWord: trial?.word || '',
        latencyMs,
      });
    }, 500);
  }, [transcript, trial, onComplete]);

  // Smart auto-complete with silence detection
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    // Clear existing timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 2) {
      if (transcript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = transcript;
        
        // Check completion signals
        const completion = detectUtteranceComplete(transcript);
        
        // Set timer based on completion confidence
        const timeout = completion.isComplete && completion.confidence === 'high' 
          ? 1500 
          : 2500;
        
        silenceTimerRef.current = setTimeout(() => {
          if (!hasCompletedRef.current && wordCount >= 2) {
            handleDone();
          }
        }, timeout);
      }
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
        <CardContent className="p-4 h-32 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

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

        {/* Status */}
        <div className="text-center space-y-3">
          {phase === 'listening' && (
            <>
              <div className={cn(
                "text-lg font-medium min-h-[56px] max-w-xs mx-auto",
                transcript ? "text-foreground" : "text-muted-foreground"
              )}>
                {transcript || 'Describe it...'}
              </div>
              {isListening && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Listening...</span>
                </div>
              )}
              {wordCount >= 2 && (
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
              <span className="font-medium">Nice description!</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
