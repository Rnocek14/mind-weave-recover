/**
 * useTwoCluesProgression — Phase 1, Wave 1 wiring of the lexical ladder to
 * `clinical_progression_state`.
 *
 * Mirrors useSemanticFeaturesProgression line-for-line; differences are
 * limited to the slug + per-game evidence/progress helpers.
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
  calculateTwoCluesProgressDelta,
  evidenceMetForTwoCluesLevel,
  getTwoCluesLevelSpec,
  highestImplementedTwoCluesLevel,
} from '@/lib/progression/twoCluesLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const TWO_CLUES_SLUG = 'two-clues';

/** Map TwoClues anchor usage to the canonical lexical SupportLevel. */
export function mapTwoCluesSupport(reachedAnchor: boolean): SupportLevel {
  return reachedAnchor ? 'semantic_cue' : 'independent';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseTwoCluesProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useTwoCluesProgression({
  userId,
  profileId,
}: UseTwoCluesProgressionArgs) {
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
        exerciseSlug: TWO_CLUES_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[TwoCluesProgression] loaded', {
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
          exerciseSlug: TWO_CLUES_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getTwoCluesLevelSpec(level);
      const evidenceMet = evidenceMetForTwoCluesLevel(trials, level);
      const progressDelta = calculateTwoCluesProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: TWO_CLUES_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedTwoCluesLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[TwoCluesProgression] flush diagnostic', {
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
        console.warn('[TwoCluesProgression] persist failed:', result.error);
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
