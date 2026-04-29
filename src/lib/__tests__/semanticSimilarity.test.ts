/**
 * Signal-quality regression tests for semantic similarity.
 *
 * These tests assert the *contract* of getSemanticSimilarity, not the exact
 * embedding values. The embedding edge function is mocked so the tests are
 * deterministic and offline-safe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the supabase client BEFORE importing the SUT ───────────────────────
vi.mock('@/integrations/supabase/client', () => {
  // Stable pseudo-embeddings keyed by text — reproducible cosine values
  // Stable pseudo-embeddings keyed by text. We center each vector around 0
  // (subtract its mean) so cosine values reflect real semantic distance
  // rather than a shared positive bias from the PRNG.
  const vec = (seed: number, dim = 64) => {
    const out: number[] = [];
    // Mix the seed into a 32-bit state so small differences spread across all dims.
    let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1;
    for (let i = 0; i < dim; i++) {
      s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0;
      s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
      out.push((s >>> 0) / 0xffffffff);
    }
    const mean = out.reduce((a, b) => a + b, 0) / dim;
    return out.map(v => v - mean);
  };
  const banks: Record<string, number[]> = {
    knife:  vec(101),
    blade:  vec(102),    // adjacent seed → fairly close cosine
    cutter: vec(150),    // farther
    banana: vec(99991),  // unrelated
  };
  return {
    supabase: {
      functions: {
        invoke: async ({ body }: any) => {
          const t = (body?.text ?? '').toLowerCase();
          if (t in banks) return { data: { embedding: banks[t] } };
          // Unknown words: deterministic pseudo-random vector
          let seed = 0;
          for (const ch of t) seed += ch.charCodeAt(0);
          return { data: { embedding: vec(seed * 7) } };
        },
      },
    },
  };
});

import { getSemanticSimilarity, hasLexicalOverlap } from '../semanticSimilarity';

describe('getSemanticSimilarity — signal contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identical strings return 1.0', async () => {
    expect(await getSemanticSimilarity('knife', 'knife')).toBe(1.0);
  });

  it('keyboard-mash input is suppressed below partial-credit threshold', async () => {
    // "asdfgh" technically has a vowel ('a') so it bypasses the nonsense
    // short-circuit, but the lexical-overlap guard must still cap it.
    expect(await getSemanticSimilarity('asdfgh', 'knife')).toBeLessThan(0.55);
    expect(await getSemanticSimilarity('xkqzv', 'knife')).toBe(0); // no vowels
  });

  it('filler-only input returns 0', async () => {
    expect(await getSemanticSimilarity('um', 'knife')).toBe(0);
    expect(await getSemanticSimilarity('uhhh', 'knife')).toBe(0);
  });

  it('unrelated common words are capped below partial-credit threshold', async () => {
    // The signal-quality bug: "banana" vs "knife" used to come back ~0.65.
    // It must now stay below the partial-credit floor (0.55).
    const sim = await getSemanticSimilarity('banana', 'knife');
    expect(sim).toBeLessThan(0.55);
  });

  it('lexically overlapping morphology survives the guard', async () => {
    // "knives" / "knife" share "kni" — overlap should be detected.
    expect(hasLexicalOverlap('knives', 'knife')).toBe(true);
  });

  it('completely unrelated words have no lexical overlap', () => {
    expect(hasLexicalOverlap('banana', 'knife')).toBe(false);
  });
});
