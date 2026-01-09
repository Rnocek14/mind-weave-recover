/**
 * ConversationHelpers - Topic suggestions and help system
 * 
 * Shows when user seems stuck with:
 * - Topic chips to spark conversation
 * - "Give me an idea" button
 * - Skip option (tactful)
 * 
 * Fades in progressively based on silence duration
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Lightbulb, SkipForward, HelpCircle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationHelpersProps {
  silenceSeconds: number;
  onTopicSelect: (topic: string) => void;
  onGiveIdea: () => void;
  onSkip: () => void;
  onPlayGame?: () => void;
  className?: string;
}

// Topic suggestions with emoji and natural phrases
const TOPIC_CHIPS = [
  { emoji: '🍳', label: 'Food', prompt: 'Let me ask about food. What do you like to eat?' },
  { emoji: '👨‍👩‍👧', label: 'Family', prompt: 'Tell me about your family. Who do you spend time with?' },
  { emoji: '🏠', label: 'Today', prompt: 'Let us talk about today. What happened so far?' },
  { emoji: '🎯', label: 'Fun', prompt: 'What is something you enjoy doing?' },
];

// Progressive help messages - extended thresholds for more natural thinking time
const ENCOURAGEMENT_MESSAGES = [
  { minSeconds: 5, text: 'Take your time...' },
  { minSeconds: 8, text: 'No rush - I am here.' },
  { minSeconds: 12, text: 'Need a topic to start with?' },
];

export function ConversationHelpers({
  silenceSeconds,
  onTopicSelect,
  onGiveIdea,
  onSkip,
  onPlayGame,
  className,
}: ConversationHelpersProps) {
  // Determine what to show based on silence duration - extended for natural thinking time
  const showEncouragement = silenceSeconds >= 5;
  const showTopics = silenceSeconds >= 8;
  const showSkip = silenceSeconds >= 15;
  
  // Get the appropriate encouragement message
  const encouragementMessage = ENCOURAGEMENT_MESSAGES
    .filter(m => silenceSeconds >= m.minSeconds)
    .pop()?.text;

  if (!showEncouragement) {
    return null;
  }

  return (
    <div className={cn(
      "animate-fade-in transition-all duration-500 ease-out",
      className
    )}>
      {/* Encouragement message */}
      {encouragementMessage && !showTopics && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span className="text-sm">{encouragementMessage}</span>
        </div>
      )}
      
      {/* Topic suggestions panel */}
      {showTopics && (
        <div className="bg-card/90 backdrop-blur-sm border rounded-2xl p-4 shadow-soft space-y-3 max-w-sm mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="w-4 h-4" />
            <span>Not sure what to say?</span>
          </div>
          
          {/* Topic chips */}
          <div className="flex flex-wrap gap-2">
            {TOPIC_CHIPS.map((topic) => (
              <button
                key={topic.label}
                onClick={() => onTopicSelect(topic.prompt)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-full",
                  "bg-muted hover:bg-primary/10 hover:text-primary",
                  "text-sm font-medium transition-all duration-200",
                  "active:scale-95 touch-manipulation",
                  "min-h-[44px]" // Accessibility: min touch target
                )}
              >
                <span>{topic.emoji}</span>
                <span>{topic.label}</span>
              </button>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onGiveIdea}
              className="flex-1 gap-2 min-h-[44px]"
            >
              <Lightbulb className="w-4 h-4" />
              Give idea
            </Button>
            
            {onPlayGame && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPlayGame}
                className="flex-1 gap-2 min-h-[44px]"
              >
                <Gamepad2 className="w-4 h-4" />
                Play game
              </Button>
            )}
            
            {showSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="gap-2 text-muted-foreground min-h-[44px]"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Export topic prompts for use in AI
export function getTopicPrompt(topic: string): string {
  const found = TOPIC_CHIPS.find(t => t.label.toLowerCase() === topic.toLowerCase());
  return found?.prompt || `Let's talk about ${topic}. Tell me more.`;
}

// Random idea generator
const RANDOM_IDEAS = [
  "How about telling me what you had for breakfast?",
  "Think of something you did yesterday.",
  "Tell me about someone you talked to recently.",
  "What's one thing you're looking forward to?",
  "Describe something you can see right now.",
  "What did you do last weekend?",
];

export function getRandomIdea(): string {
  return RANDOM_IDEAS[Math.floor(Math.random() * RANDOM_IDEAS.length)];
}
