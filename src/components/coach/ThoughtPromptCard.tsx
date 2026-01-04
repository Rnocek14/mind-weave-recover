/**
 * ThoughtPromptCard - Enhanced inline thought continuation exercise
 * 
 * Features:
 * - Auto-speak prompt on mount
 * - Starter phrase buttons on silence
 * - Accept partial responses (even single words)
 * - Encouraging time indicators
 * - Progressive narrowing hints
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, MessageCircle, Loader2 } from 'lucide-react';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { 
  CardContainer, 
  SpeechStatusBar, 
  AudioButton, 
  SuccessAnimation,
  TranscriptDisplay,
  LargeTouchButton
} from './CardComponents';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface ThoughtPromptCardResult {
  success: boolean;
  wordCount: number;
  promptText: string;
  latencyMs: number | null;
  usedStarter?: boolean;
}

interface ThoughtPromptCardProps {
  difficulty: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: ThoughtPromptCardResult) => void;
}

// Simple, narrowed prompts for quick inline use
const QUICK_PROMPTS = [
  { text: "Tell me one thing you ate today.", starters: ["I had...", "For breakfast..."] },
  { text: "What's one thing you saw this morning?", starters: ["I saw...", "This morning..."] },
  { text: "Tell me about the weather right now.", starters: ["It's...", "The weather is..."] },
  { text: "What did you do after waking up?", starters: ["I...", "First I..."] },
  { text: "Name one thing in this room.", starters: ["There's a...", "I see a..."] },
  { text: "What's one sound you can hear?", starters: ["I hear...", "There's..."] },
  { text: "Tell me something you're wearing.", starters: ["I'm wearing...", "I have on..."] },
  { text: "What time of day is it?", starters: ["It's...", "Right now it's..."] },
];

export function ThoughtPromptCard({ difficulty, transcript, isListening, onComplete }: ThoughtPromptCardProps) {
  const [phase, setPhase] = useState<'listening' | 'complete'>('listening');
  const [promptData] = useState(() => QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)]);
  const [showStarters, setShowStarters] = useState(false);
  const [usedStarter, setUsedStarter] = useState(false);
  const [encouragement, setEncouragement] = useState('');
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const starterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const encouragementTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);
  const hasPlayedAudioRef = useRef(false);

  // Auto-speak prompt on mount
  useEffect(() => {
    if (!hasPlayedAudioRef.current) {
      hasPlayedAudioRef.current = true;
      const timer = setTimeout(() => {
        playPhrase(promptData.text, { playbackSpeed: 0.85 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [promptData.text, playPhrase]);

  // Show starter buttons after 4 seconds of silence
  useEffect(() => {
    starterTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && transcript.trim().length === 0) {
        setShowStarters(true);
      }
    }, 4000);
    
    // Show encouraging message after 6 seconds
    encouragementTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && transcript.trim().length === 0) {
        setEncouragement("Even one word is great!");
      }
    }, 6000);
    
    return () => {
      if (starterTimerRef.current) clearTimeout(starterTimerRef.current);
      if (encouragementTimerRef.current) clearTimeout(encouragementTimerRef.current);
    };
  }, [transcript]);

  // Handle starter selection
  const handleSelectStarter = (starter: string) => {
    setUsedStarter(true);
    setShowStarters(false);
    playPhrase(starter, { playbackSpeed: 0.9 });
  };

  // Replay audio
  const handleReplay = () => {
    playPhrase(promptData.text, { playbackSpeed: 0.85 });
  };

  // Track first word timing
  useEffect(() => {
    if (!firstWordTimeRef.current && transcript.trim().length > 0) {
      firstWordTimeRef.current = Date.now();
      setShowStarters(false);
      setEncouragement('');
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
    const success = wordCount >= 1; // Accept even single words

    setTimeout(() => {
      onComplete({
        success,
        wordCount,
        promptText: promptData.text,
        latencyMs,
        usedStarter,
      });
    }, 600);
  }, [transcript, promptData.text, usedStarter, onComplete]);

  // Smart auto-complete with silence detection
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 1) {
      if (transcript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = transcript;
        
        const completion = detectUtteranceComplete(transcript);
        
        // Longer patience for thought prompts
        const timeout = completion.isComplete && completion.confidence === 'high' 
          ? 2000 
          : 3500;
        
        silenceTimerRef.current = setTimeout(() => {
          if (!hasCompletedRef.current && wordCount >= 1) {
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
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (starterTimerRef.current) clearTimeout(starterTimerRef.current);
      if (encouragementTimerRef.current) clearTimeout(encouragementTimerRef.current);
    };
  }, []);

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <CardContainer>
      <CardContent className="p-5 space-y-4">
        {/* Prompt display */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <AudioButton
              onPlay={handleReplay}
              isPlaying={isPlaying}
              isLoading={audioLoading}
              label=""
              size="sm"
              variant="ghost"
            />
            <p className="text-xl font-medium text-foreground">
              {promptData.text}
            </p>
          </div>
        </div>

        {/* Status */}
        {phase === 'listening' && (
          <div className="space-y-3">
            <TranscriptDisplay 
              transcript={transcript}
              placeholder="..."
            />

            {/* Starter phrase buttons */}
            {showStarters && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-center text-sm text-muted-foreground">
                  Need help starting? Try:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {promptData.starters.map((starter, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectStarter(starter)}
                      className="min-h-[40px]"
                    >
                      {starter}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Encouraging message */}
            {encouragement && !showStarters && transcript.trim().length === 0 && (
              <p className="text-center text-sm text-muted-foreground animate-in fade-in duration-300">
                {encouragement}
              </p>
            )}

            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={wordCount}
              showWordCount={wordCount > 0}
              encouragingMessage="Take your time..."
            />

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

        {/* Complete phase */}
        {phase === 'complete' && (
          <SuccessAnimation 
            message="Got it!"
            subMessage={wordCount >= 3 ? "Great response!" : undefined}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
