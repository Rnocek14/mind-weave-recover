/**
 * SemanticFeaturesCard - Enhanced context-aware semantic features exercise
 * 
 * Features:
 * - Tappable feature category icons for scaffolding
 * - Progressive prompting with specific questions
 * - Word count goal with visual progress
 * - Audio support for target word
 * - Beautiful UI with larger target display
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, MapPin, Wrench, Palette, Package } from 'lucide-react';
import { SEMANTIC_TRIALS, SemanticFeatureTrial } from '@/data/semanticFeatureBank';
import { detectUtteranceComplete } from '@/lib/completionDetector';
import { 
  CardContainer, 
  SpeechStatusBar, 
  AudioButton, 
  SuccessAnimation,
  TranscriptDisplay,
  LargeTouchButton,
  WordCountProgress
} from './CardComponents';
import { usePhraseAudio } from '@/hooks/usePhraseAudio';
import { cn } from '@/lib/utils';

interface SemanticFeaturesCardResult {
  success: boolean;
  wordCount: number;
  targetWord: string;
  latencyMs: number | null;
  featureUsed?: string;
}

interface SemanticFeaturesCardProps {
  difficulty: 'easy' | 'medium';
  transcript: string;
  isListening: boolean;
  onComplete: (result: SemanticFeaturesCardResult) => void;
  conversationContext?: string;
}

// Feature categories with icons and prompts
const FEATURE_CATEGORIES = [
  { id: 'location', icon: MapPin, label: 'Where', prompt: 'Where do you find it?' },
  { id: 'use', icon: Wrench, label: 'Use', prompt: 'What do you do with it?' },
  { id: 'appearance', icon: Palette, label: 'Look', prompt: 'What does it look like?' },
  { id: 'category', icon: Package, label: 'Type', prompt: 'What kind of thing is it?' },
];

// Extract a topic word from conversation context
function extractTopicFromContext(context?: string): string | null {
  if (!context) return null;
  
  const words = context.toLowerCase().split(/\s+/);
  const trialWords = SEMANTIC_TRIALS.map(t => t.word.toLowerCase());
  
  for (const word of words.reverse()) {
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
  const [currentPrompt, setCurrentPrompt] = useState('What can you tell me about it?');
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  
  const { playPhrase, isPlaying, isLoading: audioLoading } = usePhraseAudio();
  
  const startTimeRef = useRef<number>(Date.now());
  const firstWordTimeRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  const WORD_GOAL = 3;

  // Select trial based on context or random
  useEffect(() => {
    const topicFromContext = extractTopicFromContext(conversationContext);
    
    let selectedTrial: SemanticFeatureTrial;
    
    if (topicFromContext) {
      const matchingTrial = SEMANTIC_TRIALS.find(t => t.word.toLowerCase() === topicFromContext);
      if (matchingTrial) {
        selectedTrial = matchingTrial;
      } else {
        const easyTrials = SEMANTIC_TRIALS.filter(t => t.difficulty <= 2);
        selectedTrial = easyTrials[Math.floor(Math.random() * easyTrials.length)];
      }
    } else {
      const easyTrials = SEMANTIC_TRIALS.filter(t => t.difficulty <= 2);
      selectedTrial = easyTrials[Math.floor(Math.random() * easyTrials.length)];
    }
    
    setTrial(selectedTrial);
  }, [conversationContext]);

  // Handle feature category selection
  const handleSelectFeature = (featureId: string) => {
    const feature = FEATURE_CATEGORIES.find(f => f.id === featureId);
    if (feature) {
      setSelectedFeature(featureId);
      setCurrentPrompt(feature.prompt);
    }
  };

  // Handle audio playback
  const handlePlayAudio = () => {
    if (trial) {
      playPhrase(trial.word, { playbackSpeed: 0.8 });
    }
  };

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
    const success = wordCount >= 1;

    setTimeout(() => {
      onComplete({
        success,
        wordCount,
        targetWord: trial?.word || '',
        latencyMs,
        featureUsed: selectedFeature || undefined,
      });
    }, 600);
  }, [transcript, trial, selectedFeature, onComplete]);

  // Smart auto-complete with silence detection
  useEffect(() => {
    if (hasCompletedRef.current || phase === 'complete') return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 2) {
      if (transcript !== lastTranscriptRef.current) {
        lastTranscriptRef.current = transcript;
        
        const completion = detectUtteranceComplete(transcript);
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
    <CardContainer>
      <CardContent className="p-5 space-y-4">
        {/* Target word display */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <AudioButton
              onPlay={handlePlayAudio}
              isPlaying={isPlaying}
              isLoading={audioLoading}
              label=""
              size="sm"
              variant="ghost"
            />
            <span className="text-3xl font-bold text-primary capitalize">
              {trial.word}
            </span>
          </div>
          <p className="text-muted-foreground">{currentPrompt}</p>
        </div>

        {/* Feature category icons - only show if no feature selected */}
        {!selectedFeature && phase === 'listening' && (
          <div className="space-y-2">
            <p className="text-center text-xs text-muted-foreground">
              Pick a way to describe it:
            </p>
            <div className="flex justify-center gap-3">
              {FEATURE_CATEGORIES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <button
                    key={feature.id}
                    onClick={() => handleSelectFeature(feature.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                      "min-w-[60px] min-h-[60px]",
                      "bg-muted/50 hover:bg-primary/10 border-2 border-transparent",
                      "hover:border-primary/30"
                    )}
                  >
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="text-xs font-medium">{feature.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status */}
        {phase === 'listening' && (
          <div className="space-y-3">
            <TranscriptDisplay 
              transcript={transcript}
              placeholder="Describe it..."
            />

            {/* Word count goal */}
            <div className="flex justify-center">
              <WordCountProgress 
                current={wordCount} 
                goal={WORD_GOAL} 
                label="Goal:" 
              />
            </div>

            <SpeechStatusBar 
              isListening={isListening} 
              wordCount={wordCount}
              showWordCount={true}
            />

            {wordCount >= 2 && (
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
            message="Nice description!"
            subMessage={wordCount >= WORD_GOAL ? `${wordCount} words - great detail!` : undefined}
          />
        )}
      </CardContent>
    </CardContainer>
  );
}
