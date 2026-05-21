/**
 * PR3 — Cue-dependency gate (Fix Sentence + Minimal Pairs).
 *
 * Contract: a session that hits the level's accuracy + minOnTargetAttempts
 * bars but where > 50% of trials landed below the target support tier
 * (scaffold-reliant) MUST hold the current level instead of graduating.
 *
 * Photo Naming is intentionally untouched in PR3 — verified by absence of
 * any Photo Naming wiring change.
 */
import { describe, it, expect } from 'vitest';
import {
  applySessionToState,
  defaultProgressionState,
  MAX_PROGRESS,
  type SupportLevel,
} from '../clinicalProgression';
import {
  calculateFixSentenceProgressDelta,
  cueDependencyForFixSentenceSession,
  evidenceMetForFixSentenceLevel,
  FIX_SENTENCE_CUE_DEPENDENCY_BLOCK_THRESHOLD,
  isFixSentenceCueDependencyBlocking,
} from '../fixSentenceLevels';
import {
  calculateMinimalPairsProgressDelta,
  cueDependencyForMinimalPairsSession,
  evidenceMetForMinimalPairsLevel,
  isMinimalPairsCueDependencyBlocking,
  MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD,
} from '../minimalPairsLevels';

const fsIds = (slug = 'fix-sentence') => ({ userId: 'u', profileId: 'p', exerciseSlug: slug });

function buildTrials(
  n: number,
  support: SupportLevel,
  correct = true,
): Array<{ correct: boolean; support: SupportLevel }> {
  return Array.from({ length: n }, () => ({ correct, support }));
}

describe('Fix Sentence — cue-dependency gate (PR3)', () => {
  it('threshold constant is 0.5 (mirrors in-game adaptive guard)', () => {
    expect(FIX_SENTENCE_CUE_DEPENDENCY_BLOCK_THRESHOLD).toBe(0.5);
  });

  it('open-response-only session: cue dependency = 0, not blocking', () => {
    const trials = buildTrials(10, 'open_response');
    expect(cueDependencyForFixSentenceSession(trials, 3)).toBe(0);
    expect(isFixSentenceCueDependencyBlocking(trials, 3)).toBe(false);
  });

  it('mostly-scaffolded session blocks level-up even when accuracy passes', () => {
    // L3 target is `open_response`. 4 on-target corrects (meets min=4 @ 100%),
    // but 8 choice-based corrects dominate the session → scaffolded ratio 8/12 > 0.5.
    const trials = [
      ...buildTrials(4, 'open_response', true),
      ...buildTrials(8, 'choice_based', true),
    ];
    const level = 3;

    const rawEvidence = evidenceMetForFixSentenceLevel(trials, level);
    const blocking = isFixSentenceCueDependencyBlocking(trials, level);
    expect(rawEvidence).toBe(true);
    expect(blocking).toBe(true);

    const progressDelta = calculateFixSentenceProgressDelta(trials, level) * 1000; // saturate
    const start = { ...defaultProgressionState(fsIds()), currentLevel: 3 };
    const next = applySessionToState(start, {
      trials,
      evidenceMet: rawEvidence && !blocking, // mirrors hook wiring
      progressDelta,
    });

    expect(next.currentLevel).toBe(3); // held
    expect(next.progressPct).toBe(MAX_PROGRESS); // capped, not graduated
  });

  it('same on-target evidence WITHOUT scaffold flood graduates the level', () => {
    const trials = buildTrials(10, 'open_response', true);
    const level = 3;
    const rawEvidence = evidenceMetForFixSentenceLevel(trials, level);
    const blocking = isFixSentenceCueDependencyBlocking(trials, level);
    expect(rawEvidence).toBe(true);
    expect(blocking).toBe(false);

    const progressDelta = calculateFixSentenceProgressDelta(trials, level) * 1000;
    const start = { ...defaultProgressionState(fsIds()), currentLevel: 3 };
    const next = applySessionToState(start, {
      trials,
      evidenceMet: rawEvidence && !blocking,
      progressDelta,
    });

    expect(next.currentLevel).toBe(4);
  });
});

describe('Minimal Pairs — cue-dependency gate (PR3)', () => {
  it('threshold constant is 0.5', () => {
    expect(MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD).toBe(0.5);
  });

  it('replay-heavy session at L4 (first_listen target) blocks level-up', () => {
    // L4 target = first_listen. min=6 @ 70%. Provide 6 first_listen corrects
    // (evidence ✓) plus 10 after_replay corrects → 10/16 = 0.625 > 0.5.
    const trials = [
      ...buildTrials(6, 'first_listen', true),
      ...buildTrials(10, 'after_replay', true),
    ];
    const level = 4;
    const rawEvidence = evidenceMetForMinimalPairsLevel(trials, level);
    const blocking = isMinimalPairsCueDependencyBlocking(trials, level);
    expect(rawEvidence).toBe(true);
    expect(blocking).toBe(true);
    expect(cueDependencyForMinimalPairsSession(trials, level)).toBeCloseTo(10 / 16, 5);

    const progressDelta = calculateMinimalPairsProgressDelta(trials, level) * 1000;
    const start = { ...defaultProgressionState(fsIds('minimal-pairs')), currentLevel: 4 };
    const next = applySessionToState(start, {
      trials,
      evidenceMet: rawEvidence && !blocking,
      progressDelta,
    });
    expect(next.currentLevel).toBe(4);
  });

  it('mostly-first-listen session at L4 graduates as expected', () => {
    const trials = [
      ...buildTrials(8, 'first_listen', true),
      ...buildTrials(2, 'after_replay', true),
    ];
    const level = 4;
    const rawEvidence = evidenceMetForMinimalPairsLevel(trials, level);
    const blocking = isMinimalPairsCueDependencyBlocking(trials, level);
    expect(rawEvidence).toBe(true);
    expect(blocking).toBe(false);

    const progressDelta = calculateMinimalPairsProgressDelta(trials, level) * 1000;
    const start = { ...defaultProgressionState(fsIds('minimal-pairs')), currentLevel: 4 };
    const next = applySessionToState(start, {
      trials,
      evidenceMet: rawEvidence && !blocking,
      progressDelta,
    });
    expect(next.currentLevel).toBe(5);
  });

  it('L1 (after_replay is on-target): replays do NOT block — gate only bites once independence is the target', () => {
    const trials = buildTrials(10, 'after_replay', true);
    const level = 1;
    expect(isMinimalPairsCueDependencyBlocking(trials, level)).toBe(false);
    expect(cueDependencyForMinimalPairsSession(trials, level)).toBe(0);
  });
});
