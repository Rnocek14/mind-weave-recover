/**
 * Narrative Retell Game Hook
 * 
 * State machine for the narrative retell depth task:
 * 1. Show story scenes one at a time
 * 2. User retells the story via speech
 * 3. Score against key events using explanation scorer infrastructure
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { NARRATIVE_STORIES, NarrativeStory } from '@/data/narrativeRetellStimuli';
import { shuffleArray } from '@/lib/shuffle';
import { scoreExplanation } from '@/lib/explanationScorer';

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
  /** Depth telemetry blob for outputs.depth */
  depthTelemetry: {
    taskType: 'narrative_retell';
    eventCoverage: number;
    coherenceScore: number;
    ciuRate: number | null;
    meanUtteranceLength: number;
  };
}

export function useNarrativeRetellGame(roundCount: number = 3, tier: number = 1) {
  const stories = useMemo(() => {
    const pool = NARRATIVE_STORIES.filter(s => s.tier <= Math.min(tier + 1, 3));
    return shuffleArray(pool).slice(0, roundCount);
  }, [roundCount, tier]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<NarrativeTrialResult[]>([]);

  const currentStory: NarrativeStory | null = stories[currentIndex] ?? null;
  const isComplete = currentIndex >= stories.length;

  const scoreRetell = useCallback((transcript: string, durationMs: number, story: NarrativeStory): NarrativeTrialResult => {
    if (!transcript || transcript.trim().length < 3) {
      return {
        storyId: story.id, transcript: '', eventsFound: 0, eventsTotal: story.keyEvents.length,
        eventCoverage: 0, coherenceScore: 0, onTopicScore: 0, durationMs, meanUtteranceLength: 0,
        wordCount: 0, skipped: true,
        depthTelemetry: { taskType: 'narrative_retell', eventCoverage: 0, coherenceScore: 0, ciuRate: null, meanUtteranceLength: 0 },
      };
    }

    // Use explanation scorer to match key events
    const storyText = story.scenes.map(s => s.text).join(' ');
    const score = scoreExplanation(transcript, story.keyEvents, storyText);

    const words = transcript.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    // Rough sentence count by periods, question marks, or just long pauses (>5 words chunks)
    const sentences = Math.max(1, transcript.split(/[.!?]+/).filter(s => s.trim().length > 2).length);
    const meanUtteranceLength = wordCount / sentences;
    const coherenceScore = Math.min(1, sentences / story.expectedClauses);

    const result: NarrativeTrialResult = {
      storyId: story.id,
      transcript,
      eventsFound: score.conceptsFound,
      eventsTotal: score.conceptsTotal,
      eventCoverage: score.coverageRatio,
      coherenceScore,
      onTopicScore: score.onTopicScore,
      durationMs,
      meanUtteranceLength,
      wordCount,
      skipped: false,
      depthTelemetry: {
        taskType: 'narrative_retell',
        eventCoverage: score.coverageRatio,
        coherenceScore,
        ciuRate: null, // TODO: real CIU from speech analysis pipeline
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

  return {
    currentStory,
    currentIndex,
    totalStories: stories.length,
    isComplete,
    results,
    submitRetell,
    nextStory,
  };
}
