/**
 * Patient-owned, READ-ONLY Phrase Practice stage selection. Uses the existing
 * clinical_progression_state row, but does not assert/promote clinical mastery.
 * Only stage L1–L3 has executable script presentation.
 */
import { useEffect, useState } from 'react';
import { loadProgressionState } from '@/lib/progression/clinicalProgression';
import { getPhraseTrainingStage, type PhraseTrainingStage } from '@/lib/phrasePractice/trainingStages';
import { CANONICAL_SLUGS, toProgressionSlug } from '@/lib/exerciseSlugNormalizer';

const LOAD_TIMEOUT_MS = 5000;

export interface PhraseStageSnapshot {
  loaded: boolean;
  loadUnavailable: boolean;
  persistedLevel: number | null;
  stage: PhraseTrainingStage | null;
}

export function usePhrasePracticeTrainingStage({
  userId, profileId, offline = false,
}: {
  userId?: string | null;
  profileId?: string | null;
  offline?: boolean;
}): PhraseStageSnapshot {
  // React can render a new patient one frame before its load effect runs.
  // Tie stage data to the exact owner scope so the previous patient's level
  // cannot briefly appear or seed a new phrase bank during that frame.
  const scope = offline ? 'offline' : JSON.stringify([userId ?? null, profileId ?? null]);
  const empty: PhraseStageSnapshot = {
    loaded: false, loadUnavailable: false, persistedLevel: null, stage: null,
  };
  const [scoped, setScoped] = useState<{ scope: string; snapshot: PhraseStageSnapshot }>({
    scope: '', snapshot: empty,
  });
  const setSnapshot = (snapshot: PhraseStageSnapshot) => setScoped({ scope, snapshot });

  useEffect(() => {
    if (offline) {
      setSnapshot({
        loaded: true, loadUnavailable: false, persistedLevel: null,
        stage: getPhraseTrainingStage(1),
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
          loadProgressionState({ userId, profileId, exerciseSlug: toProgressionSlug(CANONICAL_SLUGS.PHRASE_PRACTICE) }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Phrase stage load timed out')), LOAD_TIMEOUT_MS);
          }),
        ]);
        if (!cancelled) {
          setSnapshot(saved.loadUnavailable
            ? { loaded: true, loadUnavailable: true, persistedLevel: null, stage: null }
            : {
              loaded: true, loadUnavailable: false,
              persistedLevel: saved.currentLevel,
              stage: getPhraseTrainingStage(saved.currentLevel),
            });
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[PhraseTrainingStage] progression read unavailable:', e);
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
