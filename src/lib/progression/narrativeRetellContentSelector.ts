/**
 * Narrative Retell clinical content selector.
 * One primary axis: number/complexity of meaningful details recalled.
 * Levels 1–3 MUST use short micro-stories. No fallback to four-event stories
 * when the patient is practicing only one fact.
 *
 * Upper levels retain the existing adult narrative bank. Their keyword-based
 * coverage metric is a practice proxy, NOT a validated story-grammar score.
 */
import { NARRATIVE_STORIES, type NarrativeStory } from '@/data/narrativeRetellStimuli';
import { MICRO_RECALL_STORIES } from '@/data/narrativeMicroRecall';

export interface NarrativeContentSpec {
  level: number;
  minFactsToRecall: number;
  label: string;
  stories: NarrativeStory[];
}

export function selectNarrativeContent(clinicalLevel: number): NarrativeContentSpec {
  const level = Math.max(1, Math.min(8, Math.round(clinicalLevel || 1)));
  if (level <= 3) {
    return {
      level,
      minFactsToRecall: level,
      label: `Remember ${level} ${level === 1 ? 'fact' : 'facts'}`,
      stories: MICRO_RECALL_STORIES.filter(s => s.microRecallLevel === level),
    };
  }
  // The longer-story stages are distinguished by event demand and original
  // story tier. Do not substitute a lower tier if the pool is too small.
  const spec = ({
    4: { tier: 1, min: 4, label: 'Remember four events from a short story' },
    5: { tier: 2, min: 4, label: 'Remember four events with cause and outcome' },
    6: { tier: 2, min: 5, label: 'Remember five connected events' },
    7: { tier: 3, min: 5, label: 'Remember five details from an inferential story' },
    8: { tier: 3, min: 6, label: 'Remember six details from an inferential story' },
  } as const)[level as 4 | 5 | 6 | 7 | 8];
  return {
    level,
    minFactsToRecall: spec.min,
    label: spec.label,
    stories: NARRATIVE_STORIES.filter(s => s.tier === spec.tier && s.keyEvents.length >= spec.min),
  };
}
