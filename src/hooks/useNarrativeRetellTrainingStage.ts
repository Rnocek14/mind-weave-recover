/**
 * Read-only, patient-scoped stage loader for Narrative Retell's L1–L3
 * training configurations. This deliberately DOES NOT upsert or promote
 * clinical progression: the existing design-of-record lacks SLP-approved
 * per-level outcome / advancement rules.
 */
import { useEffect, useState } from 'react';
import { loadProgressionState } from '@/lib/progression/clinicalProgression';
import { getNarrativeTrainingStage, type NarrativeTrainingStage } from '@/lib/narrative/trainingStages';
import { CANONICAL_SLUGS } from '@/lib/exerciseSlugNormalizer';

const LOAD_TIMEOUT_MS = 5000;
// Database stores canonical underscore IDs, not hyphenated route IDs.
const SLUG = CANONICAL_SLUGS.NARRATIVE_RETELL;

export interface NarrativeStageLoad {
  loaded: boolean;
  loadUnavailable: boolean;
  persistedLevel: number | null;
  stage: NarrativeTrainingStage | null;
}

export function useNarrativeRetellTrainingStage(args: {
  userId?: string | null;
  profileId?: string | null;
  offline?: boolean;
}): NarrativeStageLoad {
  const { userId, profileId, offline = false } = args;
  // A profile switch can render synchronously before its effect starts.
  // Keep the loaded stage tied to the exact owner scope so another person's
  // level cannot flash on screen or seed their game's story selection.
  const scope = offline ? 'offline' : JSON.stringify([userId ?? null, profileId ?? null]);
  const empty: NarrativeStageLoad = {
    loaded: false, loadUnavailable: false, persistedLevel: null, stage: null,
  };
  const [scoped, setScoped] = useState<{ scope: string; snapshot: NarrativeStageLoad }>({
    scope: '', snapshot: empty,
  });
  const setSnapshot = (snapshot: NarrativeStageLoad) => setScoped({ scope, snapshot });

  useEffect(() => {
    if (offline) {
      // Offline practice is safe, but never an authenticated clinical level.
      setSnapshot({
        loaded: true, loadUnavailable: false, persistedLevel: null,
        stage: getNarrativeTrainingStage(1),
      });
      return;
    }
    if (!userId || !profileId) {
      // Missing patient identity is NOT permission to invent Level 1.
      setSnapshot({
        loaded: true, loadUnavailable: true, persistedLevel: null, stage: null,
      });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot({ loaded: false, loadUnavailable: false, persistedLevel: null, stage: null });
    void (async () => {
      try {
        const state = await Promise.race([
          loadProgressionState({ userId, profileId, exerciseSlug: SLUG }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Narrative stage load timed out')), LOAD_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        setSnapshot(state.loadUnavailable
          ? { loaded: true, loadUnavailable: true, persistedLevel: null, stage: null }
          : {
            loaded: true, loadUnavailable: false,
            persistedLevel: state.currentLevel,
            stage: getNarrativeTrainingStage(state.currentLevel),
          });
      } catch (err) {
        if (!cancelled) {
          console.warn('[NarrativeStage] clinical progression read unavailable:', err);
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
