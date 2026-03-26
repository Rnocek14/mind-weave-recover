/**
 * Story Retell Probe — modal-capable
 * 
 * Maya reads a short story → user retells → system scores:
 * - idea units recalled
 * - sequence accuracy
 * - sentence count
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Volume2, Send, ThumbsUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoryItem {
  title: string;
  text: string;
  ideaUnits: string[]; // key concepts to check
}

const STORIES: StoryItem[] = [
  {
    title: 'The Dog Walk',
    text: 'Sam took his dog Bella to the park. Bella ran after a ball. She jumped in the pond. Sam laughed and dried her off with a towel.',
    ideaUnits: ['sam', 'dog', 'bella', 'park', 'ball', 'pond', 'jumped', 'laughed', 'towel', 'dried'],
  },
  {
    title: 'Morning Coffee',
    text: 'Maria woke up early. She made coffee and toast. She sat by the window and watched the birds. Then she drove to work.',
    ideaUnits: ['maria', 'woke', 'early', 'coffee', 'toast', 'window', 'birds', 'drove', 'work'],
  },
  {
    title: 'The Store',
    text: 'Tom went to the store to buy milk. He also got bread and eggs. He forgot his wallet in the car. He had to go back and get it.',
    ideaUnits: ['tom', 'store', 'milk', 'bread', 'eggs', 'wallet', 'car', 'forgot', 'go back'],
  },
  {
    title: 'Rainy Day',
    text: 'It rained all day. The kids stayed inside. They played cards and drew pictures. Their mom made hot chocolate.',
    ideaUnits: ['rained', 'kids', 'inside', 'cards', 'drew', 'pictures', 'mom', 'hot chocolate'],
  },
];

interface StoryRetellProbeProps {
  onComplete: (results: {
    ideaUnitsRecalled: number;
    ideaUnitsTotal: number;
    recallAccuracy: number;
    sentenceCount: number;
    wordCount: number;
    retellText: string;
    storyTitle: string;
  }) => void;
}

type Phase = 'listen' | 'retell' | 'scoring' | 'complete';

export function StoryRetellProbe({ onComplete }: StoryRetellProbeProps) {
  const [story] = useState(() => STORIES[Math.floor(Math.random() * STORIES.length)]);
  const [phase, setPhase] = useState<Phase>('listen');
  const [retellText, setRetellText] = useState('');
  const [results, setResults] = useState<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playStory = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(story.text);
      utt.rate = 0.85;
      utt.onend = () => setIsPlaying(false);
      synthRef.current = utt;
      setIsPlaying(true);
      window.speechSynthesis.speak(utt);
    }
  }, [story]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const scoreRetell = useCallback((text: string) => {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Count idea units found
    let unitsFound = 0;
    for (const unit of story.ideaUnits) {
      if (lower.includes(unit.toLowerCase())) unitsFound++;
    }

    const result = {
      ideaUnitsRecalled: unitsFound,
      ideaUnitsTotal: story.ideaUnits.length,
      recallAccuracy: story.ideaUnits.length > 0 ? unitsFound / story.ideaUnits.length : 0,
      sentenceCount: sentences.length,
      wordCount: words.length,
      retellText: text,
      storyTitle: story.title,
    };

    setResults(result);
    setPhase('complete');
    onComplete(result);
  }, [story, onComplete]);

  const handleSubmit = useCallback(() => {
    if (retellText.trim().length < 3) return;
    setPhase('scoring');
    // Small delay for UX
    setTimeout(() => scoreRetell(retellText), 500);
  }, [retellText, scoreRetell]);

  if (phase === 'listen') {
    return (
      <div className="flex flex-col items-center gap-5 p-4">
        <p className="text-sm text-muted-foreground text-center">Listen to the story, then retell it in your own words.</p>
        
        <div className="bg-muted/30 rounded-xl p-5 w-full">
          <h3 className="font-medium text-center mb-3">{story.title}</h3>
          <p className="text-sm leading-relaxed text-center">{story.text}</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={playStory} disabled={isPlaying}>
            <Volume2 className="w-4 h-4 mr-1" />
            {isPlaying ? 'Playing...' : 'Listen'}
          </Button>
          <Button size="sm" onClick={() => setPhase('retell')}>
            Ready to retell
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'retell') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground text-center">
          Now retell the story in your own words. Include as many details as you can.
        </p>

        <Textarea
          value={retellText}
          onChange={(e) => setRetellText(e.target.value)}
          placeholder="Type the story here..."
          rows={5}
          className="resize-none"
          autoFocus
        />

        <Button
          onClick={handleSubmit}
          disabled={retellText.trim().length < 3}
          className="self-end"
        >
          <Send className="w-4 h-4 mr-1" />
          Done
        </Button>
      </div>
    );
  }

  if (phase === 'scoring') {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking your retell...</p>
      </div>
    );
  }

  // Complete
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <ThumbsUp className="w-10 h-10 text-primary" />
      <p className="text-lg font-medium">
        {results?.ideaUnitsRecalled}/{results?.ideaUnitsTotal} details recalled
      </p>
      <p className="text-sm text-muted-foreground">
        {results?.sentenceCount} sentences, {results?.wordCount} words
      </p>
    </div>
  );
}
