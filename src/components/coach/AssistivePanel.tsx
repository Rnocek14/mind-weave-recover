/**
 * AssistivePanel - Always-visible scaffolding panel
 * 
 * The core UI innovation for the Conversation Coach.
 * Provides word tiles, sentence frames, and cue ladder
 * that are always available to support word retrieval.
 * 
 * Updates dynamically based on:
 * - Current topic
 * - Primed vocabulary from exercises
 * - User's speech analysis
 * - Adaptive difficulty level
 */

import React from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WordTileGroup } from './WordTile';
import { SentenceFrameGroup } from './SentenceFrame';
import { CueLadder, SimpleCueButton } from './CueLadder';
import { cn } from '@/lib/utils';
import { SupportLevel } from '@/lib/conversationDifficultyController';

interface AssistivePanelProps {
  // Word options
  wordTiles: string[];
  primedVocabulary: string[];
  usedWords: string[];
  onWordSelect: (word: string) => void;
  
  // Sentence frames
  sentenceFrames: string[];
  onFrameSelect: (frame: string) => void;
  activeFrame?: string;
  
  // Cue ladder
  cueLevel: number;
  cueText?: string;
  onRequestCue: (level: number) => void;
  
  // Display state
  supportLevel: SupportLevel;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isVisible: boolean;
  
  // Topic context
  currentTopic?: string | null;
  
  className?: string;
}

export function AssistivePanel({
  wordTiles,
  primedVocabulary,
  usedWords,
  onWordSelect,
  sentenceFrames,
  onFrameSelect,
  activeFrame,
  cueLevel,
  cueText,
  onRequestCue,
  supportLevel,
  isExpanded,
  onToggleExpand,
  isVisible,
  currentTopic,
  className,
}: AssistivePanelProps) {
  if (!isVisible) return null;

  // Determine what to show based on support level
  const showTiles = supportLevel === 'choice' || supportLevel === 'guided';
  const showFrames = supportLevel === 'choice';
  const showCueLadder = supportLevel === 'choice';

  // Combine primed vocabulary with topic words, prioritizing primed
  const allWords = [...new Set([...primedVocabulary, ...wordTiles])].slice(0, 6);

  return (
    <div
      className={cn(
        'bg-card/95 backdrop-blur-md border-t shadow-lg transition-all duration-300',
        isExpanded ? 'max-h-[300px]' : 'max-h-[60px]',
        className
      )}
    >
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            {currentTopic ? `Talking about ${currentTopic}` : 'Word Helper'}
          </span>
          {primedVocabulary.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
              {primedVocabulary.length} words ready
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in">
          {/* Word tiles section */}
          {showTiles && allWords.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">
                Tap a word to use it:
              </label>
              <WordTileGroup
                words={allWords}
                onSelect={onWordSelect}
                usedWords={usedWords}
                variant={primedVocabulary.length > 0 ? 'primed' : 'default'}
              />
            </div>
          )}

          {/* Sentence frames section */}
          {showFrames && sentenceFrames.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">
                Start your sentence:
              </label>
              <SentenceFrameGroup
                frames={sentenceFrames}
                onSelect={onFrameSelect}
                activeFrame={activeFrame}
              />
            </div>
          )}

          {/* Cue ladder section */}
          {showCueLadder && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">
                Need more help?
              </label>
              <CueLadder
                currentLevel={cueLevel}
                onRequestCue={onRequestCue}
                cueText={cueText}
                compact
              />
            </div>
          )}

          {/* Simple hint button for guided mode */}
          {supportLevel === 'guided' && !showCueLadder && (
            <div className="flex justify-center">
              <SimpleCueButton
                onClick={() => onRequestCue(1)}
                label="Need a hint?"
              />
            </div>
          )}
        </div>
      )}

      {/* Collapsed quick-access tiles */}
      {!isExpanded && showTiles && allWords.length > 0 && (
        <div className="px-4 pb-2 overflow-x-auto">
          <div className="flex gap-2">
            {allWords.slice(0, 4).map((word) => (
              <button
                key={word}
                onClick={(e) => {
                  e.stopPropagation();
                  onWordSelect(word);
                }}
                className={cn(
                  'px-3 py-1 text-sm rounded-full',
                  'bg-primary/10 text-primary hover:bg-primary/20',
                  'transition-colors whitespace-nowrap'
                )}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal version for when user is flowing well
export function MinimalAssistiveHint({
  onExpand,
  className,
}: {
  onExpand: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onExpand}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
        'bg-muted/50 hover:bg-muted text-muted-foreground',
        'text-sm transition-colors',
        className
      )}
    >
      <Sparkles className="w-3 h-3" />
      Need words?
    </button>
  );
}
