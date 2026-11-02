import { describe, expect, it } from 'vitest';
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { CLINICAL_LADDER_REGISTRY, getTrackForSlug } from '@/lib/clinicalLadderRegistry';
import {
  CLINICAL_EVIDENCE_SOURCES,
  CLINICAL_GAME_EVIDENCE,
  EIGHT_STAGE_LADDER_VALIDATED,
  CLINICIAN_REVIEW_DOCUMENTED,
  LIVE_LADDER_ALIGNMENT_REVIEW_FLAGS,
  EVIDENCE_FIT_TEXT,
  getClinicalGameEvidence,
} from '@/lib/clinicalEvidenceRegistry';
import { getEightLevelCoverage } from '@/lib/clinicalEightLevelCoverage';

describe('29-game evidence design contract and measurement integrity', () => {
  const expected = [...CANONICAL_EXERCISES.map(game => game.slug), 'functional-scenes'].sort();

  it('requires clinical rationale and a standalone transfer plan for every game', () => {
    expect(Object.keys(CLINICAL_GAME_EVIDENCE).sort()).toEqual(expected);
    for (const slug of expected) {
      const game = getClinicalGameEvidence(slug);
      expect(game, slug).not.toBeNull();
      expect(game!.primaryProgressionAxis.trim().length, slug).toBeGreaterThan(20);
      expect(game!.gameplayMeasure.trim().length, slug).toBeGreaterThan(20);
      expect(game!.measurementConfound.trim().length, slug).toBeGreaterThan(20);
      expect(game!.untrainedTransferCheck.trim().length, slug).toBeGreaterThan(20);
      expect(game!.sources.length, slug).toBeGreaterThan(0);
      expect(['direct-method', 'related', 'exploratory'], slug).toContain(game!.evidenceFit);
      expect(getTrackForSlug(slug), slug).toBe(game!.track);
    }
    expect(getClinicalGameEvidence('not-a-game')).toBeNull();
  });

  it('cross-checks evidence claims against shipped vs design-only levels', () => {
    const coverage = getEightLevelCoverage();
    expect(coverage).toHaveLength(29);
    for (const game of coverage) {
      const record = getClinicalGameEvidence(game.slug);
      expect(record, game.slug).not.toBeNull();
      expect(CLINICAL_LADDER_REGISTRY[game.slug]?.rows).toHaveLength(8);
      if (!game.liveProgression) {
        expect(game.status, game.slug).toBe('design-only');
        expect(game.liveCeiling, game.slug).toBeNull();
        expect(game.plannedLevels, game.slug).toBe(8);
      }
      // Evidence for an intervention's method is not proof that all eight
      // app stages are working or that their numeric cutoffs are clinical.
      expect(EIGHT_STAGE_LADDER_VALIDATED).toBe(false);
      expect(CLINICIAN_REVIEW_DOCUMENTED).toBe(false);
    }
  });

  it('flags ALL 13 operational ladders for clinician review of their stage axis', () => {
    const live = getEightLevelCoverage().filter(g => g.liveProgression).map(g => g.slug).sort();
    expect(live).toHaveLength(13);
    expect(Object.keys(LIVE_LADDER_ALIGNMENT_REVIEW_FLAGS).sort()).toEqual(live);
    for (const slug of live) {
      expect(LIVE_LADDER_ALIGNMENT_REVIEW_FLAGS[slug].length, slug).toBeGreaterThan(60);
    }
    expect(LIVE_LADDER_ALIGNMENT_REVIEW_FLAGS['two-clues']).toMatch(/L8/);
    expect(LIVE_LADDER_ALIGNMENT_REVIEW_FLAGS['category-fluency']).toMatch(/time window/);
  });

  it('never routes non-linguistic or receptive gameplay as expressive recovery', () => {
    for (const slug of ['left-side-hunt', 'reach-tap', 'pattern-match']) {
      expect(getClinicalGameEvidence(slug)?.track).toBe('non-linguistic');
    }
    for (const slug of ['meaning-match', 'minimal-pairs', 'phonological-awareness', 'detective-mind', 'follow-directions', 'sequence-builder']) {
      expect(getClinicalGameEvidence(slug)?.track).toBe('receptive');
    }
  });

  it('requires traceable sources and correctly qualified design language', () => {
    const sources = Object.entries(CLINICAL_EVIDENCE_SOURCES);
    expect(sources.length).toBeGreaterThanOrEqual(6);
    for (const [key, source] of sources) {
      expect(source.label.length, key).toBeGreaterThan(15);
      expect(new URL(source.url).protocol).toBe('https:');
      expect(['guideline', 'clinical-practice', 'systematic-review', 'trial']).toContain(source.kind);
    }
    for (const [slug, game] of Object.entries(CLINICAL_GAME_EVIDENCE)) {
      for (const key of game.sources) expect(CLINICAL_EVIDENCE_SOURCES[key], slug).toBeDefined();
    }
    for (const description of Object.values(EVIDENCE_FIT_TEXT)) {
      expect(description).toMatch(/(not validated|not established|extrapolation)/);
    }
  });

  it('separates practised-word improvement from functional communication transfer', () => {
    const naming = getClinicalGameEvidence('photo-naming')!;
    const phrase = getClinicalGameEvidence('phrase-practice')!;
    const coach = getClinicalGameEvidence('conversation-coach')!;
    expect(naming.sources).toContain('BIG_CACTUS');
    expect(phrase.primaryProgressionAxis).toMatch(/functional/i);
    expect(coach.primaryProgressionAxis).toMatch(/interactional/i);
    expect(naming.untrainedTransferCheck).not.toBe(naming.gameplayMeasure);
    expect(coach.untrainedTransferCheck).not.toBe(coach.gameplayMeasure);
  });
});
