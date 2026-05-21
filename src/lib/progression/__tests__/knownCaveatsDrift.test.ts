/**
 * Drift guard for KNOWN_CAVEATS ↔ per-game level specs.
 *
 * Contract:
 *   1. Every KNOWN_CAVEATS[slug][level] entry must point at a real level spec
 *      that ships content (i.e. `implemented !== false`). Caveats are meant
 *      to downgrade an otherwise-implemented tier to "partially-implemented";
 *      attaching one to a planned tier is misleading because deriveTierStatus
 *      would already report "planned" with its own message.
 *   2. Levels explicitly marked `implemented: false` MUST NOT also carry a
 *      KNOWN_CAVEATS entry (avoids the registry double-labeling a planned
 *      tier as partially implemented).
 *
 * This is intentionally cheap: if either side drifts, this test fails and
 * forces a deliberate update.
 */

import { describe, it, expect } from 'vitest';
import { KNOWN_CAVEATS, deriveTierStatusFromSpec } from '@/lib/clinicalIntegrity';
import { PHOTO_NAMING_LEVELS } from '@/lib/progression/photoNamingLevels';
import { FIX_SENTENCE_LEVELS } from '@/lib/progression/fixSentenceLevels';
import { MINIMAL_PAIRS_LEVELS } from '@/lib/progression/minimalPairsLevels';

type LevelsMap = Record<number | string, {
  contentSelector?: { implemented?: boolean; description?: string };
}>;

const REGISTRY: Record<string, LevelsMap> = {
  'photo-naming': PHOTO_NAMING_LEVELS as unknown as LevelsMap,
  'fix-sentence': FIX_SENTENCE_LEVELS as unknown as LevelsMap,
  'minimal-pairs': MINIMAL_PAIRS_LEVELS as unknown as LevelsMap,
};

describe('KNOWN_CAVEATS ↔ level-spec drift', () => {
  it('every caveat targets an existing level spec', () => {
    for (const [slug, levels] of Object.entries(KNOWN_CAVEATS)) {
      const specs = REGISTRY[slug];
      expect(specs, `unknown slug "${slug}" in KNOWN_CAVEATS`).toBeDefined();
      for (const level of Object.keys(levels)) {
        const spec = specs[level] ?? specs[Number(level)];
        expect(
          spec,
          `KNOWN_CAVEATS["${slug}"][${level}] has no matching level spec`,
        ).toBeDefined();
      }
    }
  });

  it('caveats only attach to tiers that ship content (implemented !== false)', () => {
    for (const [slug, levels] of Object.entries(KNOWN_CAVEATS)) {
      const specs = REGISTRY[slug];
      for (const level of Object.keys(levels)) {
        const spec = specs[level] ?? specs[Number(level)];
        const impl = spec?.contentSelector?.implemented;
        expect(
          impl,
          `KNOWN_CAVEATS["${slug}"][${level}] points at a planned tier (implemented: false); ` +
            `planned tiers carry their own status message and should not also be flagged as partial.`,
        ).not.toBe(false);
      }
    }
  });

  it('caveats round-trip through deriveTierStatusFromSpec as "partially-implemented"', () => {
    for (const [slug, levels] of Object.entries(KNOWN_CAVEATS)) {
      const specs = REGISTRY[slug];
      for (const level of Object.keys(levels)) {
        const spec = specs[level] ?? specs[Number(level)];
        const status = deriveTierStatusFromSpec(slug, Number(level), spec);
        expect(
          status.tierStatus,
          `expected "${slug}" L${level} to derive as partially-implemented from its caveat`,
        ).toBe('partially-implemented');
      }
    }
  });

  it('planned tiers (implemented: false) are NOT also listed in KNOWN_CAVEATS', () => {
    for (const [slug, specs] of Object.entries(REGISTRY)) {
      for (const [level, spec] of Object.entries(specs)) {
        if (spec?.contentSelector?.implemented === false) {
          const caveat = KNOWN_CAVEATS[slug]?.[Number(level)];
          expect(
            caveat,
            `"${slug}" L${level} is planned (implemented: false) but ALSO has a KNOWN_CAVEATS entry; ` +
              `pick one signal.`,
          ).toBeUndefined();
        }
      }
    }
  });
});
