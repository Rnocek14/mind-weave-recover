/**
 * Clinical Simulation Lab — Phase 0 characterization tests.
 *
 * Synthetic fixtures only. No patient identifiers, database writes, external
 * network calls, Azure calls, or claims of clinical validation.
 *
 * These tests protect existing behavior while we prepare an isolated
 * end-to-end speech/audio replay harness.
 */
import { describe, expect, it } from 'vitest';
import {
  getWordsContainingPhoneme,
  getWordsByPhonemeOverlap,
  normalizePhoneme,
  wordContainsPhoneme,
} from '@/lib/phonemeWordMap';
import {
  buildProgressionPlanningSignals,
  type ProgressionRow,
} from '@/lib/progressionPlanningSignals';

function row(exercise_slug: string, changes: Partial<ProgressionRow> = {}): ProgressionRow {
  return {
    exercise_slug,
    current_level: 1,
    progress_pct: 0,
    support_baseline: 0,
    stable_level: 1,
    consecutive_success_sessions: 0,
    consecutive_struggle_sessions: 0,
    ...changes,
  };
}

describe('Clinical Simulation Lab: speech-sound selection characterization', () => {
  it('normalizes Azure R, IPA /r/ and /ɹ/ to one targeting key', () => {
    expect(normalizePhoneme('R')).toBe(normalizePhoneme('/r/'));
    expect(normalizePhoneme('/ɹ/')).toBe(normalizePhoneme('/r/'));
  });

  it('finds known initial /r/ words in the phoneme map', () => {
    const targets = getWordsContainingPhoneme('/r/');
    for (const word of ['red', 'rose', 'rain', 'rabbit']) {
      expect(targets).toContain(word);
      expect(wordContainsPhoneme(word, '/r/')).toBe(true);
    }
  });

  it('does not mistake an unmapped word for a confirmed sound target', () => {
    expect(wordContainsPhoneme('unmapped-clinical-stimulus', '/r/')).toBe(false);
  });

  it('ranks mapped target words deterministically and respects the limit', () => {
    const a = getWordsByPhonemeOverlap(['/r/', '/s/'], 12);
    const b = getWordsByPhonemeOverlap(['/r/', '/s/'], 12);
    expect(a).toEqual(b);
    expect(a).toHaveLength(12);
    expect(a.every(x => x.matchCount >= 1 && x.matchingPhonemes.length >= 1)).toBe(true);
  });
});

describe('Clinical Simulation Lab: daily-game priority characterization', () => {
  it('increases selection priority after repeated struggling sessions', () => {
    const signals = buildProgressionPlanningSignals([
      row('photo-naming', { current_level: 3, consecutive_struggle_sessions: 2 }),
    ]);
    const target = signals.byExercise.get('photo-naming');
    expect(target?.status).toBe('struggling');
    expect(target?.planningBoost).toBe(2);
  });

  it('does not directly alter the clinical level when reprioritizing a game', () => {
    const state = row('photo-naming', { current_level: 4, consecutive_struggle_sessions: 3 });
    const signal = buildProgressionPlanningSignals([state]).byExercise.get('photo-naming');
    expect(signal?.currentLevel).toBe(4);
    expect(state.current_level).toBe(4);
  });

  it('documents existing cross-game lagging comparison, pending clinical redesign', () => {
    const signals = buildProgressionPlanningSignals([
      row('photo-naming', { current_level: 7, consecutive_success_sessions: 1 }),
      row('minimal-pairs', { current_level: 1, consecutive_success_sessions: 1 }),
    ]);
    // CHARACTERIZATION ONLY: this comparison of different clinical ladders
    // should NOT be interpreted as evidence of a clinical deficit.
    expect(signals.byExercise.get('minimal-pairs')?.status).toBe('lagging');
  });
});
