/**
 * PhotoNamingCard — "Invisible" photo naming exercise
 * 
 * Feels like Maya showing a photo in conversation, not launching a game.
 * User sees image → knows instantly what to do → responds → moves on.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardContent } from '@/components/ui/card';
import { Check, RotateCcw, Lightbulb } from 'lucide-react';
import { PHOTO_BANK, PhotoTrial } from '@/data/photoBank';
import { 
  CardContainer, 
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

function generateChoices(target: string, allTrials: PhotoTrial[]): string[] {
  const distractors = allTrials
    .filter(t => t.target.toLowerCase() !== target.toLowerCase())
    .map(t => t.target)
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);
  return [target, ...distractors].sort(() => Math.random() - 0.5);
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
  const transcriptRef = useRef(transcript);

  // Preload photo image immediately on mount
  useEffect(() => {
    const maxDifficulty = difficulty === 'easy' ? 2 : 3;
    const photos = PHOTO_BANK.filter(p => p.computed_difficulty <= maxDifficulty);
    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    
    // Preload the image before showing the card
    const img = new Image();
    img.onload = () => {
      setTrial(randomPhoto);
      setChoices(generateChoices(randomPhoto.target, photos));
      startTimeRef.current = Date.now();
    };
    img.onerror = () => {
      // Still show the card even if image fails to load
      setTrial(randomPhoto);
      setChoices(generateChoices(randomPhoto.target, photos));
      startTimeRef.current = Date.now();
    };
    img.src = randomPhoto.imageUrl;
    
    // Safety: if image takes > 3s to load, show card anyway
    const safetyTimer = setTimeout(() => {
      if (!trial) {
        setTrial(randomPhoto);
        setChoices(generateChoices(randomPhoto.target, photos));
        startTimeRef.current = Date.now();
      }
    }, 3000);
    
    cueTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && randomPhoto) {
        const semanticCueText = generateSemanticCue(randomPhoto.category, randomPhoto.target);
        setCurrentCue({ text: semanticCueText, type: 'semantic' });
        
        cueTimerRef.current = setTimeout(() => {
          if (!hasCompletedRef.current) {
            const phonemicCueText = generatePhonologicalCue(randomPhoto.target);
            setCurrentCue({ text: phonemicCueText, type: 'phonemic' });
          }
        }, 5000);
      }
    }, 5000);
    
    choiceTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) setShowChoices(true);
    }, 10000);

    // Global card timeout — auto-complete after 20s to prevent dead state
    const globalTimeout = setTimeout(() => {
      if (!hasCompletedRef.current && randomPhoto) {
        const spoken = transcript?.trim() || '';
        handleComplete(spoken.length > 0 ? spoken : randomPhoto.target, true);
      }
    }, 20000);
    
    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(globalTimeout);
      if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
      if (choiceTimerRef.current) clearTimeout(choiceTimerRef.current);
    };
  }, [difficulty]);

  const checkMatch = useCallback((spoken: string, target: string) => {
    const s = spoken.toLowerCase().trim();
    const t = target.toLowerCase();
    
    // Exact match
    if (s === t || s.includes(t)) return { isMatch: true, quality: 'exact' as const };
    
    // Strip common speech prefixes like "it's a", "that's a", "a", "the", "its a"
    const stripped = s
      .replace(/^(it'?s\s+a\s+|that'?s\s+a\s+|i\s+see\s+a\s+|looks?\s+like\s+a?\s*|a\s+|the\s+|an\s+)/i, '')
      .trim();
    if (stripped === t || stripped.includes(t)) return { isMatch: true, quality: 'exact' as const };
    
    // Check if target appears as a word in the spoken text (not just substring)
    const spokenWords = s.split(/\s+/);
    if (spokenWords.includes(t)) return { isMatch: true, quality: 'exact' as const };
    
    // Partial prefix match (first 3+ chars)
    if (stripped.length >= 3 && (t.startsWith(stripped.slice(0, 3)) || stripped.startsWith(t.slice(0, 3)))) {
      return { isMatch: true, quality: 'partial' as const };
    }
    
    if (s.length >= 2) return { isMatch: false, quality: 'attempt' as const };
    return { isMatch: false, quality: 'attempt' as const };
  }, []);

  const handleComplete = useCallback((spoken: string, wasChoice = false) => {
    if (hasCompletedRef.current || !trial) return;
    hasCompletedRef.current = true;
    
    const match = checkMatch(spoken, trial.target);
    let feedback = "Got it!";
    if (match.quality === 'exact') feedback = `"${trial.target}" ✓`;
    else if (match.quality === 'partial') feedback = generateGentleFeedback('attempted', trial.target, spoken);
    else feedback = `The word is "${trial.target}"`;
    
    setFeedbackMessage(feedback);
    setPhase('complete');

    const latencyMs = firstWordTimeRef.current ? firstWordTimeRef.current - startTimeRef.current : null;

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
    }, 600);
  }, [trial, checkMatch, currentCue, usedAudio, usedChoices, onComplete]);

  const handleDone = useCallback(() => {
    if (!trial || hasCompletedRef.current) return;
    const match = checkMatch(transcript, trial.target);
    if (!match.isMatch && transcript.trim().length > 0 && phase !== 'retry') {
      setPhase('retry');
      return;
    }
    handleComplete(transcript);
  }, [trial, transcript, phase, checkMatch, handleComplete]);

  const handleChoiceSelect = (choice: string) => {
    setUsedChoices(true);
    handleComplete(choice, true);
  };

  const handleRetry = () => {
    setPhase('listening');
    startTimeRef.current = Date.now();
    firstWordTimeRef.current = null;
  };

  const handlePlayAudio = () => {
    if (trial) {
      setUsedAudio(true);
      playPhrase(trial.target, { playbackSpeed: 0.8 });
    }
  };

  const handleRequestHint = () => {
    if (!trial || currentCue) return;
    const semanticCueText = generateSemanticCue(trial.category, trial.target);
    setCurrentCue({ text: semanticCueText, type: 'semantic' });
  };

  useEffect(() => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
  }, [transcript]);

  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 1 && trial) {
      const match = checkMatch(transcript, trial.target);
      const timeout = match.isMatch ? 800 : 1500;
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          if (match.isMatch) handleComplete(transcript);
          else if (phase !== 'retry') setPhase('retry');
        }
      }, timeout);
    }

    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [transcript, phase, trial, checkMatch, handleComplete]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (cueTimerRef.current) clearTimeout(cueTimerRef.current);
      if (choiceTimerRef.current) clearTimeout(choiceTimerRef.current);
    };
  }, []);

  if (!trial) return null;

  const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <CardContainer>
      <CardContent className="p-0">
        {/* Photo — the hero element, clean and prominent */}
        <div className="relative overflow-hidden rounded-t-2xl">
          <img
            src={trial.imageUrl}
            alt="What is this?"
            className="w-full aspect-[16/10] object-cover"
            draggable={false}
          />
          {/* Subtle gradient overlay at bottom for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
          
          {/* Audio + Hint floating over image bottom-right */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            <AudioButton 
              onPlay={handlePlayAudio}
              isPlaying={isPlaying}
              isLoading={audioLoading}
              label=""
              size="sm"
            />
            {!currentCue && (
              <button
                onClick={handleRequestHint}
                className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Lightbulb className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Interaction area — compact, below photo */}
        <div className="px-4 py-3 space-y-2">
          {/* Prompt — minimal */}
          <p className="text-sm text-muted-foreground text-center">
            What is this?
          </p>

          {/* Cue */}
          {currentCue && (
            <div className="flex justify-center">
              <HintChip hint={currentCue.text} type={currentCue.type} />
            </div>
          )}

          {/* Listening phase */}
          {phase === 'listening' && (
            <div className="space-y-2">
              {showChoices ? (
                <ChoiceButtonGrid choices={choices} onSelect={handleChoiceSelect} />
              ) : (
                <TranscriptDisplay 
                  transcript={transcript} 
                  placeholder="Say the word..."
                  minHeight="min-h-[24px]"
                />
              )}

              {wordCount > 0 && (
                <div className="flex justify-center">
                  <LargeTouchButton onClick={handleDone} variant="success" icon={<Check className="w-4 h-4" />}>
                    Done
                  </LargeTouchButton>
                </div>
              )}
            </div>
          )}

          {/* Retry phase */}
          {phase === 'retry' && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <p className="text-center text-xs text-muted-foreground">
                I heard: <span className="font-medium text-foreground">"{transcript}"</span>
              </p>
              <div className="flex justify-center gap-2">
                <LargeTouchButton onClick={handleRetry} variant="outline" icon={<RotateCcw className="w-3.5 h-3.5" />}>
                  Retry
                </LargeTouchButton>
                <LargeTouchButton onClick={() => handleComplete(transcript)} variant="primary">
                  That's right
                </LargeTouchButton>
              </div>
              <ChoiceButtonGrid choices={choices} onSelect={handleChoiceSelect} />
            </div>
          )}

          {/* Complete */}
          {phase === 'complete' && (
            <SuccessAnimation message={feedbackMessage} />
          )}
        </div>
      </CardContent>
    </CardContainer>
  );
}
