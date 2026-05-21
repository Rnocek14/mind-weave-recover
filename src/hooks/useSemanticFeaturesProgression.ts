/**
 * useSemanticFeaturesProgression — Phase 1 wiring of the SFA ladder to
 * `clinical_progression_state`.
 *
 * Mirrors usePhotoNamingProgression line-for-line; differences are limited to
 * the slug + the per-game evidence/progress helpers. Strict scope:
 *   - No new persistence fields.
 *   - No demotion logic beyond the existing supportBaseline bump.
 *   - No UI side effects.
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
  calculateSemanticFeaturesProgressDelta,
  evidenceMetForSemanticFeaturesLevel,
  getSemanticFeaturesLevelSpec,
  highestImplementedSemanticFeaturesLevel,
} from '@/lib/progression/semanticFeaturesLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const SEMANTIC_FEATURES_SLUG = 'semantic-features';

/** Map SFA in-game cueLevel (0..2) to the canonical lexical SupportLevel. */
export function mapSemanticFeaturesSupport(cueLevel: number): SupportLevel {
  const c = Math.max(0, Math.min(2, Math.round(cueLevel)));
  if (c <= 0) return 'independent';
  if (c === 1) return 'semantic_cue';
  return 'phonemic_cue';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseSemanticFeaturesProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useSemanticFeaturesProgression({
  userId,
  profileId,
}: UseSemanticFeaturesProgressionArgs) {
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
        exerciseSlug: SEMANTIC_FEATURES_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[SemanticFeaturesProgression] loaded', {
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
          exerciseSlug: SEMANTIC_FEATURES_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getSemanticFeaturesLevelSpec(level);
      const evidenceMet = evidenceMetForSemanticFeaturesLevel(trials, level);
      const progressDelta = calculateSemanticFeaturesProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: SEMANTIC_FEATURES_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedSemanticFeaturesLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[SemanticFeaturesProgression] flush diagnostic', {
          totalTrials: trials.length,
          level,
          levelSpec: {
            description: levelSpec.description,
            targetSupport: levelSpec.targetSupport,
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
        console.warn('[SemanticFeaturesProgression] persist failed:', result.error);
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
