/**
 * PhotoNamingCard - Enhanced inline photo-naming exercise
 * 
 * Features:
 * - Large, clear image display (280px)
 * - "Hear it" audio button using TTS
 * - Progressive cues (semantic → phonemic)
 * - Touch choice fallback after timeout
 * - Retry option for unclear responses
 * - Clinical feedback using feedbackGenerator
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, RotateCcw, Lightbulb, Volume2, Loader2 } from 'lucide-react';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { 
  CardContainer, 
  SpeechStatusBar, 
  AudioButton, 
  SuccessAnimation,
  HintChip,
  TranscriptDisplay,
  LargeTouchButton,
  ChoiceButtonGrid
} from './CardComponents';
import { generateSemanticCue, generatePhonologicalCue } from '@/lib/cueGenerator';
import { generateGentleFeedback } from '@/lib/feedbackGenerator';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface PhotoNamingCardResult {
  success: boolean;
  spokenWord: string;
  targetWord: string;
  latencyMs: number | null;
  cueUsed?: string;
  usedAudio?: boolean;
  usedChoices?: boolean;
}

interface PhotoNamingCardProps {
  difficulty?: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: PhotoNamingCardResult) => void;
}

// Generate 3 choices including the correct answer
function generateChoices(target: string, allTrials: PhotoTrial[]): string[] {
  const distractors = allTrials
    .filter(t => t.target.toLowerCase() !== target.toLowerCase())
    .map(t => t.target)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  
  const choices = [target, ...distractors].sort(() => Math.random() - 0.5);
  return choices;
}

export function PhotoNamingCard({ 
  difficulty = 'easy',
  transcript, 
  isListening, 
  onComplete 
}: PhotoNamingCardProps) {
  const [phase, setPhase] = useState<'listening' | 'retry' | 'complete'>('listening');
  const [trial, setTrial] = useState<PhotoTrial | null>(null);
  const [currentCue, setCurrentCue] = useState<{ text: string; type: 'semantic' | 'phonemic' } | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  const [choices, setChoices] = useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [usedAudio, setUsedAudio] = useState(false);
  const [usedChoices, setUsedChoices] = useState(false);
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const choiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  // Select a photo on mount
  useEffect(() => {
    const maxDifficulty = difficulty === 'easy' ? 2 : 3;
    const photos = PHOTO_BANK.filter(p => p.computed_difficulty <= maxDifficulty);
    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    setTrial(randomPhoto);
    setChoices(generateChoices(randomPhoto.target, photos));
    startTimeRef.current = Date.now();
    
    // Set up progressive cue timers
    cueTimerRef.current = setTimeout(() => {
      // Show semantic cue after 5 seconds
      if (!hasCompletedRef.current && randomPhoto) {
        const semanticCueText = generateSemanticCue(randomPhoto.category, randomPhoto.target);
        setCurrentCue({ text: semanticCueText, type: 'semantic' });
        
        // Show phonemic cue after 8 more seconds
        cueTimerRef.current = setTimeout(() => {
          if (!hasCompletedRef.current) {
            const phonemicCueText = generatePhonologicalCue(randomPhoto.target);
            setCurrentCue({ text: phonemicCueText, type: 'phonemic' });
          }
        }, 5000);
      }
    }, 5000);
    
    // Show choice fallback after 10 seconds
    choiceTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        setShowChoices(true);
      }
    }, 10000);
    
    return () => {
      if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
      if (choiceTimerRef.current) clearTimeout(choiceTimerRef.current);
    };
  }, [difficulty]);

  // Check if response matches target
  const checkMatch = useCallback((spoken: string, target: string): { isMatch: boolean; quality: 'exact' | 'partial' | 'attempt' } => {
    const spokenLower = spoken.toLowerCase().trim();
    const targetLower = target.toLowerCase();
    
    if (spokenLower === targetLower || spokenLower.includes(targetLower)) {
      return { isMatch: true, quality: 'exact' };
    }
    
    // Check for partial match (first syllable or similar)
    if (targetLower.startsWith(spokenLower.slice(0, 3)) || spokenLower.startsWith(targetLower.slice(0, 3))) {
      return { isMatch: true, quality: 'partial' };
    }
    
    // Any speech is an attempt
    if (spokenLower.length >= 2) {
      return { isMatch: false, quality: 'attempt' };
    }
    
    return { isMatch: false, quality: 'attempt' };
  }, []);

  const handleComplete = useCallback((spoken: string, wasChoice: boolean = false) => {
    if (hasCompletedRef.current || !trial) return;
    hasCompletedRef.current = true;
    
    const match = checkMatch(spoken, trial.target);
    
    // Generate appropriate feedback
    let feedback = "Got it!";
    if (match.quality === 'exact') {
      feedback = `Perfect! "${trial.target}"`;
    } else if (match.quality === 'partial') {
      feedback = generateGentleFeedback('attempted', trial.target, spoken);
    } else {
      feedback = `The word is "${trial.target}". Good try!`;
    }
    
    setFeedbackMessage(feedback);
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current 
      ? firstWordTimeRef.current - startTimeRef.current
      : null;

    setTimeout(() => {
      onComplete({
        success: match.isMatch || match.quality === 'partial',
        spokenWord: spoken,
        targetWord: trial.target,
        latencyMs,
        cueUsed: currentCue?.text,
        usedAudio,
        usedChoices: wasChoice || usedChoices,
      });
    }, 800);
  }, [trial, checkMatch, currentCue, usedAudio, usedChoices, onComplete]);

  // Handle manual done (with potential retry)
  const handleDone = useCallback(() => {
    if (!trial || hasCompletedRef.current) return;
    
    const match = checkMatch(transcript, trial.target);
    
    // If unclear match and user has spoken, offer retry
    if (!match.isMatch && transcript.trim().length > 0 && phase !== 'retry') {
      setPhase('retry');
      return;
    }
    
    handleComplete(transcript);
  }, [trial, transcript, phase, checkMatch, handleComplete]);

  // Handle choice selection
  const handleChoiceSelect = (choice: string) => {
    setUsedChoices(true);
    handleComplete(choice, true);
  };

  // Handle retry attempt
  const handleRetry = () => {
    setPhase('listening');
    startTimeRef.current = Date.now();
    firstWordTimeRef.current = null;
  };

  // Handle audio playback
  const handlePlayAudio = () => {
    if (trial) {
      setUsedAudio(true);
      playPhrase(trial.target, { playbackSpeed: 0.8 });
    }
  };

  // Handle hint request
  const handleRequestHint = () => {
    if (!trial || currentCue) return;
    const semanticCueText = generateSemanticCue(trial.category, trial.target);
    setCurrentCue({ text: semanticCueText, type: 'semantic' });
  };

  // Track first word timing
  useEffect(() => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
  }, [transcript]);

  // Auto-complete after speech detection + silence
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 1 && trial) {
      const match = checkMatch(transcript, trial.target);
      
      // If good match, complete faster
      const timeout = match.isMatch ? 1500 : 2500;
      
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          if (match.isMatch) {
            handleComplete(transcript);
          } else if (phase !== 'retry') {
            setPhase('retry');
          }
        }
      }, timeout);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, phase, trial, checkMatch, handleComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
      if (choiceTimerRef.current) clearTimeout(choiceTimerRef.current);
    };
  }, []);

  if (!trial) {
    return (
      <Card className="bg-muted/50 animate-pulse">
        <CardContent className="p-4 h-64" />
      </Card>
    );
  }

  const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <CardContainer>
      <CardContent className="p-5 space-y-4">
        {/* Photo - larger display */}
        <div className="relative aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden bg-muted shadow-md">
          <img
            src={trial.imageUrl}
            alt="What is this?"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Prompt */}
        <p className="text-center text-lg font-medium text-foreground">
          What is this?
        </p>

        {/* Action buttons row */}
        <div className="flex justify-center gap-3">
          <AudioButton 
            onPlay={handlePlayAudio}
            isPlaying={isPlaying}
            isLoading={audioLoading}
            label="Hear it"
            size="sm"
          />
          {!currentCue && (
            <Button 
              variant="outline" 
              onClick={handleRequestHint}
              className="h-10 gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              Get a hint
            </Button>
          )}
        </div>

        {/* Cue display */}
        {currentCue && (
          <div className="flex justify-center">
            <HintChip hint={currentCue.text} type={currentCue.type} />
          </div>
        )}

        {/* Status based on phase */}
        {phase === 'listening' && (
          <div className="space-y-3">
            <TranscriptDisplay 
              transcript={transcript} 
              placeholder="Say the word..."
            />
            
            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={wordCount}
              showWordCount={false}
            />

            {/* Choice fallback */}
            {showChoices && (
              <div className="space-y-2">
                <p className="text-center text-sm text-muted-foreground">
                  Or tap the correct word:
                </p>
                <ChoiceButtonGrid 
                  choices={choices} 
                  onSelect={handleChoiceSelect}
                />
              </div>
            )}

            {/* Done button */}
            {wordCount > 0 && (
              <div className="flex justify-center">
                <LargeTouchButton onClick={handleDone} variant="success" icon={<Check className="w-5 h-5" />}>
                  Done
                </LargeTouchButton>
              </div>
            )}
          </div>
        )}

        {/* Retry phase */}
        {phase === 'retry' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                I heard: <span className="font-medium text-foreground">"{transcript}"</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Try again or confirm if correct
              </p>
            </div>
            
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleRetry} className="gap-2 min-h-[44px]">
                <RotateCcw className="w-4 h-4" />
                Try again
              </Button>
              <LargeTouchButton onClick={() => handleComplete(transcript)} variant="primary">
                That's right
              </LargeTouchButton>
            </div>
            
            {/* Also show choices in retry */}
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                Or select:
              </p>
              <ChoiceButtonGrid 
                choices={choices} 
                onSelect={handleChoiceSelect}
              />
            </div>
          </div>
        )}

        {/* Complete phase */}
        {phase === 'complete' && (
          <SuccessAnimation 
            message={feedbackMessage}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
