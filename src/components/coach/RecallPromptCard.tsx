/**
 * RecallPromptCard — Category word retrieval as a conversation moment.
 * Maya asks "Name some animals" → user speaks → words appear as chips.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CardContent } from '@/components/ui/card';
import { Check, Plus } from 'lucide-react';
import { getRandomRecallPrompt, RecallPrompt } from '@/data/recallPromptBank';
import { 
  CardContainer, 
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

  useEffect(() => {
    if (!hasPlayedAudioRef.current) {
      hasPlayedAudioRef.current = true;
      const timer = setTimeout(() => {
        playPhrase(prompt.prompt, { playbackSpeed: 0.85 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [prompt.prompt, playPhrase]);

  useEffect(() => {
    exampleTimerRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && spokenWords.length === 0) setShowExamples(true);
    }, 5000);
    return () => { if (exampleTimerRef.current) clearTimeout(exampleTimerRef.current); };
  }, [spokenWords.length]);

  const validateWord = useCallback((word: string): boolean => {
    const cleanWord = word.toLowerCase().trim();
    return prompt.examples.some(ex => 
      cleanWord.includes(ex.toLowerCase()) || ex.toLowerCase().includes(cleanWord)
    );
  }, [prompt.examples]);

  const extractWords = useCallback((text: string): string[] => {
    return text.trim().split(/\s+/).filter(w => w.length >= 2);
  }, []);

  const handleComplete = useCallback((words: string[]) => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    const latencyMs = Date.now() - startTimeRef.current;
    const anyValid = words.some(w => validateWord(w));
    if (anyValid) setValidationMessage("That's right!");
    else if (words.length > 0) setValidationMessage("Good thinking!");
    else setValidationMessage("Nice effort!");
    setSpokenWords(words);
    setPhase('complete');
    setTimeout(() => {
      onComplete({ success: words.length > 0, words, latencyMs, category: prompt.category });
    }, 600);
  }, [validateWord, prompt.category, onComplete]);

  const handleDone = () => {
    const words = extractWords(transcript);
    handleComplete(words);
  };

  const handleSayAnother = () => {
    const words = extractWords(transcript);
    setSpokenWords(prev => [...prev, ...words]);
    setPhase('moreWords');
  };

  const handleReplay = () => {
    playPhrase(prompt.prompt, { playbackSpeed: 0.85 });
  };

  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const words = extractWords(transcript);
    if (words.length >= 1) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasCompletedRef.current && phase === 'listening') setPhase('moreWords');
      }, 2500);
    }
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [transcript, phase, extractWords]);

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
      <CardContent className="p-4 space-y-2.5">
        {/* Prompt — conversational */}
        <div className="flex items-center gap-2">
          <AudioButton
            onPlay={handleReplay}
            isPlaying={isPlaying}
            isLoading={audioLoading}
            label=""
            size="sm"
          />
          <p className="text-sm font-medium text-foreground flex-1">{prompt.prompt}</p>
        </div>

        {/* Listening / More words phases */}
        {(phase === 'listening' || phase === 'moreWords') && (
          <div className="space-y-2">
            {/* Word chips */}
            {allWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allWords.map((word, i) => (
                  <span 
                    key={i}
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium",
                      "animate-in fade-in zoom-in-95 duration-200",
                      validateWord(word) 
                        ? "bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.2)]"
                        : "bg-primary/10 text-primary border border-primary/20"
                    )}
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}

            {/* Example hint */}
            {showExamples && allWords.length === 0 && (
              <div className="flex justify-center">
                <HintChip hint={`Like: ${prompt.examples.slice(0, 3).join(', ')}...`} type="semantic" />
              </div>
            )}

            {/* Live transcript */}
            {phase === 'listening' && !showExamples && allWords.length === 0 && (
              <TranscriptDisplay transcript={transcript} placeholder="Say any word..." minHeight="min-h-[20px]" />
            )}

            {/* Actions */}
            <div className="flex justify-center gap-2">
              {currentWords.length > 0 && phase === 'listening' && (
                <LargeTouchButton onClick={handleDone} variant="success" icon={<Check className="w-4 h-4" />}>
                  Done
                </LargeTouchButton>
              )}
              {phase === 'moreWords' && (
                <>
                  <LargeTouchButton onClick={handleSayAnother} variant="outline" icon={<Plus className="w-3.5 h-3.5" />}>
                    Another
                  </LargeTouchButton>
                  <LargeTouchButton onClick={handleDone} variant="success" icon={<Check className="w-4 h-4" />}>
                    Done
                  </LargeTouchButton>
                </>
              )}
            </div>
          </div>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <SuccessAnimation message="Nice!" subMessage={validationMessage} />
        )}
      </CardContent>
    </CardContainer>
  );
}
