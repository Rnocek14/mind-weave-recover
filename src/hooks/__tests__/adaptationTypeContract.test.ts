/**
 * The Insights page counted "adaptations" by filtering adaptation_events on a
 * type no writer has ever emitted ('difficulty_change'), so its Adaptations
 * stat and "Difficulty Adjustments" list were empty for every patient. The
 * reader now filters on the writer's own set.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DIFFICULTY_CHANGE_TYPES, type AdaptationType } from '@/hooks/useAdaptationEventLogger';

describe('adaptation_events reader/writer contract', () => {
  it('the difficulty-movement set is exactly what the in-game logger can emit for a level move', () => {
    const set: readonly AdaptationType[] = DIFFICULTY_CHANGE_TYPES; // compile-time: members of the union
    expect([...set].sort()).toEqual(['difficulty_down', 'difficulty_up', 'frustration_stepdown']);
  });

  it('the Insights reader filters on that set and not on a type nobody writes', () => {
    const src = readFileSync('src/hooks/useOutcomeProof.ts', 'utf8');
    expect(src).not.toMatch(/'difficulty_change'/);
    expect(src).toMatch(/DIFFICULTY_CHANGE_TYPES/);
  });
});
