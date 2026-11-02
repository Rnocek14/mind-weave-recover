/**
 * Read-only patient-specific Thought Continuation practice stage.
 *
 * A failed clinical_progression_state read is not permission to reset a
 * patient to Stage 1; nor can a prior patient's stage cross a profile switch.
 * No level write, advancement, or clinical score is performed here.
 */
import { useEffect, useState } from 'react';
import { loadProgressionState } from '@/lib/progression/clinicalProgression';
import { CANONICAL_SLUGS, toProgressionSlug } from '@/lib/exerciseSlugNormalizer';
import {
  getThoughtTrainingStage,
  type ThoughtTrainingStage,
} from '@/lib/thoughtContinuation/trainingStages';

const LOAD_TIMEOUT_MS = 5000;
const SLUG = toProgressionSlug(CANONICAL_SLUGS.THOUGHT_CONTINUATION);

export interface ThoughtTrainingStageLoad {
  loaded: boolean;
  loadUnavailable: boolean;
  persistedLevel: number | null;
  stage: ThoughtTrainingStage | null;
}

const EMPTY: ThoughtTrainingStageLoad = {
  loaded: false,
  loadUnavailable: false,
  persistedLevel: null,
  stage: null,
};

export function useThoughtContinuationTrainingStage({
  userId, profileId, offline = false,
}: {
  userId?: string | null;
  profileId?: string | null;
  offline?: boolean;
}): ThoughtTrainingStageLoad {
  // Compare scope DURING render: effect cleanup cannot prevent the first
  // render after a patient switch from briefly showing the previous stage.
  const scope = offline ? 'offline' : JSON.stringify([userId ?? null, profileId ?? null]);
  const [scoped, setScoped] = useState<{
    scope: string;
    snapshot: ThoughtTrainingStageLoad;
  }>({ scope: '', snapshot: EMPTY });

  useEffect(() => {
    const setSnapshot = (snapshot: ThoughtTrainingStageLoad) =>
      setScoped({ scope, snapshot });

    if (offline) {
      setSnapshot({
        loaded: true, loadUnavailable: false,
        persistedLevel: null, stage: getThoughtTrainingStage(1),
      });
      return;
    }
    if (!userId || !profileId) {
      setSnapshot({ loaded: true, loadUnavailable: true, persistedLevel: null, stage: null });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot(EMPTY);

    void (async () => {
      try {
        const state = await Promise.race([
          loadProgressionState({ userId, profileId, exerciseSlug: SLUG }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Thought practice stage read timed out')), LOAD_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        setSnapshot(state.loadUnavailable
          ? { loaded: true, loadUnavailable: true, persistedLevel: null, stage: null }
          : {
              loaded: true, loadUnavailable: false,
              persistedLevel: state.currentLevel,
              stage: getThoughtTrainingStage(state.currentLevel),
            });
      } catch {
        // Do not expose patient identifiers or backend details in logs.
        if (!cancelled) setSnapshot({
          loaded: true, loadUnavailable: true, persistedLevel: null, stage: null,
        });
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [userId, profileId, offline, scope]);

  return scoped.scope === scope ? scoped.snapshot : EMPTY;
}
