/**
 * Implemented-tier ceiling primitive — Wave 0 safety contract.
 *
 * Every clinical ladder MUST declare which of its rungs actually ship live
 * content / scoring logic. The progression engine clamps level-up to this
 * ceiling so a patient never advances into a planned-but-empty tier and
 * silently receives baseline-fallback content labeled as the higher level.
 *
 * A rung is considered IMPLEMENTED when ALL of the following are true:
 *   1. Its `contentSelector.implemented` is not explicitly `false`.
 *   2. Its `readiness` is not `'aspirational'`. Aspirational rungs are
 *      design-of-record only — they have no live content bank and must
 *      never be served as a ceiling.
 *
 * `readiness: 'thin'` IS considered implemented (content bank exists but
 * is sparse). The ceiling clamp is about content existence, not quality;
 * thinness is surfaced via the readiness chip / clinician review.
 *
 * Usage in any per-game Levels.ts:
 *
 *   import { computeImplementedCeiling } from './_shared/implementedCeiling';
 *   export function highestImplementedSemanticFeaturesLevel(): number {
 *     return computeImplementedCeiling(SEMANTIC_FEATURES_LEVELS);
 *   }
 *
 * The result is then passed to `applySessionToState` as `maxImplementedLevel`,
 * which performs the actual clamp on `currentLevel` advancement.
 */

export interface CeilingSpec {
  contentSelector?: { implemented?: boolean } | Record<string, unknown> | undefined;
  readiness?: 'ready' | 'thin' | 'aspirational' | undefined;
}

export function isRungImplemented(spec: unknown): boolean {
  if (!spec || typeof spec !== 'object') return false;
  const s = spec as {
    readiness?: string;
    contentSelector?: { implemented?: boolean } | Record<string, unknown>;
  };
  if (s.readiness === 'aspirational') return false;
  const cs = s.contentSelector as { implemented?: boolean } | undefined;
  if (cs && cs.implemented === false) return false;
  return true;
}

/**
 * Highest level number whose spec passes `isRungImplemented`.
 * Floor of 1: a ladder with zero implemented rungs is a bug, but we return
 * 1 rather than 0 so engine bounds remain well-formed.
 */
export function computeImplementedCeiling(
  levels: Record<string | number, unknown>,
): number {
  let max = 1;
  for (const [lvl, spec] of Object.entries(levels)) {
    const n = Number(lvl);
    if (!Number.isFinite(n)) continue;
    if (isRungImplemented(spec)) max = Math.max(max, n);
  }
  return max;
}
