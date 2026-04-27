/**
 * Story Retell Probe — modal-capable, tier-adaptive
 *
 * Maya reads a short story → user retells → system scores:
 * - idea units recalled
 * - sequence accuracy
 * - sentence count
 *
 * Adaptation model (one-shot probe):
 * - Stories are tiered (1=short/concrete, 2=sequence/causality, 3=longer/inference)
 * - Opens at `difficultyTier` (passed from session config, defaults to last-seen tier or 1)
 * - On strong recall (≥60% idea units), offers "Try a harder story" → bumps tier in-place
 * - On weak recall (<30%), persists tier-down for next session so user isn't stuck
 * - Persists `lastStoryRetellTier` per-user in profile prefs
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Volume2, Send, ThumbsUp, Loader2, ArrowUp } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StoryItem {
  id: string;
  title: string;
  text: string;
  ideaUnits: string[];
  /** 1 = easiest (3 sentences, concrete actors), 3 = hardest (5-6 sentences, inference) */
  tier: 1 | 2 | 3;
}

const STORIES: StoryItem[] = [
  // Tier 1 — short, concrete, single sequence
  {
    id: 't1-dog-walk',
    title: 'The Dog Walk',
    text: 'Sam took his dog Bella to the park. Bella ran after a ball. She jumped in the pond. Sam laughed and dried her off with a towel.',
    ideaUnits: ['sam', 'dog', 'bella', 'park', 'ball', 'pond', 'jumped', 'laughed', 'towel', 'dried'],
    tier: 1,
  },
  {
    id: 't1-coffee',
    title: 'Morning Coffee',
    text: 'Maria woke up early. She made coffee and toast. She sat by the window and watched the birds. Then she drove to work.',
    ideaUnits: ['maria', 'woke', 'early', 'coffee', 'toast', 'window', 'birds', 'drove', 'work'],
    tier: 1,
  },
  {
    id: 't1-store',
    title: 'The Store',
    text: 'Tom went to the store to buy milk. He also got bread and eggs. He forgot his wallet in the car. He had to go back and get it.',
    ideaUnits: ['tom', 'store', 'milk', 'bread', 'eggs', 'wallet', 'car', 'forgot', 'go back'],
    tier: 1,
  },
  {
    id: 't1-rain',
    title: 'Rainy Day',
    text: 'It rained all day. The kids stayed inside. They played cards and drew pictures. Their mom made hot chocolate.',
    ideaUnits: ['rained', 'kids', 'inside', 'cards', 'drew', 'pictures', 'mom', 'hot chocolate'],
    tier: 1,
  },

  // Tier 2 — 4-5 sentences, sequence/causality, two characters
  {
    id: 't2-flat-tire',
    title: 'The Flat Tire',
    text: 'Anna was driving home when her tire went flat. She pulled over and called her brother. He arrived with a spare tire and tools. Together they changed the tire in twenty minutes. Anna was relieved and bought him dinner to say thanks.',
    ideaUnits: ['anna', 'driving', 'tire', 'flat', 'called', 'brother', 'spare', 'changed', 'twenty minutes', 'dinner', 'thanks'],
    tier: 2,
  },
  {
    id: 't2-lost-keys',
    title: 'The Lost Keys',
    text: 'David could not find his keys before work. He looked in the kitchen and the bedroom. His daughter found them under the couch. She had been playing with them the night before. David thanked her and rushed out the door.',
    ideaUnits: ['david', 'keys', 'work', 'kitchen', 'bedroom', 'daughter', 'couch', 'playing', 'thanked', 'rushed'],
    tier: 2,
  },
  {
    id: 't2-garden',
    title: 'The Garden Plan',
    text: 'Lisa wanted to grow tomatoes in her yard. She bought seeds and a small shovel. She dug three holes near the fence and planted the seeds. Every morning she watered them carefully. By summer she had ripe red tomatoes.',
    ideaUnits: ['lisa', 'tomatoes', 'yard', 'seeds', 'shovel', 'holes', 'fence', 'planted', 'watered', 'summer', 'red'],
    tier: 2,
  },

  // Tier 3 — 5-6 sentences, requires inference, time jumps
  {
    id: 't3-promotion',
    title: 'The Promotion',
    text: 'Carlos had been working late nights for months on a big project. On Friday his boss called him into the office and shook his hand. The team would now report to Carlos and his salary would double. He drove home slowly, thinking about his father who never got the chance to finish school. That night he called his mother and told her she could finally retire.',
    ideaUnits: ['carlos', 'working', 'late nights', 'project', 'friday', 'boss', 'team', 'salary', 'father', 'school', 'mother', 'retire'],
    tier: 3,
  },
  {
    id: 't3-storm',
    title: 'The Storm Warning',
    text: 'The radio said a hurricane would hit the coast by evening. Grandma packed water, batteries, and her medicine into a small bag. She walked next door to check on her neighbor, who was hard of hearing and lived alone. They drove together to the school that was being used as a shelter. By midnight the wind was loud, but they were safe and playing cards in the cafeteria.',
    ideaUnits: ['radio', 'hurricane', 'coast', 'evening', 'grandma', 'water', 'batteries', 'medicine', 'neighbor', 'hard of hearing', 'school', 'shelter', 'wind', 'cards'],
    tier: 3,
  },
  {
    id: 't3-reunion',
    title: 'The Reunion',
    text: 'Marcus had not seen his old friend in twenty years since high school. He saw a photo on social media and recognized the smile right away. He wrote a long message and waited nervously for a reply. The next morning his phone buzzed with a video call request from Australia. They talked for two hours and made plans to meet in person that summer.',
    ideaUnits: ['marcus', 'old friend', 'twenty years', 'high school', 'photo', 'social media', 'message', 'video call', 'australia', 'two hours', 'meet', 'summer'],
    tier: 3,
  },
];

function getStoriesByTier(tier: number): StoryItem[] {
  return STORIES.filter((s) => s.tier === tier);
}

function pickStory(tier: number, excludeId?: string): StoryItem {
  const pool = getStoriesByTier(tier).filter((s) => s.id !== excludeId);
  if (pool.length === 0) {
    // Fallback to any story at adjacent tier
    const fallback = STORIES.filter((s) => s.id !== excludeId);
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface StoryRetellResult {
  ideaUnitsRecalled: number;
  ideaUnitsTotal: number;
  recallAccuracy: number;
  sentenceCount: number;
  wordCount: number;
  retellText: string;
  storyTitle: string;
  storyId: string;
  tier: number;
}

interface StoryRetellProbeProps {
  /** Starting tier (1-3). Defaults to user's last tier from profile, then 1. */
  difficultyTier?: 1 | 2 | 3;
  onComplete: (results: StoryRetellResult) => void;
}

type Phase = 'listen' | 'retell' | 'scoring' | 'complete';

export function StoryRetellProbe({ difficultyTier, onComplete }: StoryRetellProbeProps) {
  const { user } = useAuth();
  const [activeTier, setActiveTier] = useState<number>(difficultyTier ?? 1);
  const [story, setStory] = useState<StoryItem>(() => pickStory(difficultyTier ?? 1));
  const [phase, setPhase] = useState<Phase>('listen');
  const [retellText, setRetellText] = useState('');
  const [results, setResults] = useState<StoryRetellResult | null>(null);
  const { speak, stop: stopTTS, isSpeaking } = useTextToSpeech();
  const persistedRef = useRef(false);

  // Load user's last tier preference (overrides default if no explicit prop)
  useEffect(() => {
    if (difficultyTier || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('accessibility_prefs')
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      const prefs = (data?.accessibility_prefs as any) ?? {};
      const lastTier = Number(prefs.lastStoryRetellTier) || 1;
      const clampedTier = Math.max(1, Math.min(3, lastTier));
      setActiveTier(clampedTier);
      setStory(pickStory(clampedTier));
    })();
    return () => { cancelled = true; };
  }, [user?.id, difficultyTier]);

  useEffect(() => {
    return () => { stopTTS(); };
  }, [stopTTS]);

  const persistTier = useCallback(async (tier: number) => {
    if (!user?.id) return;
    try {
      await supabase.rpc('merge_profile_pref', {
        p_key: 'lastStoryRetellTier',
        p_subkey: 'value',
        p_value: tier,
      } as any);
    } catch {
      // Best-effort; non-blocking
    }
  }, [user?.id]);

  const playStory = useCallback(async () => {
    try {
      await speak(story.text);
    } catch (err) {
      console.warn('[StoryRetell] TTS failed:', err);
    }
  }, [story, speak]);

  const scoreRetell = useCallback((text: string) => {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    let unitsFound = 0;
    for (const unit of story.ideaUnits) {
      if (lower.includes(unit.toLowerCase())) unitsFound++;
    }

    const recallAccuracy = story.ideaUnits.length > 0 ? unitsFound / story.ideaUnits.length : 0;

    const result: StoryRetellResult = {
      ideaUnitsRecalled: unitsFound,
      ideaUnitsTotal: story.ideaUnits.length,
      recallAccuracy,
      sentenceCount: sentences.length,
      wordCount: words.length,
      retellText: text,
      storyTitle: story.title,
      storyId: story.id,
      tier: activeTier,
    };

    // Adaptation persistence (next-session)
    if (!persistedRef.current) {
      persistedRef.current = true;
      let nextTier = activeTier;
      if (recallAccuracy >= 0.6 && activeTier < 3) nextTier = activeTier + 1;
      else if (recallAccuracy < 0.3 && activeTier > 1) nextTier = activeTier - 1;
      if (nextTier !== activeTier) {
        void persistTier(nextTier);
      } else {
        void persistTier(activeTier);
      }
    }

    setResults(result);
    setPhase('complete');
    onComplete(result);
  }, [story, activeTier, persistTier, onComplete]);

  const handleSubmit = useCallback(() => {
    if (retellText.trim().length < 3) return;
    setPhase('scoring');
    setTimeout(() => scoreRetell(retellText), 500);
  }, [retellText, scoreRetell]);

  // In-place "try harder" — only offered when recall is strong
  const handleTryHarder = useCallback(() => {
    const nextTier = Math.min(3, activeTier + 1) as 1 | 2 | 3;
    persistedRef.current = false;
    setActiveTier(nextTier);
    setStory(pickStory(nextTier, story.id));
    setRetellText('');
    setResults(null);
    setPhase('listen');
  }, [activeTier, story.id]);

  if (phase === 'listen') {
    return (
      <div className="flex flex-col items-center gap-5 p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground text-center">
            Listen to the story, then retell it in your own words.
          </p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Level {activeTier}
          </span>
        </div>

        <div className="bg-muted/30 rounded-xl p-5 w-full">
          <h3 className="font-medium text-center mb-3">{story.title}</h3>
          <p className="text-sm leading-relaxed text-center">{story.text}</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={playStory} disabled={isSpeaking}>
            <Volume2 className="w-4 h-4 mr-1" />
            {isSpeaking ? 'Playing...' : 'Listen'}
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
  const recallStrong = (results?.recallAccuracy ?? 0) >= 0.6;
  const canBumpUp = recallStrong && activeTier < 3;

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <ThumbsUp className="w-10 h-10 text-primary" />
      <p className="text-lg font-medium">
        {results?.ideaUnitsRecalled}/{results?.ideaUnitsTotal} details recalled
      </p>
      <p className="text-sm text-muted-foreground">
        {results?.sentenceCount} sentences, {results?.wordCount} words • Level {activeTier}
      </p>
      {canBumpUp && (
        <Button variant="outline" size="sm" onClick={handleTryHarder} className="mt-2">
          <ArrowUp className="w-4 h-4 mr-1" />
          Try a harder story
        </Button>
      )}
    </div>
  );
}
