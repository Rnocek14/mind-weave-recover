/**
 * Narrative Retell Game Hook
 * 
 * State machine for the narrative retell depth task:
 * 1. Show story scenes (all at once)
 * 2. User retells the story via speech
 * 3. Score against key events with structure breakdown
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { NARRATIVE_STORIES, NarrativeStory } from '@/data/narrativeRetellStimuli';
import { shuffleArray } from '@/lib/shuffle';

/** Build a queue of stories at a given tier, avoiding ones already seen.
 *  Uses a sliding ±1 window so the pool actually scales with tier:
 *    tier 1 → tier 1 (fallback 2)
 *    tier 2 → tier 1–3
 *    tier 3 → tier 2–3 (fallback 3 only)
 *  Previously used `tier <= tier+1` which leaked easy stories into hard sessions. */
function buildStories(tier: number, count: number, excludeIds: Set<string>): NarrativeStory[] {
  const t = Math.max(1, Math.min(3, tier));
  const lo = Math.max(1, t - 1);
  const hi = Math.min(3, t + 1);
  // Prefer exact-tier matches; fill with adjacent tier(s) if the pool is short.
  const exact = NARRATIVE_STORIES.filter((s) => s.tier === t && !excludeIds.has(s.id));
  const adjacent = NARRATIVE_STORIES.filter(
    (s) => s.tier !== t && s.tier >= lo && s.tier <= hi && !excludeIds.has(s.id),
  );
  const pool = [...shuffleArray(exact), ...shuffleArray(adjacent)];
  return pool.slice(0, count);
}
import { scoreExplanation } from '@/lib/explanationScorer';

export type SectionStatus = 'covered' | 'partial' | 'missed';

export interface StructureBreakdown {
  beginning: { hit: number; total: number; status: SectionStatus };
  middle: { hit: number; total: number; status: SectionStatus };
  end: { hit: number; total: number; status: SectionStatus };
}

export interface NarrativeTrialResult {
  storyId: string;
  transcript: string;
  /** Key events mentioned */
  eventsFound: number;
  eventsTotal: number;
  /** Event coverage ratio (0-1) */
  eventCoverage: number;
  /** Which key events were matched */
  matchedEvents: string[];
  /** All key events for reference */
  allKeyEvents: string[];
  /** Coherence proxy: clause count / expected */
  coherenceScore: number;
  /** On-topic score (Jaccard with story text) */
  onTopicScore: number;
  /** Retell duration */
  durationMs: number;
  /** Mean utterance length proxy (words / sentence count) */
  meanUtteranceLength: number;
  /** Word count */
  wordCount: number;
  /** Was skipped */
  skipped: boolean;
  /** Beginning / Middle / End breakdown with hit/total counts */
  structureBreakdown: StructureBreakdown;
  /** Auto-generated next-step suggestion */
  nextStepHint: string;
  /** Depth telemetry blob for outputs.depth */
  depthTelemetry: {
    taskType: 'narrative_retell';
    eventCoverage: number;
    coherenceScore: number;
    ciuRate: number | null;
    meanUtteranceLength: number;
  };
  /** Visual scaffold telemetry (narrative_visual_fading_v1).
   *  Populated by the component; absent when the flag is OFF. */
  visualSupport?: {
    flagEnabled: boolean;
    adaptiveLevel: number;
    baselineSupport: number;
    /** Highest stall-driven reveal level reached during retell (0-3) */
    maxStallReveal: number;
    /** Highest resolved support level shown during retell (0-3) */
    maxResolvedSupport: number;
    /** Number of stall prompts surfaced this trial */
    stallCount: number;
    /** True if stall reveal pushed support above baseline */
    rescueTriggered: boolean;
  };
}

/** Map key events to narrative sections based on which scene they most relate to */
function getEventsForSection(story: NarrativeStory, section: 'beginning' | 'middle' | 'end'): string[] {
  const sceneIndices = story.structureMap[section];
  // Distribute key events proportionally across scenes
  const totalScenes = story.scenes.length;
  const totalEvents = story.keyEvents.length;
  const eventsPerScene = totalEvents / totalScenes;
  
  const events: string[] = [];
  for (const sceneIdx of sceneIndices) {
    const startEvent = Math.round(sceneIdx * eventsPerScene);
    const endEvent = Math.round((sceneIdx + 1) * eventsPerScene);
    for (let i = startEvent; i < endEvent && i < totalEvents; i++) {
      events.push(story.keyEvents[i]);
    }
  }
  return events;
}

function computeStructureBreakdown(story: NarrativeStory, matchedEvents: string[]): StructureBreakdown {
  const matchedLower = new Set(matchedEvents.map(e => e.toLowerCase()));
  
  const computeSection = (section: 'beginning' | 'middle' | 'end') => {
    const sectionEvents = getEventsForSection(story, section);
    const total = sectionEvents.length;
    if (total === 0) return { hit: 0, total: 0, status: 'covered' as SectionStatus };
    const hit = sectionEvents.filter(e => matchedLower.has(e.toLowerCase())).length;
    const status: SectionStatus = hit === total ? 'covered' : hit > 0 ? 'partial' : 'missed';
    return { hit, total, status };
  };

  return {
    beginning: computeSection('beginning'),
    middle: computeSection('middle'),
    end: computeSection('end'),
  };
}

function generateNextStepHint(breakdown: StructureBreakdown): string {
  // Prioritize missed > partial, and beginning > middle > end
  if (breakdown.beginning.status === 'missed') return 'Next time, try starting with what happened at the beginning of the story.';
  if (breakdown.middle.status === 'missed') return 'Next time, try including what happened in the middle of the story.';
  if (breakdown.end.status === 'missed') return 'Next time, try including how the story ended.';
  if (breakdown.beginning.status === 'partial') return 'You covered the beginning — try adding a few more details about how the story started.';
  if (breakdown.middle.status === 'partial') return 'Try adding more details about what happened in the middle.';
  if (breakdown.end.status === 'partial') return 'Try adding more detail about how the story ended.';
  return 'Great job covering the whole story! Try adding even more detail next time.';
}

export function useNarrativeRetellGame(roundCount: number = 3, tier: number = 1) {
  const seenIdsRef = useRef<Set<string>>(new Set());

  const initialStories = useMemo(() => {
    const built = buildStories(tier, roundCount, seenIdsRef.current);
    built.forEach((s) => seenIdsRef.current.add(s.id));
    return built;
    // Initial seed only — subsequent tier changes happen via setActiveTier below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [stories, setStories] = useState<NarrativeStory[]>(initialStories);
  const [activeTier, setActiveTierState] = useState<number>(tier);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<NarrativeTrialResult[]>([]);

  const currentStory: NarrativeStory | null = stories[currentIndex] ?? null;
  const isComplete = currentIndex >= stories.length;

  const scoreRetell = useCallback((transcript: string, durationMs: number, story: NarrativeStory): NarrativeTrialResult => {
    const emptyBreakdown: StructureBreakdown = {
      beginning: { hit: 0, total: 0, status: 'missed' },
      middle: { hit: 0, total: 0, status: 'missed' },
      end: { hit: 0, total: 0, status: 'missed' },
    };

    if (!transcript || transcript.trim().length < 3) {
      return {
        storyId: story.id, transcript: '', eventsFound: 0, eventsTotal: story.keyEvents.length,
        eventCoverage: 0, matchedEvents: [], allKeyEvents: story.keyEvents,
        coherenceScore: 0, onTopicScore: 0, durationMs, meanUtteranceLength: 0,
        wordCount: 0, skipped: true,
        structureBreakdown: emptyBreakdown,
        nextStepHint: 'Try telling the story from the beginning next time.',
        depthTelemetry: { taskType: 'narrative_retell', eventCoverage: 0, coherenceScore: 0, ciuRate: null, meanUtteranceLength: 0 },
      };
    }

    // Use explanation scorer to match key events
    const storyText = story.scenes.map(s => s.text).join(' ');
    const score = scoreExplanation(transcript, story.keyEvents, storyText);

    const words = transcript.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = Math.max(1, transcript.split(/[.!?]+/).filter(s => s.trim().length > 2).length);
    const meanUtteranceLength = wordCount / sentences;
    const coherenceScore = Math.min(1, sentences / story.expectedClauses);

    const structureBreakdown = computeStructureBreakdown(story, score.matchedConcepts);
    const nextStepHint = generateNextStepHint(structureBreakdown);

    const result: NarrativeTrialResult = {
      storyId: story.id,
      transcript,
      eventsFound: score.conceptsFound,
      eventsTotal: score.conceptsTotal,
      eventCoverage: score.coverageRatio,
      matchedEvents: score.matchedConcepts,
      allKeyEvents: story.keyEvents,
      coherenceScore,
      onTopicScore: score.onTopicScore,
      durationMs,
      meanUtteranceLength,
      wordCount,
      skipped: false,
      structureBreakdown,
      nextStepHint,
      depthTelemetry: {
        taskType: 'narrative_retell',
        eventCoverage: score.coverageRatio,
        coherenceScore,
        ciuRate: null,
        meanUtteranceLength,
      },
    };

    return result;
  }, []);

  const submitRetell = useCallback((transcript: string, durationMs: number): NarrativeTrialResult | null => {
    if (!currentStory) return null;
    const result = scoreRetell(transcript, durationMs, currentStory);
    setResults(prev => [...prev, result]);
    return result;
  }, [currentStory, scoreRetell]);

  const nextStory = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  /**
   * Mid-session content tier shift. Preserves already-played stories and
   * refreshes the upcoming queue with stories matching the new tier.
   */
  const setActiveTier = useCallback(
    (newTier: number) => {
      const clamped = Math.max(1, Math.min(3, newTier));
      if (clamped === activeTier) return;
      setActiveTierState(clamped);

      setStories((prev) => {
        const played = prev.slice(0, currentIndex + 1);
        played.forEach((s) => seenIdsRef.current.add(s.id));
        const remaining = Math.max(0, roundCount - played.length);
        if (remaining === 0) return played;
        const fresh = buildStories(clamped, remaining, seenIdsRef.current);
        fresh.forEach((s) => seenIdsRef.current.add(s.id));
        return [...played, ...fresh];
      });
    },
    [activeTier, currentIndex, roundCount],
  );

  return {
    currentStory,
    currentIndex,
    totalStories: stories.length,
    isComplete,
    results,
    submitRetell,
    nextStory,
    activeTier,
    setActiveTier,
  };
}
