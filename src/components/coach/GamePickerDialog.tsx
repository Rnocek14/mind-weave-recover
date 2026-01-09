/**
 * GamePickerDialog - Modal for users to pick a mini-game
 * 
 * Shows 3 simple, accessible game options when user requests to play
 * Large touch targets and clear labels
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardType } from '@/lib/coachOrchestrator';
import { cn } from '@/lib/utils';

interface GameOption {
  cardType: CardType;
  emoji: string;
  title: string;
  description: string;
}

const GAME_OPTIONS: GameOption[] = [
  {
    cardType: 'photo_naming',
    emoji: '🖼️',
    title: 'Name a Picture',
    description: 'Say what you see',
  },
  {
    cardType: 'yes_no',
    emoji: '💬',
    title: 'Yes or No',
    description: 'Quick questions',
  },
  {
    cardType: 'recall_prompt',
    emoji: '🧠',
    title: 'Word Recall',
    description: 'Name any that come to mind',
  },
];

interface GamePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGame: (cardType: CardType) => void;
}

export function GamePickerDialog({
  open,
  onOpenChange,
  onSelectGame,
}: GamePickerDialogProps) {
  const handleSelect = (cardType: CardType) => {
    onSelectGame(cardType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Pick a Quick Game</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-3 py-4">
          {GAME_OPTIONS.map((game) => (
            <button
              key={game.cardType}
              onClick={() => handleSelect(game.cardType)}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-2xl",
                "bg-muted/50 hover:bg-primary/10 hover:border-primary/30",
                "border-2 border-transparent",
                "transition-all duration-200 ease-out",
                "active:scale-95 touch-manipulation",
                "min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              )}
            >
              <span className="text-4xl mb-2">{game.emoji}</span>
              <span className="font-medium text-sm text-center">{game.title}</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                {game.description}
              </span>
            </button>
          ))}
        </div>
        
        <div className="flex justify-center">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground min-h-[48px]"
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
