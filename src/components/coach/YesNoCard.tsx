/**
 * YesNoCard - Enhanced yes/no question interaction
 * 
 * Features:
 * - Auto-speak question on mount
 * - Large, accessible buttons (60px tall)
 * - Voice confirmation before completing
 * - Skip option for sensitive questions
 * - Replay button to hear again
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Volume2, SkipForward, RotateCcw } from 'lucide-react';
import { getRandomYesNoQuestion } from '@/data/yesNoBank';
import { 
  CardContainer, 
  SpeechStatusBar, 
  SuccessAnimation,
  SkipButton,
  AudioButton
} from './CardComponents';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface YesNoCardProps {
  difficulty?: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: { answered: boolean; response: 'yes' | 'no' | 'skip' | 'other'; latencyMs: number }) => void;
}

export function YesNoCard({ transcript, isListening, onComplete }: YesNoCardProps) {
  const [question] = useState(() => getRandomYesNoQuestion());
  const [phase, setPhase] = useState<'listening' | 'confirming' | 'complete'>('listening');
  const [detectedResponse, setDetectedResponse] = useState<'yes' | 'no' | 'other' | null>(null);
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number>(Date.now());
  const hasCompletedRef = useRef(false);
  const hasPlayedAudioRef = useRef(false);

  // Auto-speak question on mount
  useEffect(() => {
    if (!hasPlayedAudioRef.current) {
      hasPlayedAudioRef.current = true;
      // Small delay to let card render first
      const timer = setTimeout(() => {
        playPhrase(question.question, { playbackSpeed: 0.85 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [question.question, playPhrase]);

  // Analyze transcript for yes/no
  const analyzeResponse = useCallback((text: string): 'yes' | 'no' | 'other' => {
    const lower = text.toLowerCase().trim();
    const yesWords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'uh-huh', 'mhm', 'correct', 'right', 'okay', 'ok', 'definitely', 'absolutely'];
    const noWords = ['no', 'nope', 'nah', 'not', 'never', 'uh-uh', 'don\'t', 'doesn\'t', 'didn\'t'];
    
    for (const word of yesWords) {
      if (lower.includes(word)) return 'yes';
    }
    for (const word of noWords) {
      if (lower.includes(word)) return 'no';
    }
    
    return text.length > 0 ? 'other' : 'other';
  }, []);

  const completeWithResponse = useCallback((response: 'yes' | 'no' | 'skip' | 'other') => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    setDetectedResponse(response === 'skip' ? null : (response as 'yes' | 'no' | 'other'));
    setPhase('complete');
    
    const latencyMs = Date.now() - startTimeRef.current;
    
    setTimeout(() => {
      onComplete({
        answered: response !== 'skip',
        response,
        latencyMs,
      });
    }, 600);
  }, [onComplete]);

  // Watch transcript for response
  useEffect(() => {
    if (hasCompletedRef.current || !transcript.trim()) return;

    const response = analyzeResponse(transcript);
    
    // If clear yes/no, show confirmation briefly then complete
    if (response !== 'other') {
      setDetectedResponse(response);
      setPhase('confirming');
      
      // Auto-confirm after showing what we heard
      const timer = setTimeout(() => {
        if (!hasCompletedRef.current) {
          completeWithResponse(response);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // If they've said several words without clear yes/no, let them finish
    if (transcript.split(/\s+/).length >= 4) {
      setPhase('confirming');
      setDetectedResponse('other');
    }
  }, [transcript, analyzeResponse, completeWithResponse]);

  // Manual button responses
  const handleManualResponse = (response: 'yes' | 'no') => {
    if (hasCompletedRef.current) return;
    completeWithResponse(response);
  };

  // Skip handler
  const handleSkip = () => {
    if (hasCompletedRef.current) return;
    completeWithResponse('skip');
  };

  // Replay audio
  const handleReplay = () => {
    playPhrase(question.question, { playbackSpeed: 0.85 });
  };

  // Confirm current response
  const handleConfirm = () => {
    if (detectedResponse) {
      completeWithResponse(detectedResponse);
    }
  };

  return (
    <CardContainer>
      <CardContent className="p-5 space-y-5">
        {/* Question with audio indicator */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AudioButton
              onPlay={handleReplay}
              isPlaying={isPlaying}
              isLoading={audioLoading}
              label=""
              size="sm"
              variant="ghost"
            />
            <p className="text-xl font-medium text-foreground flex-1 pt-1">
              {question.question}
            </p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Say yes or no, or tap below
          </p>
        </div>

        {/* Phase: Listening - Show buttons */}
        {phase === 'listening' && (
          <div className="space-y-4">
            {/* Live transcript */}
            {transcript && (
              <div className="text-center">
                <p className="text-lg font-medium text-foreground bg-muted/50 rounded-lg px-4 py-2 inline-block">
                  {transcript}
                </p>
              </div>
            )}
            
            {/* Large YES/NO buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleManualResponse('yes')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2",
                  "min-h-[72px] rounded-xl font-semibold text-lg",
                  "bg-green-500/10 hover:bg-green-500/20 border-2 border-green-500/30",
                  "text-green-700 dark:text-green-400",
                  "transition-all active:scale-95"
                )}
              >
                <ThumbsUp className="w-6 h-6" />
                <span>Yes</span>
              </button>
              <button
                onClick={() => handleManualResponse('no')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2",
                  "min-h-[72px] rounded-xl font-semibold text-lg",
                  "bg-muted/50 hover:bg-muted border-2 border-border",
                  "text-foreground",
                  "transition-all active:scale-95"
                )}
              >
                <ThumbsDown className="w-6 h-6" />
                <span>No</span>
              </button>
            </div>

            {/* Status bar */}
            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={transcript.split(/\s+/).filter(Boolean).length}
              showWordCount={false}
            />

            {/* Skip option */}
            <div className="flex justify-center">
              <SkipButton onSkip={handleSkip} label="Skip this question" />
            </div>
          </div>
        )}

        {/* Phase: Confirming - Show what we heard */}
        {phase === 'confirming' && detectedResponse && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
                {detectedResponse === 'yes' && <ThumbsUp className="w-5 h-5" />}
                {detectedResponse === 'no' && <ThumbsDown className="w-5 h-5" />}
                <span className="font-medium capitalize">
                  Heard: {detectedResponse === 'other' ? `"${transcript}"` : detectedResponse}
                </span>
              </div>
            </div>
            
            {/* If unclear, show confirm/retry buttons */}
            {detectedResponse === 'other' && (
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleReplay} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Try again
                </Button>
                <Button onClick={handleConfirm} className="gap-2">
                  Continue
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Phase: Complete */}
        {phase === 'complete' && (
          <SuccessAnimation 
            message="Got it!"
            subMessage={detectedResponse ? `You said ${detectedResponse}` : 'Skipped'}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
