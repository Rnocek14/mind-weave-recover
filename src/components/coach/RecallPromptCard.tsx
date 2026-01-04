/**
 * RecallPromptCard - Enhanced category word retrieval
 * 
 * Features:
 * - Audio prompt on mount
 * - Basic category validation with encouraging feedback
 * - Show examples after struggle period
 * - Option to say multiple words
 * - Beautiful success animation
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Plus, Sparkles } from 'lucide-react';
import { getRandomRecallPrompt, RecallPrompt } from '@/data/recallPromptBank';
import { 
  CardContainer, 
  SpeechStatusBar, 
  AudioButton, 
  SuccessAnimation,
  TranscriptDisplay,
  LargeTouchButton,
  HintChip
} from './CardComponents';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface RecallPromptCardProps {
  difficulty?: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: { success: boolean; words: string[]; latencyMs: number; category: string }) => void;
}

export function RecallPromptCard({ difficulty = 'easy', transcript, isListening, onComplete }: RecallPromptCardProps) {
  const [prompt] = useState<RecallPrompt>(() => getRandomRecallPrompt(difficulty));
  const [phase, setPhase] = useState<'listening' | 'moreWords' | 'complete'>('listening');
  const [spokenWords, setSpokenWords] = useState<string[]>([]);
  const [showExamples, setShowExamples] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number>(Date.now());
  const hasCompletedRef = useRef(false);
  const hasPlayedAudioRef = useRef(false);
  const exampleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-speak prompt on mount
  useEffect(() => {
    if (!hasPlayedAudioRef.current) {
      hasPlayedAudioRef.current = true;
      const timer = setTimeout(() => {
        playPhrase(prompt.prompt, { playbackSpeed: 0.85 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [prompt.prompt, playPhrase]);

  // Show examples after 5 seconds of silence
  useEffect(() => {
    exampleTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && spokenWords.length === 0) {
        setShowExamples(true);
      }
    }, 5000);
    
    return () => {
      if (exampleTimerRef.current) clearTimeout(exampleTimerRef.current);
    };
  }, [spokenWords.length]);

  // Validate word against category
  const validateWord = useCallback((word: string): boolean => {
    const cleanWord = word.toLowerCase().trim();
    // Check if word is in examples (basic validation)
    return prompt.examples.some(ex => 
      cleanWord.includes(ex.toLowerCase()) || ex.toLowerCase().includes(cleanWord)
    );
  }, [prompt.examples]);

  // Process spoken words from transcript
  const extractWords = useCallback((text: string): string[] => {
    return text.trim().split(/\s+/).filter(w => w.length >= 2);
  }, []);

  const handleComplete = useCallback((words: string[]) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    // Determine success message based on validation
    const anyValid = words.some(w => validateWord(w));
    if (anyValid) {
      setValidationMessage("Perfect! That's exactly right.");
    } else if (words.length > 0) {
      setValidationMessage("That's interesting! Good thinking.");
    } else {
      setValidationMessage("Nice effort!");
    }
    
    setSpokenWords(words);
    setPhase('complete');

    setTimeout(() => {
      onComplete({
        success: words.length > 0,
        words,
        latencyMs,
        category: prompt.category,
      });
    }, 800);
  }, [validateWord, prompt.category, onComplete]);

  // Handle done - finish with current words
  const handleDone = () => {
    const words = extractWords(transcript);
    handleComplete(words);
  };

  // Handle "say another" - stay in listening mode
  const handleSayAnother = () => {
    const words = extractWords(transcript);
    setSpokenWords(prev => [...prev, ...words]);
    setPhase('moreWords');
  };

  // Replay audio
  const handleReplay = () => {
    playPhrase(prompt.prompt, { playbackSpeed: 0.85 });
  };

  // Watch transcript and auto-complete after silence
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const words = extractWords(transcript);
    if (words.length >= 1) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          // Ask if they want to say more
          if (phase === 'listening') {
            setPhase('moreWords');
          }
        }
      }, 2500);
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [transcript, phase, extractWords]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (exampleTimerRef.current) clearTimeout(exampleTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const currentWords = extractWords(transcript);
  const allWords = [...spokenWords, ...currentWords];

  return (
    <CardContainer>
      <CardContent className="p-5 space-y-4">
        {/* Category icon and prompt */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          
          <div className="flex items-center gap-2">
            <AudioButton
              onPlay={handleReplay}
              isPlaying={isPlaying}
              isLoading={audioLoading}
              label=""
              size="sm"
              variant="ghost"
            />
            <p className="text-xl font-medium text-foreground">{prompt.prompt}</p>
          </div>
          
          <p className="text-sm text-muted-foreground">Any word is great!</p>
        </div>

        {/* Listening phase */}
        {(phase === 'listening' || phase === 'moreWords') && (
          <div className="space-y-4">
            {/* Show accumulated words */}
            {allWords.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {allWords.map((word, i) => (
                  <span 
                    key={i}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      validateWord(word) 
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30"
                        : "bg-primary/10 text-primary border border-primary/30"
                    )}
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}

            {/* Live transcript for new words */}
            {phase === 'listening' && (
              <TranscriptDisplay 
                transcript={transcript}
                placeholder="..."
                minHeight="min-h-[40px]"
              />
            )}

            {/* Example hint */}
            {showExamples && allWords.length === 0 && (
              <div className="flex justify-center">
                <HintChip 
                  hint={`Like: ${prompt.examples.slice(0, 3).join(', ')}...`}
                  type="semantic"
                />
              </div>
            )}

            {/* Status */}
            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={currentWords.length}
              showWordCount={false}
            />

            {/* Action buttons */}
            <div className="flex flex-col items-center gap-3">
              {currentWords.length > 0 && phase === 'listening' && (
                <LargeTouchButton 
                  onClick={handleDone} 
                  variant="success"
                  icon={<Check className="w-5 h-5" />}
                >
                  Done
                </LargeTouchButton>
              )}
              
              {phase === 'moreWords' && (
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleSayAnother}
                    className="gap-2 min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    Say another
                  </Button>
                  <LargeTouchButton 
                    onClick={handleDone} 
                    variant="success"
                    icon={<Check className="w-5 h-5" />}
                  >
                    All done
                  </LargeTouchButton>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Complete phase */}
        {phase === 'complete' && (
          <SuccessAnimation 
            message="Nice!"
            subMessage={validationMessage}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
