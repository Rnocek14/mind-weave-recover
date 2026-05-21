/**
 * buildLevelSpec — tiny factory shared by all per-game *Levels.ts modules.
 *
 * Purpose: keep each game's L1–L8 spec file short (~40 lines) and uniform.
 * It does NOT encode clinical thresholds — each game still supplies its own
 * `minOnTargetAttempts`, `minOnTargetAccuracy`, and `trialWeight`. The
 * factory just removes boilerplate (level ordering, readiness defaulting,
 * description trimming) so the clinical content stays front-and-centre.
 *
 * Pure module — no I/O, no React. Safe to import anywhere.
 */

import type { SupportLevel } from '../clinicalProgression';

export type Readiness = 'ready' | 'thin' | 'aspirational';

export interface BaseLevelSpec {
  level: number;
  description: string;
  /** Minimum support tier that counts as on-target evidence. */
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  /** Content-bank/runtime honesty flag. Defaults to 'ready'. */
  readiness?: Readiness;
  /** Per-level divisor for the game's progress delta. */
  trialWeight?: number;
  /** Optional per-level content-selector metadata. */
  contentSelector?: {
    tierKey: string;
    description: string;
    implemented?: boolean;
  };
}

/**
 * Build an indexed Record<number, T> from an unsorted array of level specs.
 * Throws if levels are not 1..N contiguous — catches accidental gaps that
 * would silently break the adaptation bridge.
 */
export function buildLevelTable<T extends BaseLevelSpec>(specs: T[]): Record<number, T> {
  const sorted = [...specs].sort((a, b) => a.level - b.level);
  const out: Record<number, T> = {};
  sorted.forEach((spec, idx) => {
    const expected = idx + 1;
    if (spec.level !== expected) {
      throw new Error(
        `buildLevelTable: expected level ${expected}, got ${spec.level}. ` +
          `Ladders must be contiguous 1..N with no gaps.`,
      );
    }
    out[spec.level] = { readiness: 'ready', ...spec };
  });
  return out;
}
