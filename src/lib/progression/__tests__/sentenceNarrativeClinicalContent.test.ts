import { describe, expect, it } from 'vitest';
import { MICRO_RECALL_STORIES } from '@/data/narrativeMicroRecall';
import { selectNarrativeContent } from '@/lib/progression/narrativeRetellContentSelector';
import {
  evidenceMetForNarrativeRetellLevel,
  calculateNarrativeRetellProgressDelta,
  highestImplementedNarrativeRetellLevel,
  storyMeetsNarrativeRecallTarget,
} from '@/lib/progression/narrativeRetellClinicalLevels';
import {
  SENTENCE_CLINICAL_DIFFICULTIES,
  getClinicalSentenceTrials,
  sentenceClinicalPool,
} from '@/lib/progression/sentenceConstructionContentSelector';
import {
  highestImplementedSentenceConstructionLevel,
  evidenceMetForSentenceConstructionLevel,
} from '@/lib/progression/sentenceConstructionLevels';
import { scoreExplanation } from '@/lib/explanationScorer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { scoreMicroRecall } from '@/lib/progression/narrativeMicroRecallScorer';

describe('Clinical progression: syntax and fact-recall content', () => {
  it('gives 18 distinct adult micro-stories at each of the 1/2/3-fact rungs', () => {
    expect(MICRO_RECALL_STORIES).toHaveLength(54);
    for (let level = 1; level <= 3; level++) {
      const selected = selectNarrativeContent(level);
      expect(selected.minFactsToRecall).toBe(level);
      expect(selected.stories).toHaveLength(18);
      expect(new Set(selected.stories.map(story => story.id)).size).toBe(18);
      for (const story of selected.stories) {
        expect(story.keyEvents).toHaveLength(level);
        expect(story.scenes).toHaveLength(level);
        expect(story.keyEvents.every(fact => fact.trim().length > 0)).toBe(true);
      }
    }
  });

  it('never silently borrows a long narrative for a one-fact target', () => {
    for (const level of [1, 2, 3]) {
      expect(selectNarrativeContent(level).stories.every(story => story.id.startsWith('micro-'))).toBe(true);
    }
    for (const level of [4, 5, 6, 7, 8]) {
      const cohort = selectNarrativeContent(level);
      expect(cohort.stories.length).toBeGreaterThanOrEqual(3);
      expect(cohort.stories.every(story => !story.id.startsWith('micro-'))).toBe(true);
      expect(cohort.stories.every(story => story.keyEvents.length >= cohort.minFactsToRecall)).toBe(true);
    }
    expect(highestImplementedNarrativeRetellLevel()).toBe(8);
  });

  it('requires the actual number of facts, not a loose coverage threshold', () => {
    expect(storyMeetsNarrativeRecallTarget({ eventsFound: 1, eventsTotal: 1, skipped: false }, 1)).toBe(true);
    expect(storyMeetsNarrativeRecallTarget({ eventsFound: 1, eventsTotal: 2, skipped: false }, 2)).toBe(false);
    expect(storyMeetsNarrativeRecallTarget({ eventsFound: 2, eventsTotal: 3, skipped: false }, 3)).toBe(false);
    expect(storyMeetsNarrativeRecallTarget({ eventsFound: 3, eventsTotal: 3, skipped: true }, 3)).toBe(false);
  });

  it('recognizes one-word clinical answers without accepting filler', () => {
    const scoring = scoreExplanation('milk', ['milk'], 'He bought milk');
    expect(scoring.conceptsFound).toBe(1);
    expect(scoring.coverageRatio).toBe(1);
    expect(validateSpokenResponse({ transcript: 'milk', expectedMode: 'naming' }).valid).toBe(true);
    expect(validateSpokenResponse({ transcript: 'um', expectedMode: 'naming' }).valid).toBe(false);
    expect(validateSpokenResponse({ transcript: 'milk', expectedMode: 'retell' }).valid).toBe(false);
  });

  it('never counts an unrelated spelling-neighbor as one recalled fact', () => {
    // The general explanation scorer allows edit-distance matches, which is
    // too permissive when a one-word guess earns the entire recall trial.
    expect(scoreMicroRecall('silk', ['milk']).eventsFound).toBe(0);
    expect(scoreMicroRecall('curse', ['nurse']).eventsFound).toBe(0);
    expect(scoreMicroRecall('milk', ['milk']).eventsFound).toBe(1);
    expect(scoreMicroRecall('He bought milk.', ['market', 'milk']).eventsFound).toBe(1);
    expect(scoreMicroRecall('Grocery store, then milk', ['market', 'milk']).eventsFound).toBe(2);
    expect(scoreMicroRecall('clapped', ['applauded']).eventsFound).toBe(1);
    expect(scoreMicroRecall('um um', ['milk']).eventsFound).toBe(0);
  });

  it('does not award promotion evidence from insufficient or all-incorrect retells', () => {
    const success = Array.from({ length: 3 }, () => ({ correct: true, support: 'independent' as const }));
    const incorrect = success.map(t => ({ ...t, correct: false }));
    expect(evidenceMetForNarrativeRetellLevel([], 1)).toBe(false);
    expect(evidenceMetForNarrativeRetellLevel(incorrect, 1)).toBe(false);
    expect(evidenceMetForNarrativeRetellLevel(success, 1)).toBe(true);
    expect(evidenceMetForNarrativeRetellLevel(success, 8)).toBe(true);
    expect(evidenceMetForNarrativeRetellLevel(success.map(t => ({ ...t, support: 'semantic_cue' as const })), 8)).toBe(false);
    expect(calculateNarrativeRetellProgressDelta(success, 1)).toBeGreaterThan(calculateNarrativeRetellProgressDelta(incorrect, 1));
    expect(calculateNarrativeRetellProgressDelta(incorrect, 1)).toBe(0);
  });

  it('provides real, nonempty grammar cohorts for all eight sentence rungs', () => {
    expect(highestImplementedSentenceConstructionLevel()).toBe(8);
    for (let level = 1; level <= 8; level++) {
      const permitted = SENTENCE_CLINICAL_DIFFICULTIES[level];
      const cohort = sentenceClinicalPool(level);
      expect(cohort.length).toBeGreaterThanOrEqual(6);
      expect(cohort.every(trial => permitted.includes(trial.difficulty))).toBe(true);
      expect(new Set(cohort.map(trial => trial.id)).size).toBe(cohort.length);
      expect(getClinicalSentenceTrials(level, 3, 10).every(t => permitted.includes(t.difficulty))).toBe(true);
      expect(getClinicalSentenceTrials(level, 3, 1).every(t => permitted.includes(t.difficulty))).toBe(true);
    }
  });

  it('requires actual choice-based sentence evidence rather than an automatic model', () => {
    const independentTiles = Array.from({ length: 8 }, () => ({ correct: true, support: 'choice_based' as const }));
    const heardModel = independentTiles.map(t => ({ ...t, support: 'highlight_plus_choice' as const }));
    expect(evidenceMetForSentenceConstructionLevel(independentTiles, 8)).toBe(true);
    expect(evidenceMetForSentenceConstructionLevel(heardModel, 8)).toBe(false);
  });
});
