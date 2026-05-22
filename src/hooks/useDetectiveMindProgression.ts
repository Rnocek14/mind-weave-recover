/**
 * useDetectiveMindProgression — Phase 2, Wave 2 wiring of the inferential-
 * comprehension ladder to `clinical_progression_state`.
 *
 * Receptive-safe: this hook drives persistent Clinical Level + engine floor
 * via the bridge, but Detective Mind's `submitTrial` continues to emit
 * `trialMode: 'recognition'` and the slug is INTENTIONALLY NOT added to
 * ADOPTED_TRIAL_MODE_SLUGS. Mastery routing for receptive tasks is deferred.
 * Same precedent as MeaningMatch / MinimalPairs.
 *
 * Mirrors useMeaningMatchProgression line-for-line; differences are limited
 * to the slug + per-game evidence/progress helpers.
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
  calculateDetectiveMindProgressDelta,
  evidenceMetForDetectiveMindLevel,
  getDetectiveMindLevelSpec,
  highestImplementedDetectiveMindLevel,
} from '@/lib/progression/detectiveMindLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const DETECTIVE_MIND_SLUG = 'detective-mind';

/** Map Detective Mind's hint usage to the canonical comprehension SupportLevel. */
export function mapDetectiveMindSupport(usedHint: boolean): SupportLevel {
  return usedHint ? 'semantic_cue' : 'recognition_only';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseDetectiveMindProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useDetectiveMindProgression({
  userId,
  profileId,
}: UseDetectiveMindProgressionArgs) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);

  useEffect(() => {
    if (!userId || !profileId) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline',
        profileId: profileId ?? 'offline',
        exerciseSlug: DETECTIVE_MIND_SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: DETECTIVE_MIND_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[DetectiveMindProgression] loaded', {
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
          exerciseSlug: DETECTIVE_MIND_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getDetectiveMindLevelSpec(level);
      const evidenceMet = evidenceMetForDetectiveMindLevel(trials, level);
      const progressDelta = calculateDetectiveMindProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: DETECTIVE_MIND_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedDetectiveMindLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[DetectiveMindProgression] flush diagnostic', {
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
        console.warn('[DetectiveMindProgression] persist failed:', result.error);
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
