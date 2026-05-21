import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeTrialMode,
  isAdoptedForTrialMode,
  filterTrialsForExpressiveMastery,
} from '../masterySignalRouting';
import { computeMastery, type MasteryTrial } from '../computeMastery';

const now = new Date('2026-05-06T12:00:00Z');

function trial(
  daysBack: number,
  correct: boolean,
  trialMode: MasteryTrial['trialMode'] = 'production',
  cue = 0,
  sessionId = 's1',
): MasteryTrial {
  const d = new Date(now.getTime() - daysBack * 86400_000);
  return {
    is_correct: correct,
    cue_level: cue,
    created_at: d.toISOString(),
    session_id: sessionId,
    trialMode,
  };
}

describe('routeTrialMode (adopted slug = photo-naming)', () => {
  it('production → expressive', () => {
    expect(routeTrialMode('photo-naming', 'production')).toBe('expressive');
  });
  it('recognition → excluded', () => {
    expect(routeTrialMode('photo-naming', 'recognition')).toBe('excluded');
  });
  it('scaffolded → excluded', () => {
    expect(routeTrialMode('photo-naming', 'scaffolded')).toBe('excluded');
  });
  it('exposure → excluded', () => {
    expect(routeTrialMode('photo-naming', 'exposure')).toBe('excluded');
  });
  it('null → skipped_unknown for adopted slugs', () => {
    expect(routeTrialMode('photo-naming', null)).toBe('skipped_unknown');
    expect(routeTrialMode('photo-naming', undefined)).toBe('skipped_unknown');
  });
});

describe('routeTrialMode (non-adopted slugs)', () => {
  it('non-adopted slugs are skipped regardless of trial_mode (Phase 1+4 tightening)', () => {
    expect(routeTrialMode('multi-step-plan', null)).toBe('skipped_unknown');
    expect(routeTrialMode('multi-step-plan', 'recognition')).toBe('skipped_unknown');
    expect(routeTrialMode('synonym-generator', undefined)).toBe('skipped_unknown');
    expect(routeTrialMode('pattern_match', 'production')).toBe('skipped_unknown');
  });
  it('isAdoptedForTrialMode reflects the adoption set (canonical underscore)', () => {
    expect(isAdoptedForTrialMode('photo_naming')).toBe(true);
    expect(isAdoptedForTrialMode('photo-naming')).toBe(true); // normalized
    expect(isAdoptedForTrialMode('fix_sentence')).toBe(true);
    expect(isAdoptedForTrialMode('sentence_construction')).toBe(true);
    expect(isAdoptedForTrialMode('multi_step_plan')).toBe(false);
  });
});

describe('filterTrialsForExpressiveMastery', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('keeps only production trials for adopted slugs', () => {
    const trials = [
      trial(1, true, 'production'),
      trial(1, true, 'recognition'),
      trial(1, true, 'scaffolded'),
      trial(1, true, 'exposure'),
      trial(1, true, 'production'),
    ];
    const kept = filterTrialsForExpressiveMastery('photo-naming', trials);
    expect(kept).toHaveLength(2);
    expect(kept.every(t => t.trialMode === 'production')).toBe(true);
  });

  it('drops all trials for non-adopted slugs (Phase 1+4 tightening)', () => {
    const trials = [
      trial(1, true, null),
      trial(1, true, 'recognition'),
      trial(1, true, 'production'),
    ];
    const kept = filterTrialsForExpressiveMastery('two-clues', trials);
    expect(kept).toHaveLength(0);
  });

  it('skips and warns when adopted slug has missing trial_mode', () => {
    const trials = [trial(1, true, null), trial(1, true, 'production')];
    const kept = filterTrialsForExpressiveMastery('photo-naming', trials);
    expect(kept).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('integration: routing + computeMastery', () => {
  it('recognition trials do NOT inflate expressive mastery', () => {
    const allRecognition = Array.from({ length: 20 }, (_, i) =>
      trial(i % 5, true, 'recognition', 0, `s${i % 4}`),
    );
    const filtered = filterTrialsForExpressiveMastery('photo-naming', allRecognition);
    const r = computeMastery(filtered, null, now);
    expect(r.trials_total).toBe(0);
    expect(r.mastery_score).toBe(0);
  });

  it('scaffolded trials do NOT inflate expressive mastery', () => {
    const scaffolded = Array.from({ length: 20 }, (_, i) =>
      trial(i % 5, true, 'scaffolded', 0, `s${i % 4}`),
    );
    const filtered = filterTrialsForExpressiveMastery('photo-naming', scaffolded);
    expect(computeMastery(filtered, null, now).mastery_score).toBe(0);
  });

  it('exposure trials are ignored', () => {
    const exposure = Array.from({ length: 20 }, (_, i) =>
      trial(i % 5, true, 'exposure', 0, `s${i % 4}`),
    );
    const filtered = filterTrialsForExpressiveMastery('photo-naming', exposure);
    expect(filtered).toHaveLength(0);
  });

  it('production trials do contribute to expressive mastery', () => {
    const production = Array.from({ length: 20 }, (_, i) =>
      trial(i % 5, true, 'production', 0, `s${i % 4}`),
    );
    const filtered = filterTrialsForExpressiveMastery('photo-naming', production);
    const r = computeMastery(filtered, null, now);
    expect(r.trials_total).toBe(20);
    expect(r.mastery_score).toBeGreaterThan(0.5);
  });

  it('mixed batches use ONLY production trials', () => {
    const mixed = [
      ...Array.from({ length: 10 }, (_, i) => trial(i, true, 'production', 0, `p${i}`)),
      ...Array.from({ length: 10 }, (_, i) => trial(i, false, 'recognition', 3, `r${i}`)),
    ];
    const filtered = filterTrialsForExpressiveMastery('photo-naming', mixed);
    expect(filtered).toHaveLength(10);
    const r = computeMastery(filtered, null, now);
    // All retained trials are correct production → high mastery
    expect(r.accuracy_recent).toBe(1);
  });

  it('non-adopted slugs no longer contaminate expressive mastery (Phase 1+4)', () => {
    const legacy = Array.from({ length: 15 }, (_, i) =>
      trial(i % 5, true, null, 0, `s${i % 4}`),
    );
    const filtered = filterTrialsForExpressiveMastery('two-clues', legacy);
    expect(filtered).toHaveLength(0);
    const r = computeMastery(filtered, null, now);
    expect(r.trials_total).toBe(0);
    expect(r.mastery_score).toBe(0);
  });
});
