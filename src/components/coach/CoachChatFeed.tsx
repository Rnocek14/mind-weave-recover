/**
 * CoachChatFeed - Unified chat feed with inline exercise cards
 * 
 * Renders AI messages, user transcripts, and embedded exercise cards
 * in a scrollable chat-like interface.
 */

import React, { useRef, useEffect } from 'react';
import { Volume2, User } from 'lucide-react';
import { CardType } from '@/lib/coachOrchestrator';
import { PhotoNamingCard } from './PhotoNamingCard';
import { SemanticFeaturesCard } from './SemanticFeaturesCard';
import { ThoughtPromptCard } from './ThoughtPromptCard';
import { PhraseStarterCard } from './PhraseStarterCard';
import { YesNoCard } from './YesNoCard';
import { RecallPromptCard } from './RecallPromptCard';
import { cn } from '@/lib/utils';

// Message types in the feed
export type FeedMessage = 
  | { type: 'ai'; text: string; id: string }
  | { type: 'user'; text: string; id: string }
  | { type: 'card'; cardType: CardType; difficulty: 'easy' | 'medium'; id: string; completed: boolean };

interface CoachChatFeedProps {
  messages: FeedMessage[];
  onCardComplete?: (messageId: string, result: unknown) => void;
  isProcessing?: boolean;
}

export function CoachChatFeed({ messages, onCardComplete, isProcessing }: CoachChatFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const renderMessage = (message: FeedMessage) => {
    switch (message.type) {
      case 'ai':
        return (
          <div key={message.id} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-5 h-5 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
              <p className="text-foreground">{message.text}</p>
            </div>
          </div>
        );

      case 'user':
        return (
          <div key={message.id} className="flex items-start gap-3 justify-end animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
              <p>{message.text}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
        );

      case 'card':
        return (
          <div key={message.id} className="py-2 animate-in fade-in zoom-in-95 duration-300">
            {!message.completed && renderCard(message.cardType, message.difficulty, message.id)}
            {message.completed && (
              <div className="text-center text-sm text-muted-foreground py-2">
                Exercise completed ✓
              </div>
            )}
          </div>
        );
    }
  };

  const renderCard = (cardType: CardType, difficulty: 'easy' | 'medium', messageId: string) => {
    const handleComplete = (result: unknown) => {
      onCardComplete?.(messageId, result);
    };

    switch (cardType) {
      case 'photo_naming':
        return <PhotoNamingCard difficulty={difficulty} onComplete={handleComplete} />;
      case 'semantic_features':
        return <SemanticFeaturesCard difficulty={difficulty} onComplete={handleComplete} />;
      case 'thought_prompt':
        return <ThoughtPromptCard difficulty={difficulty} onComplete={handleComplete} />;
      case 'phrase_starter':
        return <PhraseStarterCard difficulty={difficulty} onComplete={handleComplete} />;
      case 'yes_no':
        return <YesNoCard difficulty={difficulty} onComplete={handleComplete} />;
      case 'recall_prompt':
        return <RecallPromptCard difficulty={difficulty} onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  return (
    <div 
      ref={feedRef}
      className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] p-4"
    >
      {messages.map(renderMessage)}
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-start gap-3 animate-in fade-in duration-300">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Volume2 className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
