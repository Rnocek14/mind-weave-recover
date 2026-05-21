/**
 * useCategoryFluencyProgression — Phase 1, Wave 1 wiring of the discourse
 * generative-retrieval ladder to `clinical_progression_state`.
 *
 * Mirrors useSemanticFeaturesProgression line-for-line; differences are
 * limited to the slug + per-game evidence/progress helpers.
 *
 * NOTE on trial semantics: one Category Fluency *round* counts as one
 * progression trial. The page derives `correct = uniqueWordCount >= rung's
 * minUniqueWords` and feeds the support level (independent vs semantic_cue
 * if a sub-prompt was shown).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySessionToState,
  defaultProgressionState,
  loadProgressionState,
  saveProgressionState,
  type ClinicalProgressionState,
  type SupportLevel,
} from '@/lib/progression/clinicalProgression';
import {
  calculateCategoryFluencyProgressDelta,
  evidenceMetForCategoryFluencyLevel,
  getCategoryFluencyLevelSpec,
  highestImplementedCategoryFluencyLevel,
} from '@/lib/progression/categoryFluencyLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const CATEGORY_FLUENCY_SLUG = 'category-fluency';

/** Map CategoryFluency sub-prompt usage to the canonical lexical SupportLevel. */
export function mapCategoryFluencySupport(usedSubPrompt: boolean): SupportLevel {
  return usedSubPrompt ? 'semantic_cue' : 'independent';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseCategoryFluencyProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useCategoryFluencyProgression({
  userId,
  profileId,
}: UseCategoryFluencyProgressionArgs) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);

  useEffect(() => {
    if (!userId || !profileId) return;
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: CATEGORY_FLUENCY_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[CategoryFluencyProgression] loaded', {
          currentLevel: loadedState.currentLevel,
          progressPct: loadedState.progressPct,
          supportBaseline: loadedState.supportBaseline,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, profileId]);

  const recordTrialOutcome = useCallback((trial: BufferedTrial) => {
    trialsRef.current.push(trial);
  }, []);

  const flushAtSessionEnd = useCallback(
    async (params: { sessionId: string | null }) => {
      if (flushedRef.current) return { ok: true, skipped: true as const };
      const trials = trialsRef.current;
      if (!userId || !profileId || trials.length === 0) {
        flushedRef.current = true;
        return { ok: true, skipped: true as const };
      }

      const prev =
        state ??
        defaultProgressionState({
          userId,
          profileId,
          exerciseSlug: CATEGORY_FLUENCY_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getCategoryFluencyLevelSpec(level);
      const evidenceMet = evidenceMetForCategoryFluencyLevel(trials, level);
      const progressDelta = calculateCategoryFluencyProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: CATEGORY_FLUENCY_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryConfidence: gate.confidence,
          maxImplementedLevel: highestImplementedCategoryFluencyLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[CategoryFluencyProgression] flush diagnostic', {
          totalTrials: trials.length,
          level,
          levelSpec: {
            description: levelSpec.description,
            targetSupport: levelSpec.targetSupport,
            minUniqueWords: levelSpec.minUniqueWords,
            minOnTargetAttempts: levelSpec.minOnTargetAttempts,
            minOnTargetAccuracy: levelSpec.minOnTargetAccuracy,
          },
          progressDelta: Number(progressDelta.toFixed(3)),
          evidenceMet,
          prev: { level: prev.currentLevel, pct: prev.progressPct, supportBaseline: prev.supportBaseline },
          next: { level: next.currentLevel, pct: next.progressPct, supportBaseline: next.supportBaseline },
        });
      }

      const result = await saveProgressionState(next);
      const snapshot = {
        prev: { level: prev.currentLevel, progressPct: prev.progressPct },
        next: { level: next.currentLevel, progressPct: next.progressPct },
        leveledUp: next.currentLevel > prev.currentLevel,
        evidenceMet,
        progressDelta,
      };
      if (result.ok) {
        setState(next);
        flushedRef.current = true;
      } else {
        console.warn('[CategoryFluencyProgression] persist failed:', result.error);
      }
      return { ...result, snapshot };
    },
    [userId, profileId, state],
  );

  const bufferedTrialCount = useCallback(() => trialsRef.current.length, []);

  return {
    state,
    loaded,
    startingLevel: state?.currentLevel ?? null,
    recordTrialOutcome,
    flushAtSessionEnd,
    __bufferedTrialCount: bufferedTrialCount,
  };
}
