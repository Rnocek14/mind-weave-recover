/**
 * CoachChatFeed - Beautiful chat feed with AI avatar and smooth animations
 * 
 * Renders AI messages, user transcripts, and embedded exercise cards
 * in a scrollable chat-like interface with polished styling.
 * 
 * Cards receive transcript from parent (centralized mic control).
 */

import React, { useRef, useEffect } from 'react';
import { Sparkles, User, Loader2 } from 'lucide-react';
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
  /** Current transcript from speech recognition (passed to active cards) */
  cardTranscript?: string;
  /** Whether mic is currently listening (passed to active cards) */
  isCardListening?: boolean;
  /** Whether AI is currently speaking (shows indicator) */
  isAISpeaking?: boolean;
  /** Current live transcript being captured (for "Heard" display) */
  liveTranscript?: string;
  /** Whether currently listening to user speech */
  isListening?: boolean;
}

// Helper to extract conversation topic from messages
function extractTopic(messages: FeedMessage[]): string | null {
  // Look at last 4 messages for topic keywords
  const recentMessages = messages.slice(-4);
  const allText = recentMessages
    .filter(m => m.type === 'user' || m.type === 'ai')
    .map(m => (m.type === 'user' || m.type === 'ai') ? m.text : '')
    .join(' ')
    .toLowerCase();
  
  // Topic detection based on keywords
  const topics: Record<string, string[]> = {
    'food': ['breakfast', 'lunch', 'dinner', 'eat', 'ate', 'food', 'toast', 'coffee', 'meal', 'cooking'],
    'family': ['daughter', 'son', 'wife', 'husband', 'family', 'mom', 'dad', 'kids', 'children', 'grandkids'],
    'morning': ['morning', 'woke', 'wake', 'today'],
    'yesterday': ['yesterday'],
    'activities': ['went', 'going', 'store', 'walk', 'shopping', 'outside', 'trip'],
  };
  
  for (const [topic, keywords] of Object.entries(topics)) {
    if (keywords.some(kw => allText.includes(kw))) {
      return topic;
    }
  }
  
  return null;
}

// Helper to extract conversation context for cards
function getConversationContext(messages: FeedMessage[]): string {
  return messages
    .filter(m => m.type === 'user' || m.type === 'ai')
    .slice(-4)
    .map(m => (m.type === 'user' || m.type === 'ai') ? m.text : '')
    .join(' ');
}

export function CoachChatFeed({ 
  messages, 
  onCardComplete, 
  isProcessing,
  cardTranscript = '',
  isCardListening = false,
  isAISpeaking = false,
  liveTranscript = '',
  isListening = false,
}: CoachChatFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  
  // Extract current topic for display
  const currentTopic = extractTopic(messages);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isProcessing, isAISpeaking, liveTranscript]);

  const renderMessage = (message: FeedMessage, index: number) => {
    const isLast = index === messages.length - 1;
    
    switch (message.type) {
      case 'ai':
        return (
          <div 
            key={message.id} 
            className={cn(
              "flex items-start gap-4 animate-fade-in",
              isLast && "mb-2"
            )}
          >
            {/* AI Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            
            {/* Message bubble */}
            <div className="bg-card rounded-3xl rounded-tl-lg px-5 py-4 max-w-[80%] shadow-soft border border-border/50">
              <p className="text-foreground text-lg leading-relaxed">{message.text}</p>
            </div>
          </div>
        );

      case 'user':
        return (
          <div 
            key={message.id} 
            className={cn(
              "flex items-start gap-4 justify-end animate-fade-in",
              isLast && "mb-2"
            )}
          >
            {/* Message bubble */}
            <div className="bg-primary text-primary-foreground rounded-3xl rounded-tr-lg px-5 py-4 max-w-[80%] shadow-soft">
              <p className="text-lg leading-relaxed">{message.text}</p>
            </div>
            
            {/* User Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-soft">
              <User className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
        );

      case 'card':
        return (
          <div key={message.id} className="py-3 animate-fade-in">
            {!message.completed && renderCard(
              message.cardType, 
              message.difficulty, 
              message.id,
              cardTranscript,
              isCardListening
            )}
            {message.completed && (
              <div className="text-center py-3">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Activity completed
                </span>
              </div>
            )}
          </div>
        );
    }
  };

  const renderCard = (
    cardType: CardType, 
    difficulty: 'easy' | 'medium', 
    messageId: string,
    transcript: string,
    isListening: boolean
  ) => {
    const handleComplete = (result: unknown) => {
      onCardComplete?.(messageId, result);
    };

    const conversationContext = getConversationContext(messages);

    // All cards now receive transcript and isListening as props
    switch (cardType) {
      case 'photo_naming':
        return (
          <PhotoNamingCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            onComplete={handleComplete} 
          />
        );
      case 'semantic_features':
        return (
          <SemanticFeaturesCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            conversationContext={conversationContext}
            onComplete={handleComplete} 
          />
        );
      case 'thought_prompt':
        return (
          <ThoughtPromptCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            onComplete={handleComplete} 
          />
        );
      case 'phrase_starter':
        return (
          <PhraseStarterCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            onComplete={handleComplete} 
          />
        );
      case 'yes_no':
        return (
          <YesNoCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            onComplete={handleComplete} 
          />
        );
      case 'recall_prompt':
        return (
          <RecallPromptCard 
            difficulty={difficulty} 
            transcript={transcript}
            isListening={isListening}
            onComplete={handleComplete} 
          />
        );
      default:
        return null;
    }
  };

  return (
    <div 
      ref={feedRef}
      className="flex flex-col gap-5 overflow-y-auto max-h-[55vh] p-6"
    >
      {/* Topic indicator */}
      {currentTopic && messages.length > 2 && (
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/50 text-muted-foreground text-xs rounded-full">
            <span className="w-1.5 h-1.5 bg-primary/60 rounded-full" />
            Talking about: {currentTopic}
          </span>
        </div>
      )}
      
      {/* Welcome message if empty */}
      {messages.length === 0 && !isProcessing && !isAISpeaking && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-glow mb-6">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Chat</h3>
          <p className="text-muted-foreground max-w-xs">
            Press "Start Conversation" below and let's have a friendly chat together.
          </p>
        </div>
      )}
      
      {messages.map((msg, i) => renderMessage(msg, i))}
      
      {/* Live transcript "Heard" indicator while listening */}
      {isListening && liveTranscript && liveTranscript.trim().length > 0 && (
        <div className="flex items-start gap-4 justify-end animate-fade-in opacity-70">
          <div className="bg-primary/20 text-primary-foreground/80 rounded-3xl rounded-tr-lg px-5 py-3 max-w-[80%] border border-primary/30">
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-medium">Hearing:</span>
              <p className="text-base leading-relaxed text-foreground/70">{liveTranscript}</p>
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/50 flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6 text-primary-foreground/70" />
          </div>
        </div>
      )}
      
      {/* AI Speaking indicator */}
      {isAISpeaking && (
        <div className="flex items-start gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
            <Sparkles className="w-6 h-6 text-primary-foreground animate-pulse" />
          </div>
          <div className="bg-card rounded-3xl rounded-tl-lg px-5 py-4 shadow-soft border border-border/50">
            <div className="flex items-center gap-2 text-primary">
              <div className="flex gap-1">
                <span className="w-2 h-4 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-5 bg-primary/80 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                <span className="w-2 h-3 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-5 bg-primary/80 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <span className="w-2 h-4 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-sm font-medium ml-2">Speaking...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Processing indicator */}
      {isProcessing && !isAISpeaking && (
        <div className="flex items-start gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-glow">
            <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
          </div>
          <div className="bg-card rounded-3xl rounded-tl-lg px-5 py-4 shadow-soft border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm font-medium">Thinking</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
