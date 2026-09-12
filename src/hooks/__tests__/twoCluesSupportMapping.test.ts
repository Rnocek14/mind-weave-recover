/**
 * Two Clues support level must describe the HELP GIVEN, not the answer quality.
 *
 * `mapTwoCluesSupport` used to take `reachedAnchor` — a match tier meaning
 * "the spoken word hit one of the puzzle's anchor words". Producing the
 * intended target, the best possible outcome, was therefore recorded as
 * `semantic_cue` (0.6 credit) while a vaguer cluster word was recorded as
 * `independent` (1.0). Levels 3 to 7 all target `independent`, so a patient
 * answering perfectly generated no on-target evidence and the ladder could
 * never advance.
 *
 * Contract: docs/unified-trial-contract.md — supportUsed is "derived from
 * observed in-trial scaffolding, never inferred".
 */
import { describe, it, expect } from 'vitest';
import { mapTwoCluesSupport } from '@/hooks/useTwoCluesProgression';
import { SUPPORT_CREDIT } from '@/lib/progression/clinicalProgression';

describe('mapTwoCluesSupport', () => {
  it('reads the cue ladder the game actually delivered', () => {
    expect(mapTwoCluesSupport(0)).toBe('independent');
    expect(mapTwoCluesSupport(1)).toBe('semantic_cue');
    expect(mapTwoCluesSupport(2)).toBe('phonemic_cue');
    expect(mapTwoCluesSupport(3)).toBe('carrier_or_full_model');
  });

  it('treats an unhelped answer as independent regardless of how good it was', () => {
    // The old mapping inverted exactly this case.
    expect(mapTwoCluesSupport(0)).toBe('independent');
    expect(SUPPORT_CREDIT[mapTwoCluesSupport(0)]).toBeGreaterThan(
      SUPPORT_CREDIT[mapTwoCluesSupport(1)],
    );
  });

  it('never credits more help than was given', () => {
    const credits = [0, 1, 2, 3].map((c) => SUPPORT_CREDIT[mapTwoCluesSupport(c)]);
    for (let i = 1; i < credits.length; i++) {
      expect(credits[i]).toBeLessThanOrEqual(credits[i - 1]);
    }
  });

  it('clamps out-of-range and missing input', () => {
    expect(mapTwoCluesSupport(-1)).toBe('independent');
    expect(mapTwoCluesSupport(99)).toBe('carrier_or_full_model');
    expect(mapTwoCluesSupport(undefined as unknown as number)).toBe('independent');
  });
});
