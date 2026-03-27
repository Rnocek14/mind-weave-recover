/**
 * YesNoCard — Feels like Maya asking a conversational question,
 * not presenting a quiz. Buttons are clear, response is instant.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { getRandomYesNoQuestion } from '@/data/yesNoBank';
import { 
  CardContainer, 
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

  useEffect(() => {
    if (!hasPlayedAudioRef.current) {
      hasPlayedAudioRef.current = true;
      const timer = setTimeout(() => {
        playPhrase(question.question, { playbackSpeed: 0.85 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [question.question, playPhrase]);

  const analyzeResponse = useCallback((text: string): 'yes' | 'no' | 'other' => {
    const lower = text.toLowerCase().trim();
    const yesWords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'uh-huh', 'mhm', 'correct', 'right', 'okay', 'ok', 'definitely', 'absolutely'];
    const noWords = ['no', 'nope', 'nah', 'not', 'never', 'uh-uh', 'don\'t', 'doesn\'t', 'didn\'t'];
    for (const word of yesWords) { if (lower.includes(word)) return 'yes'; }
    for (const word of noWords) { if (lower.includes(word)) return 'no'; }
    return 'other';
  }, []);

  const completeWithResponse = useCallback((response: 'yes' | 'no' | 'skip' | 'other') => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setDetectedResponse(response === 'skip' ? null : (response as 'yes' | 'no' | 'other'));
    setPhase('complete');
    const latencyMs = Date.now() - startTimeRef.current;
    setTimeout(() => {
      onComplete({ answered: response !== 'skip', response, latencyMs });
    }, 500);
  }, [onComplete]);

  useEffect(() => {
    if (hasCompletedRef.current || !transcript.trim()) return;
    const response = analyzeResponse(transcript);
    if (response !== 'other') {
      setDetectedResponse(response);
      setPhase('confirming');
      const timer = setTimeout(() => {
        if (!hasCompletedRef.current) completeWithResponse(response);
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (transcript.split(/\s+/).length >= 4) {
      setPhase('confirming');
      setDetectedResponse('other');
    }
  }, [transcript, analyzeResponse, completeWithResponse]);

  const handleManualResponse = (response: 'yes' | 'no') => {
    if (hasCompletedRef.current) return;
    completeWithResponse(response);
  };

  const handleSkip = () => {
    if (hasCompletedRef.current) return;
    completeWithResponse('skip');
  };

  const handleReplay = () => {
    playPhrase(question.question, { playbackSpeed: 0.85 });
  };

  const handleConfirm = () => {
    if (detectedResponse) completeWithResponse(detectedResponse);
  };

  return (
    <CardContainer>
      <CardContent className="p-4 space-y-3">
        {/* Question — conversational, with subtle audio replay */}
        <div className="flex items-start gap-2">
          <AudioButton
            onPlay={handleReplay}
            isPlaying={isPlaying}
            isLoading={audioLoading}
            label=""
            size="sm"
          />
          <p className="text-sm font-medium text-foreground flex-1 pt-1.5 leading-relaxed">
            {question.question}
          </p>
        </div>

        {/* Listening — two clear buttons */}
        {phase === 'listening' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleManualResponse('yes')}
                className={cn(
                  "flex items-center justify-center gap-2",
                  "min-h-[52px] rounded-xl font-medium text-sm",
                  "bg-[hsl(var(--success)/0.08)] hover:bg-[hsl(var(--success)/0.15)]",
                  "border border-[hsl(var(--success)/0.2)]",
                  "text-[hsl(var(--success))]",
                  "transition-all duration-150 active:scale-[0.97]"
                )}
              >
                <ThumbsUp className="w-5 h-5" />
                Yes
              </button>
              <button
                onClick={() => handleManualResponse('no')}
                className={cn(
                  "flex items-center justify-center gap-2",
                  "min-h-[52px] rounded-xl font-medium text-sm",
                  "bg-muted/40 hover:bg-muted/70 border border-border/50",
                  "text-foreground",
                  "transition-all duration-150 active:scale-[0.97]"
                )}
              >
                <ThumbsDown className="w-5 h-5" />
                No
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="text-[11px] text-muted-foreground/50">or say it</span>
              <SkipButton onSkip={handleSkip} />
            </div>
          </div>
        )}

        {/* Confirming */}
        {phase === 'confirming' && detectedResponse && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-center gap-2 py-1">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
                "bg-primary/10 text-primary"
              )}>
                {detectedResponse === 'yes' && <ThumbsUp className="w-3 h-3" />}
                {detectedResponse === 'no' && <ThumbsDown className="w-3 h-3" />}
                {detectedResponse === 'other' ? `"${transcript}"` : detectedResponse}
              </div>
            </div>
            
            {detectedResponse === 'other' && (
              <div className="flex justify-center gap-2">
                <button onClick={handleReplay} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
                <button onClick={handleConfirm} className="text-xs font-medium text-primary hover:text-primary/80">
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete */}
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
