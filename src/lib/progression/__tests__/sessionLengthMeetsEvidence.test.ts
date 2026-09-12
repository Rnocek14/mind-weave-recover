/**
 * A game's shipped session must be long enough to satisfy its own evidence rule.
 *
 * Clinical Progression v1 §5.3 requires BOTH 100% progress and the level's
 * evidence rule, and that rule counts on-target trials within ONE session. When
 * the default session is shorter than a rung's `minOnTargetAttempts`, evidence
 * can never be met: the progress bar sits at 100% and the patient is held below
 * the level they earned, permanently — Dual-Load Naming shipped 2 sets against a
 * 3-attempt rule and could never leave Level 1, while Multi-Step Plan, Synonym
 * Generator and Category Fluency froze at the first rung asking for 4.
 *
 * This is a contract, not a snapshot: if someone raises a rung's requirement or
 * shortens a session, one of these fails and names the game.
 */
import { describe, it, expect } from 'vitest';
import { DUAL_LOAD_NAMING_LEVELS, highestImplementedDualLoadNamingLevel } from '../dualLoadNamingLevels';
import { MULTI_STEP_PLANNING_LEVELS, highestImplementedMultiStepPlanningLevel } from '../multiStepPlanningLevels';
import { SYNONYM_GENERATOR_LEVELS, highestImplementedSynonymGeneratorLevel } from '../synonymGeneratorLevels';
import { CATEGORY_FLUENCY_LEVELS, highestImplementedCategoryFluencyLevel } from '../categoryFluencyLevels';

/** Default trials/rounds a standalone session ships with, per game page. */
const SHIPPED_SESSION_LENGTH: Record<string, number> = {
  'dual-load-naming': 4,
  'multi-step-plan': 4,
  'synonym-generator': 4,
  'category-fluency': 4,
};

const LADDERS: Array<{
  slug: string;
  levels: Record<number, { minOnTargetAttempts: number }>;
  ceiling: number;
}> = [
  { slug: 'dual-load-naming', levels: DUAL_LOAD_NAMING_LEVELS, ceiling: highestImplementedDualLoadNamingLevel() },
  { slug: 'multi-step-plan', levels: MULTI_STEP_PLANNING_LEVELS, ceiling: highestImplementedMultiStepPlanningLevel() },
  { slug: 'synonym-generator', levels: SYNONYM_GENERATOR_LEVELS, ceiling: highestImplementedSynonymGeneratorLevel() },
  { slug: 'category-fluency', levels: CATEGORY_FLUENCY_LEVELS, ceiling: highestImplementedCategoryFluencyLevel() },
];

describe('session length vs promotion evidence', () => {
  for (const { slug, levels, ceiling } of LADDERS) {
    it(`${slug}: every implemented rung is reachable in one shipped session`, () => {
      const shipped = SHIPPED_SESSION_LENGTH[slug];
      for (let level = 1; level <= ceiling; level++) {
        const spec = levels[level];
        if (!spec) continue;
        expect(
          spec.minOnTargetAttempts,
          `${slug} L${level} needs ${spec.minOnTargetAttempts} on-target trials but a session ships ${shipped}`,
        ).toBeLessThanOrEqual(shipped);
      }
    });
  }
});
