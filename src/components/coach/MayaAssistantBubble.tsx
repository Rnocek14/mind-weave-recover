/**
 * MayaAssistantBubble — Persistent floating help bubble
 * 
 * Provides quiet support during games. NOT a chat interface.
 * Offers structured help actions: repeat instructions, get hint, explain, etc.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, HelpCircle, RotateCcw, Lightbulb, BookOpen, Target, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MayaAssistantBubbleProps {
  /** Whether Maya is currently "speaking" (glow animation) */
  isSpeaking?: boolean;
  /** Whether the bubble is visible */
  visible?: boolean;
  /** Called when user selects a help action */
  onAction?: (action: MayaHelpAction) => void;
  /** Current game context for help text */
  currentGameLabel?: string;
}

export type MayaHelpAction = 
  | 'repeat_instructions'
  | 'give_hint'
  | 'explain_this'
  | 'what_are_we_doing'
  | 'help_me';

const HELP_OPTIONS: { action: MayaHelpAction; label: string; icon: React.ReactNode }[] = [
  { action: 'repeat_instructions', label: 'Repeat instructions', icon: <RotateCcw className="w-4 h-4" /> },
  { action: 'give_hint', label: 'Give me a hint', icon: <Lightbulb className="w-4 h-4" /> },
  { action: 'explain_this', label: 'Explain this', icon: <BookOpen className="w-4 h-4" /> },
  { action: 'what_are_we_doing', label: "What are we working on?", icon: <Target className="w-4 h-4" /> },
  { action: 'help_me', label: 'Help me', icon: <MessageCircle className="w-4 h-4" /> },
];

export function MayaAssistantBubble({
  isSpeaking = false,
  visible = true,
  onAction,
  currentGameLabel,
}: MayaAssistantBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!visible) return null;

  const handleAction = (action: MayaHelpAction) => {
    onAction?.(action);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Help panel */}
      {isOpen && (
        <div className="bg-card border rounded-2xl shadow-lg p-3 w-56 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-foreground">Maya can help</p>
            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {HELP_OPTIONS.map((opt) => (
              <button
                key={opt.action}
                onClick={() => handleAction(opt.action)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors text-left"
              >
                <span className="text-muted-foreground">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg',
          'bg-primary text-primary-foreground',
          isSpeaking && 'ring-4 ring-primary/30 animate-pulse',
          isOpen && 'ring-2 ring-primary/50'
        )}
        title="Ask Maya for help"
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <span className="text-sm font-bold">M</span>
        )}
      </button>
    </div>
  );
}
