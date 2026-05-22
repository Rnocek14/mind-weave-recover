/**
 * Phase 1A — Per-game progression load-gate contract tests.
 *
 * Consolidated counterpart to fixSentenceProgression.hookContract.test.ts and
 * photoNamingProgression.hookContract.test.ts. Covers the remaining 11 wired
 * per-game progression hooks. Each one MUST satisfy the same contract:
 *
 *   1. First render → loaded === false && startingLevel === null
 *      (gate prevents games from rendering with a stale level before the
 *      DB read resolves)
 *   2. After loadProgressionState resolves with currentLevel = N
 *      → loaded === true && startingLevel === N
 *
 * Read-only. Mocks the persistence layer only — no progression math,
 * scoring, mastery routing, or content banks are touched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let resolveLoad: ((v: unknown) => void) | null = null;
vi.mock('@/lib/progression/clinicalProgression', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/progression/clinicalProgression')>();
  return {
    ...actual,
    loadProgressionState: vi.fn(
      () =>
        new Promise((res) => {
          resolveLoad = res;
        }),
    ),
    saveProgressionState: vi.fn(async () => ({ ok: true })),
  };
});

// Imports must come after vi.mock for hoisting to take effect.
import { useCategoryFluencyProgression } from '@/hooks/useCategoryFluencyProgression';
import { useDetectiveMindProgression } from '@/hooks/useDetectiveMindProgression';
import { useDualLoadNamingProgression } from '@/hooks/useDualLoadNamingProgression';
import { useMeaningMatchProgression } from '@/hooks/useMeaningMatchProgression';
import { useMinimalPairsProgression } from '@/hooks/useMinimalPairsProgression';
import { useMultiStepPlanningProgression } from '@/hooks/useMultiStepPlanningProgression';
import { usePhonologicalAwarenessProgression } from '@/hooks/usePhonologicalAwarenessProgression';
import { useSemanticFeaturesProgression } from '@/hooks/useSemanticFeaturesProgression';
import { useSentenceConstructionProgression } from '@/hooks/useSentenceConstructionProgression';
import { useSynonymGeneratorProgression } from '@/hooks/useSynonymGeneratorProgression';
import { useTwoCluesProgression } from '@/hooks/useTwoCluesProgression';

type ProgressionHook = (args: {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}) => {
  loaded: boolean;
  startingLevel: number | null;
};

const CASES: Array<{ name: string; slug: string; hook: ProgressionHook; level: number }> = [
  { name: 'Category Fluency',        slug: 'category-fluency',        hook: useCategoryFluencyProgression as ProgressionHook, level: 2 },
  { name: 'Detective Mind',          slug: 'detective-mind',          hook: useDetectiveMindProgression as ProgressionHook, level: 3 },
  { name: 'Dual-Load Naming',        slug: 'dual-load-naming',        hook: useDualLoadNamingProgression as ProgressionHook, level: 4 },
  { name: 'Meaning Match',           slug: 'meaning-match',           hook: useMeaningMatchProgression as ProgressionHook, level: 2 },
  { name: 'Minimal Pairs',           slug: 'minimal-pairs',           hook: useMinimalPairsProgression as ProgressionHook, level: 3 },
  { name: 'Multi-Step Planning',     slug: 'multi-step-plan',         hook: useMultiStepPlanningProgression as ProgressionHook, level: 2 },
  { name: 'Phonological Awareness',  slug: 'phonological-awareness',  hook: usePhonologicalAwarenessProgression as ProgressionHook, level: 3 },
  { name: 'Semantic Features',       slug: 'semantic-features',       hook: useSemanticFeaturesProgression as ProgressionHook, level: 4 },
  { name: 'Sentence Construction',   slug: 'sentence-construction',   hook: useSentenceConstructionProgression as ProgressionHook, level: 2 },
  { name: 'Synonym Generator',       slug: 'synonym-generator',       hook: useSynonymGeneratorProgression as ProgressionHook, level: 3 },
  { name: 'Two Clues',               slug: 'two-clues',               hook: useTwoCluesProgression as ProgressionHook, level: 2 },
];

describe.each(CASES)('$name — progression load-gate contract', ({ slug, hook, level }) => {
  beforeEach(() => {
    resolveLoad = null;
  });

  it('first render: loaded=false, startingLevel=null', () => {
    const { result } = renderHook(() => hook({ userId: 'u1', profileId: 'p1' }));
    expect(result.current.loaded).toBe(false);
    expect(result.current.startingLevel).toBeNull();
  });

  it(`after load resolves with currentLevel=${level}, startingLevel=${level}`, async () => {
    const { result } = renderHook(() => hook({ userId: 'u1', profileId: 'p1' }));

    await act(async () => {
      resolveLoad?.({
        userId: 'u1',
        profileId: 'p1',
        exerciseSlug: slug,
        currentLevel: level,
        progressPct: 0,
        supportBaseline: 'independent',
        consecutiveStruggleSessions: 0,
        lastSessionId: null,
      });
    });

    expect(result.current.loaded).toBe(true);
    expect(result.current.startingLevel).toBe(level);
  });
});
