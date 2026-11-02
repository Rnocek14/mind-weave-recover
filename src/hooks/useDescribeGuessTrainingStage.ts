/**
 * Patient-owned, READ-ONLY Describe & Guess stage selection. Uses the existing
 * clinical_progression_state row, but does not assert/promote clinical mastery.
 * Only stages L1–L3 have executable supported description tasks.
 */
import { useEffect, useState } from 'react';
import { loadProgressionState } from '@/lib/progression/clinicalProgression';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { getDescribeGuessTrainingStage, type DescribeGuessTrainingStage } from '@/lib/describeGuess/trainingStages';

const LOAD_TIMEOUT_MS = 5000;

export interface DescribeGuessStageSnapshot {
  loaded: boolean;
  loadUnavailable: boolean;
  persistedLevel: number | null;
  stage: DescribeGuessTrainingStage | null;
}

export function useDescribeGuessTrainingStage({
  userId, profileId, offline = false,
}: {
  userId?: string | null;
  profileId?: string | null;
  offline?: boolean;
}): DescribeGuessStageSnapshot {
  // React can render a new patient one frame before its load effect runs.
  // Tie stage data to the exact owner scope so the previous patient's level
  // cannot briefly appear or seed a new phrase bank during that frame.
  const scope = offline ? 'offline' : JSON.stringify([userId ?? null, profileId ?? null]);
  const empty: DescribeGuessStageSnapshot = {
    loaded: false, loadUnavailable: false, persistedLevel: null, stage: null,
  };
  const [scoped, setScoped] = useState<{ scope: string; snapshot: DescribeGuessStageSnapshot }>({
    scope: '', snapshot: empty,
  });
  const setSnapshot = (snapshot: DescribeGuessStageSnapshot) => setScoped({ scope, snapshot });

  useEffect(() => {
    if (offline) {
      setSnapshot({
        loaded: true, loadUnavailable: false, persistedLevel: null,
        stage: getDescribeGuessTrainingStage(1),
      });
      return;
    }
    if (!userId || !profileId) {
      setSnapshot({ loaded: true, loadUnavailable: true, persistedLevel: null, stage: null });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot({ loaded: false, loadUnavailable: false, persistedLevel: null, stage: null });
    void (async () => {
      try {
        const saved = await Promise.race([
          loadProgressionState({ userId, profileId, exerciseSlug: CANONICAL_SLUGS.DESCRIBE_GUESS }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('DescribeGuess stage load timed out')), LOAD_TIMEOUT_MS);
          }),
        ]);
        if (!cancelled) {
          setSnapshot(saved.loadUnavailable
            ? { loaded: true, loadUnavailable: true, persistedLevel: null, stage: null }
            : {
              loaded: true, loadUnavailable: false,
              persistedLevel: saved.currentLevel,
              stage: getDescribeGuessTrainingStage(saved.currentLevel),
            });
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[DescribeGuessTrainingStage] progression read unavailable:', e);
          setSnapshot({ loaded: true, loadUnavailable: true, persistedLevel: null, stage: null });
        }
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [userId, profileId, offline]);

  return scoped.scope === scope ? scoped.snapshot : empty;
}
