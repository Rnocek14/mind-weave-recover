/**
 * Adaptation Engine Cue-Gate Contract
 *
 * Wraps the existing `sessionSimulator` (which runs the REAL adaptation
 * controller + engagement monitor + cue-dependency safety gate that
 * `useInGameAdaptation` uses in production) in a deterministic vitest.
 *
 * For each of the 5 synthetic patient archetypes we assert the
 * simulator's built-in behavior validation reports:
 *   - zero failed assertions (gate fires when unsafe, narration non-empty,
 *     bounds respected, frustration → step-down)
 *   - zero inconsistencies (no missed blocking opportunities, no stuck
 *     high-accuracy ceilings)
 *
 * Pure deterministic: seeded mulberry32 PRNG, no I/O.
 * Read-only: imports the simulator and the engine; touches no logic.
 *
 * This is the engine-level analogue of `perGameLevelUpContract.test.ts`
 * — the 11 progression slugs that delegate cue-safety to
 * `useInGameAdaptation` (instead of having per-module gates like
 * fix_sentence / minimal_pairs) are covered transitively here.
 */
import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/lib/simulation/sessionSimulator';
import { USER_PROFILES, type ProfileId } from '@/lib/simulation/userProfiles';

const PROFILES: ProfileId[] = USER_PROFILES.map((p) => p.id);

describe('Adaptation Engine — cue-gate + behavior contract (simulator)', () => {
  it('covers all 5 archetypes (sanity)', () => {
    expect(PROFILES.sort()).toEqual(
      [
        'high_acc_low_cue',
        'high_acc_high_cue',
        'low_acc_high_frustration',
        'slow_fatigued',
        'mixed_errors',
      ].sort(),
    );
  });

  describe.each(PROFILES)('profile: %s', (profileId) => {
    const result = runSimulation({
      profileId,
      trials: 40,
      seed: 1,
      initialDifficulty: 3,
    });

    it('no failed behavior assertions', () => {
      const detail = result.assertions.failed
        .map((a) => `  - [${a.id}] ${a.description}${a.detail ? ` :: ${a.detail}` : ''}`)
        .join('\n');
      expect(
        result.assertions.failed.length,
        `Failed assertions for ${profileId}:\n${detail}`,
      ).toBe(0);
    });

    it('no inconsistencies (gate fires when conditions are met)', () => {
      const detail = result.assertions.inconsistencies.map((m) => `  - ${m}`).join('\n');
      expect(
        result.assertions.inconsistencies.length,
        `Inconsistencies for ${profileId}:\n${detail}`,
      ).toBe(0);
    });

    it('cue-gate: no escalation occurred while cueDependency > 0.5 AND trialsAtLevel < 8', () => {
      // Defense-in-depth: also assert directly against the trial log
      // (mirrors assertion `gate.no_unsafe_escalations` inside the simulator).
      const unsafe = result.log.filter(
        (l) =>
          l.difficultyChange?.direction === 'up' &&
          l.cueDependency > result.config.cueDependencyEscalationThreshold &&
          l.trialsAtLevel < result.config.minTrialsAtLevelForEscalation,
      );
      expect(
        unsafe.length,
        `Unsafe escalations at trials [${unsafe.map((u) => u.trialIndex).join(', ')}]`,
      ).toBe(0);
    });

    it('bounds: difficulty always within [floor, ceiling]', () => {
      const oob = result.log.filter(
        (l) => l.difficulty < result.config.floor || l.difficulty > result.config.ceiling,
      );
      expect(oob.length, `Out-of-bounds trials: ${oob.length}`).toBe(0);
    });
  });
});
