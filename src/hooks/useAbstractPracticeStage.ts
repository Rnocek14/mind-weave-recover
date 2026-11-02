/**
 * Read-only per-(user, profile) Abstract Comparison practice-stage loading.
 * Missing/failed reads do not silently become Level 1 or update patient data.
 * Responds to a profile switch during render (not one effect tick later).
 */
import { useEffect, useState } from 'react';
import { loadProgressionState } from '@/lib/progression/clinicalProgression';
import { toProgressionSlug, CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';
import { getAbstractPracticeStage, type AbstractPracticeStage } from '@/lib/abstractCompare/trainingStages';

const PROGRESSION_SLUG = toProgressionSlug(CANONICAL_SLUGS.ABSTRACT_COMPARE);
const TIMEOUT_MS = 5000;

export interface AbstractPracticeLoad {
  loaded: boolean;
  unavailable: boolean;
  savedLevel: number | null;
  stage: AbstractPracticeStage | null;
}
const EMPTY: AbstractPracticeLoad = { loaded: false, unavailable: false, savedLevel: null, stage: null };

export function useAbstractPracticeStage({
  userId, profileId, offline = false,
}: {
  userId?: string | null;
  profileId?: string | null;
  offline?: boolean;
}): AbstractPracticeLoad {
  const scope = offline ? 'offline' : JSON.stringify([userId ?? null, profileId ?? null]);
  const [state, setState] = useState<{ scope: string; load: AbstractPracticeLoad }>({
    scope: '', load: EMPTY,
  });
  useEffect(() => {
    const publish = (load: AbstractPracticeLoad) => setState({ scope, load });
    if (offline) {
      publish({ loaded: true, unavailable: false, savedLevel: null, stage: getAbstractPracticeStage(1) });
      return;
    }
    if (!userId || !profileId) {
      publish({ loaded: true, unavailable: true, savedLevel: null, stage: null });
      return;
    }
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    publish(EMPTY);
    void (async () => {
      try {
        const found = await Promise.race([
          loadProgressionState({ userId, profileId, exerciseSlug: PROGRESSION_SLUG }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Stage load unavailable')), TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        publish(found.loadUnavailable
          ? { loaded: true, unavailable: true, savedLevel: null, stage: null }
          : { loaded: true, unavailable: false, savedLevel: found.currentLevel,
              stage: getAbstractPracticeStage(found.currentLevel) });
      } catch {
        if (!cancelled) publish({ loaded: true, unavailable: true, savedLevel: null, stage: null });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [scope, userId, profileId, offline]);
  return state.scope === scope ? state.load : EMPTY;
}
