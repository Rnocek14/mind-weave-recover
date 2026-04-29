/**
 * Adaptive Level Registry
 *
 * Process-local key→level map that lets any adaptive controller publish its
 * current canonical 1–10 GameLevel for a given (sessionId, exerciseSlug)
 * pair. `useExerciseTelemetry.logTrial` reads from this registry and
 * automatically injects `game_level` into every telemetry row, so individual
 * pages no longer have to hand-thread the value.
 *
 * Why a registry instead of context?
 *  - Many games adapt deep inside `useInGameAdaptation` while telemetry is
 *    written by `useExerciseTelemetry` mounted at the page level. The two
 *    hooks live in unrelated branches of the React tree.
 *  - A tiny module-scoped map gives both sides a stable, race-free handle
 *    without requiring a provider that wraps every exercise route.
 *
 * The registry stores the *canonical 1–10 level only*. Internal tier (1–3,
 * 1–5, etc.) stays inside each game.
 *
 * Layer 1 telemetry plumbing only — no clinical decisions live here.
 */

import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

export type AdaptiveSource =
  | 'in_game_adaptation'      // useInGameAdaptation
  | 'adaptive_difficulty'     // useAdaptiveDifficulty (legacy)
  | 'discourse_adaptation'    // useDiscourseAdaptation (1–5 → 1–10)
  | 'dynamic_tier'            // useDynamicTier (page-level wrapper)
  | 'manual';                 // explicit per-page override

export interface AdaptiveLevelEntry {
  /** Canonical 1–10. */
  gameLevel: number;
  /** Game-internal tier (1–3, 1–5, 1–10, …). */
  internalDifficulty: number;
  /** Which controller set the value (for audit). */
  source: AdaptiveSource;
  /** When the value was last published. */
  updatedAt: number;
}

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes — discard zombie entries

const registry = new Map<string, AdaptiveLevelEntry>();

function buildKey(sessionId: string | null | undefined, slug: string): string {
  const sid = sessionId ?? 'no_session';
  return `${sid}::${normalizeExerciseSlug(slug)}`;
}

/**
 * Publish the current adaptive level. Adaptation hooks call this whenever
 * their current level (or initial level) changes.
 */
export function publishAdaptiveLevel(params: {
  sessionId: string | null | undefined;
  exerciseSlug: string;
  gameLevel: number;
  internalDifficulty: number;
  source: AdaptiveSource;
}): void {
  if (!params.exerciseSlug) return;
  if (!Number.isFinite(params.gameLevel)) return;
  const clampedLevel = Math.max(1, Math.min(10, Math.round(params.gameLevel)));
  registry.set(buildKey(params.sessionId, params.exerciseSlug), {
    gameLevel: clampedLevel,
    internalDifficulty: Number.isFinite(params.internalDifficulty)
      ? params.internalDifficulty
      : clampedLevel,
    source: params.source,
    updatedAt: Date.now(),
  });
}

/**
 * Look up the most recent level for this (session, exercise). Returns null
 * if nothing has published yet, or if the entry is stale (the page likely
 * unmounted without clearing).
 */
export function readAdaptiveLevel(
  sessionId: string | null | undefined,
  exerciseSlug: string,
): AdaptiveLevelEntry | null {
  if (!exerciseSlug) return null;
  const entry = registry.get(buildKey(sessionId, exerciseSlug));
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > STALE_AFTER_MS) {
    registry.delete(buildKey(sessionId, exerciseSlug));
    return null;
  }
  return entry;
}

/**
 * Drop the registry entry — called on unmount so a stale level from a prior
 * exercise can never bleed into the next one.
 */
export function clearAdaptiveLevel(
  sessionId: string | null | undefined,
  exerciseSlug: string,
): void {
  if (!exerciseSlug) return;
  registry.delete(buildKey(sessionId, exerciseSlug));
}

/** Test helper — wipe everything. Not used at runtime. */
export function _resetAdaptiveLevelRegistryForTests(): void {
  registry.clear();
}
