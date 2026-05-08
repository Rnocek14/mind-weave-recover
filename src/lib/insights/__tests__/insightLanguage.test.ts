/**
 * PR-B1 — Safety constitution tests for insightLanguage.ts
 *
 * These tests lock the contract:
 *   - Blacklist enforcement (assertSafePhrase throws).
 *   - Whitelisted frames never violate the blacklist.
 *   - Mastery-first ordering in composeInsights.
 *   - Empty output is valid.
 *   - Confidence gating (low / insufficient never emit).
 *   - Support lines capped at 1, total lines capped at maxLines.
 *   - No raw metric leaks (decimals, percentages).
 */

import { describe, it, expect } from 'vitest';
import {
  assertSafePhrase,
  composeInsights,
  resolveSignalToInsight,
  InsightSafetyError,
  type DigestSignal,
} from '../insightLanguage';

// Helpers --------------------------------------------------------------------

const sig = {
  cueLess: (
    confidence: DigestSignal['confidence'] = 'high',
  ): DigestSignal => ({
    kind: 'cue_support_changed',
    direction: 'less',
    dimension: 'cue_dependency',
    slug: 'photo-naming',
    trials: 12,
    confidence,
  }),
  cueMore: (
    confidence: DigestSignal['confidence'] = 'high',
  ): DigestSignal => ({
    kind: 'cue_support_changed',
    direction: 'more',
    dimension: 'cue_dependency',
    slug: 'photo-naming',
    trials: 12,
    confidence,
  }),
  pacingTightened: (): DigestSignal => ({
    kind: 'pacing_changed',
    direction: 'tightened',
    dimension: 'processing_speed',
    slug: 'two-clues',
    trials: 14,
    confidence: 'high',
  }),
  pacingEased: (): DigestSignal => ({
    kind: 'pacing_changed',
    direction: 'eased',
    dimension: 'processing_speed',
    slug: 'two-clues',
    trials: 14,
    confidence: 'medium',
  }),
  fatigueSupport: (): DigestSignal => ({
    kind: 'fatigue_support_activated',
    slug: 'narrative-retell',
    trials: 10,
    confidence: 'high',
  }),
  steadyCore: (): DigestSignal => ({
    kind: 'accuracy_held_steady',
    band: 'core',
    slug: 'fix-sentence',
    trials: 18,
    confidence: 'high',
  }),
  independence: (): DigestSignal => ({
    kind: 'independence_gain',
    dimension: 'independence',
    slug: 'photo-naming',
    trials: 12,
    confidence: 'high',
  }),
};

// 1. Blacklist enforcement ---------------------------------------------------

describe('assertSafePhrase — banned terms', () => {
  const badPhrases = [
    'Your accuracy decreased today.',
    'Performance declined this session.',
    'Cue dependency went down.',
    'Difficulty decreased to keep you going.',
    'You struggled with naming today.',
    'Z-score improved by 0.5.',
    'Down 12% on retrieval.',
    'Score: 0.42 today.',
    'Threshold crossed for cueing.',
    'You regressed on stretch trials.',
  ];

  it.each(badPhrases)('throws for: %s', (phrase) => {
    expect(() => assertSafePhrase(phrase)).toThrow(InsightSafetyError);
  });
});

describe('assertSafePhrase — safe phrases', () => {
  const goodPhrases = [
    'Less support was needed today.',
    'Held steady through core practice.',
    'Pacing eased to match today’s effort.',
    'More independent today.',
  ];

  it.each(goodPhrases)('accepts: %s', (phrase) => {
    expect(() => assertSafePhrase(phrase)).not.toThrow();
  });
});

// 2. Whitelist integrity -----------------------------------------------------

describe('whitelist integrity', () => {
  it('every resolvable signal produces a phrase that passes the blacklist', () => {
    const allSignals: DigestSignal[] = [
      sig.cueLess(),
      sig.cueMore(),
      sig.pacingEased(),
      sig.pacingTightened(),
      sig.fatigueSupport(),
      sig.steadyCore(),
      sig.independence(),
      {
        kind: 'distractor_load_changed',
        direction: 'fewer',
        dimension: 'distractor_load',
        slug: 'meaning-match',
        trials: 12,
        confidence: 'high',
      },
      {
        kind: 'distractor_load_changed',
        direction: 'more',
        dimension: 'distractor_load',
        slug: 'meaning-match',
        trials: 12,
        confidence: 'high',
      },
      {
        kind: 'task_complexity_changed',
        direction: 'simpler',
        dimension: 'linguistic_complexity',
        slug: 'fix-sentence',
        trials: 12,
        confidence: 'high',
      },
      {
        kind: 'task_complexity_changed',
        direction: 'harder',
        dimension: 'working_memory_load',
        slug: 'multi-step-plan',
        trials: 12,
        confidence: 'high',
      },
    ];
    for (const s of allSignals) {
      const insight = resolveSignalToInsight(s);
      expect(insight).not.toBeNull();
      expect(() => assertSafePhrase(insight!.text)).not.toThrow();
    }
  });
});

// 3. Confidence gating -------------------------------------------------------

describe('confidence gating', () => {
  it('omits low-confidence signals', () => {
    expect(resolveSignalToInsight(sig.cueLess('low'))).toBeNull();
  });
  it('omits insufficient-confidence signals', () => {
    expect(resolveSignalToInsight(sig.cueLess('insufficient'))).toBeNull();
  });
  it('emits medium-confidence signals', () => {
    expect(resolveSignalToInsight(sig.cueLess('medium'))).not.toBeNull();
  });
});

// 4. Mastery-first ordering --------------------------------------------------

describe('composeInsights — mastery-first ordering', () => {
  it('places mastery lines before support lines', () => {
    const out = composeInsights([sig.fatigueSupport(), sig.independence()]);
    expect(out).toHaveLength(2);
    expect(out[0].category).toBe('mastery');
    expect(out[1].category).toBe('support');
  });

  it('places mastery before steady before support', () => {
    const out = composeInsights(
      [sig.fatigueSupport(), sig.steadyCore(), sig.independence()],
      { maxLines: 3 },
    );
    expect(out.map((i) => i.category)).toEqual(['mastery', 'steady', 'support']);
  });

  it('high confidence wins ties within same category', () => {
    const out = composeInsights(
      [sig.pacingEased(), sig.cueMore('high')],
      { maxLines: 2 },
    );
    // Both are 'support' — high confidence comes first; second support is dropped.
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe('high');
  });
});

// 5. Caps and dedupe ---------------------------------------------------------

describe('composeInsights — caps and dedupe', () => {
  it('respects maxLines (default 2)', () => {
    const out = composeInsights([
      sig.independence(),
      sig.steadyCore(),
      sig.cueLess(),
      sig.pacingTightened(),
    ]);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('caps support lines at 1 even when many support signals are present', () => {
    const out = composeInsights(
      [sig.fatigueSupport(), sig.cueMore(), sig.pacingEased()],
      { maxLines: 5 },
    );
    const supportCount = out.filter((i) => i.category === 'support').length;
    expect(supportCount).toBeLessThanOrEqual(1);
  });

  it('dedupes identical phrases from different signals', () => {
    // independence_gain:cue_dependency and cue_support_changed:less are different
    // frames, so use two identical signals to force a duplicate.
    const out = composeInsights([sig.cueLess(), sig.cueLess()], { maxLines: 5 });
    expect(out).toHaveLength(1);
  });
});

// 6. Empty output is valid ---------------------------------------------------

describe('composeInsights — empty output is valid', () => {
  it('returns [] for no signals', () => {
    expect(composeInsights([])).toEqual([]);
  });

  it('returns [] when every signal is below confidence bar', () => {
    expect(
      composeInsights([sig.cueLess('low'), sig.pacingEased(), sig.steadyCore()].map(
        (s) => ({ ...s, confidence: 'low' as const }),
      )),
    ).toEqual([]);
  });

  it('returns [] when maxLines is 0', () => {
    expect(composeInsights([sig.independence()], { maxLines: 0 })).toEqual([]);
  });
});
