/**
 * PhraseStarterCard - Enhanced starter phrase selection with visual builder
 * 
 * Features:
 * - Audio playback when selecting starters
 * - Visual sentence builder (starter + continuation)
 * - Smart continuation detection (wait for 3+ words)
 * - Follow-up starter suggestions
 * - Beautiful, accessible UI
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Volume2, Plus, Loader2 } from 'lucide-react';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { 
  CardContainer, 
  SpeechStatusBar, 
  AudioButton, 
  SuccessAnimation,
  LargeTouchButton,
  SentenceBuilder
} from './CardComponents';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface PhraseStarterCardResult {
  success: boolean;
  starterUsed: string;
  continuation: string;
  latencyMs: number | null;
  usedFollowUp?: boolean;
}

interface PhraseStarterCardProps {
  difficulty: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: PhraseStarterCardResult) => void;
}

// Starter phrase sets with follow-ups
const STARTER_SETS = [
  {
    starters: ["I was thinking about...", "I remember...", "The thing is..."],
    followUps: ["And then...", "Also..."],
  },
  {
    starters: ["What I mean is...", "It's kind of like...", "I wanted to say..."],
    followUps: ["Because...", "So..."],
  },
  {
    starters: ["One thing I know is...", "I noticed that...", "It made me think..."],
    followUps: ["And...", "Which means..."],
  },
  {
    starters: ["Actually...", "Well...", "So..."],
    followUps: ["And then...", "But..."],
  },
];

export function PhraseStarterCard({ difficulty, transcript, isListening, onComplete }: PhraseStarterCardProps) {
  const [phase, setPhase] = useState<'choosing' | 'listening' | 'followUp' | 'complete'>('choosing');
  const [starterSet] = useState(() => STARTER_SETS[Math.floor(Math.random() * STARTER_SETS.length)]);
  const [selectedStarter, setSelectedStarter] = useState<string>('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [usedFollowUp, setUsedFollowUp] = useState(false);
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number | null>(null);
  const firstWordTimeRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  const handleSelectStarter = (starter: string) => {
    setSelectedStarter(starter);
    startTimeRef.current = Date.now();
    firstWordTimeRef.current = null;
    setPhase('listening');
    
    // Speak the starter to help user
    playPhrase(starter, { playbackSpeed: 0.9 });
  };

  // Track first word timing
  useEffect(() => {
    if (phase === 'listening' && !firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
    }
  }, [transcript, phase]);

  const handleDone = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
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
        usedFollowUp,
      });
    }, 600);
  }, [transcript, selectedStarter, usedFollowUp, onComplete]);

  // Handle follow-up starter
  const handleFollowUp = (followUp: string) => {
    setUsedFollowUp(true);
    setShowFollowUp(false);
    playPhrase(followUp, { playbackSpeed: 0.9 });
  };

  // Smart auto-complete with silence detection
  useEffect(() => {
    if (hasCompletedRef.current || phase !== 'listening') return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Wait for at least 3 words before considering complete
    if (wordCount >= 3) {
      if (transcript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = transcript;
        
        const completion = detectUtteranceComplete(transcript);
        
        const timeout = completion.isComplete && completion.confidence === 'high' 
          ? 1500 
          : 3000;
        
        silenceTimerRef.current = setTimeout(() => {
          if (!hasCompletedRef.current && wordCount >= 3) {
            // Offer follow-up instead of immediate completion
            if (!showFollowUp) {
              setShowFollowUp(true);
              
              // Auto-complete after showing follow-up for a bit
              followUpTimerRef.current = setTimeout(() => {
                if (!hasCompletedRef.current) {
                  handleDone();
                }
              }, 4000);
            }
          }
        }, timeout);
      }
    } else if (wordCount >= 1) {
      // For shorter responses, wait longer
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          handleDone();
        }
      }, 4000);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, phase, showFollowUp, handleDone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (followUpTimerRef.current) clearTimeout(followUpTimerRef.current);
    };
  }, []);

  const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <CardContainer>
      <CardContent className="p-5 space-y-4">
        {/* Phase: Choosing starter */}
        {phase === 'choosing' && (
          <div className="space-y-4">
            <p className="text-center text-lg font-medium text-foreground">
              Pick one to start with
            </p>
            <div className="space-y-2">
              {starterSet.starters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectStarter(starter)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3",
                    "px-4 py-4 rounded-xl",
                    "bg-muted/50 hover:bg-primary/10 border-2 border-transparent",
                    "hover:border-primary/30 transition-all",
                    "text-left min-h-[56px]"
                  )}
                >
                  <span className="text-base font-medium">{starter}</span>
                  <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase: Listening */}
        {phase === 'listening' && (
          <div className="space-y-4">
            {/* Visual sentence builder */}
            <SentenceBuilder 
              starter={selectedStarter} 
              continuation={transcript} 
            />

            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={wordCount}
              showWordCount={wordCount > 0}
            />

            {/* Follow-up suggestion */}
            {showFollowUp && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-center text-sm text-muted-foreground">
                  Want to add more?
                </p>
                <div className="flex justify-center gap-2">
                  {starterSet.followUps.map((followUp, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleFollowUp(followUp)}
                      className="gap-1 min-h-[40px]"
                    >
                      <Plus className="w-3 h-3" />
                      {followUp}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Done button - show after any speech */}
            {wordCount >= 1 && (
              <div className="flex justify-center">
                <LargeTouchButton 
                  onClick={handleDone} 
                  variant="success"
                  icon={<Check className="w-5 h-5" />}
                >
                  Done
                </LargeTouchButton>
              </div>
            )}
          </div>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && (
          <SuccessAnimation 
            message="Nice start!"
            subMessage={wordCount >= 5 ? "Great continuation!" : undefined}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
