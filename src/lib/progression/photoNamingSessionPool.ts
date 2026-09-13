/**
 * Which words a Photo Naming session actually trains.
 *
 * From Level 4 the CLINICAL LEVEL, not the engine tier, chooses the vocabulary:
 * high-frequency at L4, mid-frequency at L5, category spread at L6, phrase
 * carriers at L7. `selectPhotoNamingPool` has encoded that since PR4 and is
 * unit-tested, but nothing in the running app could reach it —
 * `usePhotoNamingGame` consults it only when the caller supplies no
 * `customTrials`, and PhotoNamingExercise always supplies them. Every level from
 * 4 up therefore drew the same engine-tier pool, and four of the seven level-ups
 * (L1->L2, L3->L4, L4->L5, L7->L8) handed the patient a byte-identical word
 * list. The badge moved; the exercise did not.
 *
 * This is the one place that decision is made, so the page and its tests cannot
 * disagree about it.
 */
import { getTrialsForLevel, type PhotoTrial } from '@/data/photoBank';
import {
  selectPhotoNamingPool,
  writeSelectorDiagnostics,
} from '@/lib/progression/photoNamingContentSelector';

/**
 * L1–L3 stay on the engine pool because the selector is a documented no-op
 * there: those rungs are separated by how much support still counts as
 * on-target, not by vocabulary.
 */
export const CLINICAL_POOL_MIN_LEVEL = 4;

/**
 * L8 is held back deliberately. Its tier trains on PROBE_WORDS and tags the
 * trials `isAdvancedReviewTrial` so downstream aggregators can keep them out of
 * mastery statistics — but nothing outside the selector's own unit tests reads
 * that flag today. Enabling the tier would quietly feed the reserved
 * generalization probes into mastery and the clinical ladder as ordinary
 * trials, destroying the untrained-probe measure for exactly the patients
 * furthest along. Raise this once the flag is honoured end to end.
 */
export const CLINICAL_POOL_MAX_LEVEL = 7;

export interface PhotoNamingStockPoolArgs {
  /** Persistent clinical level 1–8, or null before it has loaded. */
  clinicalLevel: number | null | undefined;
  /** Effective engine difficulty 1–10 — the fallback pool's selector. */
  engineDifficulty: number;
  /** How many candidates to draw for the engine pool. */
  count: number;
  /** Session length, so a narrow tier never shortens the session. */
  totalTrials: number;
}

/**
 * Resolve the stock (non-custom, non-clinician-targeted) word pool.
 *
 * Clinician-targeted words and phonemes, the patient's own photos and Kids Mode
 * all keep the precedence they already have; this only replaces the anonymous
 * stock pool the level was supposed to be choosing all along.
 */
export function resolvePhotoNamingStockPool(
  args: PhotoNamingStockPoolArgs,
): PhotoTrial[] {
  const { clinicalLevel, engineDifficulty, count, totalTrials } = args;
  const engine = () => getTrialsForLevel(engineDifficulty, count) as PhotoTrial[];

  if (
    clinicalLevel == null ||
    !Number.isFinite(clinicalLevel) ||
    clinicalLevel < CLINICAL_POOL_MIN_LEVEL ||
    clinicalLevel > CLINICAL_POOL_MAX_LEVEL
  ) {
    return engine();
  }

  const selection = selectPhotoNamingPool(clinicalLevel);
  writeSelectorDiagnostics(selection, clinicalLevel);
  // The selector reports its own shortfalls rather than silently serving a thin
  // pool; when it does, the engine baseline is the honest answer.
  if (selection.fallback?.skipped || selection.pool.length === 0) return engine();

  const pool = selection.pool as unknown as PhotoTrial[];
  if (pool.length >= totalTrials) return pool;

  // A tier narrower than the session must not shorten it or repeat inside it —
  // top up from the engine pool with words the tier does not already carry.
  const held = new Set(pool.map((t) => t.target.toLowerCase()));
  return [...pool, ...engine().filter((t) => !held.has(t.target.toLowerCase()))];
}
