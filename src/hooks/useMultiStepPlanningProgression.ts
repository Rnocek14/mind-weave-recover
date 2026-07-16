/**
 * useMultiStepPlanningProgression — Phase 2, Wave 2 wiring of the
 * procedural-discourse ladder to `clinical_progression_state`.
 *
 * Expressive routing: MSP's submitTrial emits `trialMode: 'production'`
 * and the slug IS in ADOPTED_TRIAL_MODE_SLUGS.
 *
 * Mirrors useSentenceConstructionProgression line-for-line; differences
 * are limited to the slug + per-game helpers and support mapping.
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
  calculateMultiStepPlanningProgressDelta,
  evidenceMetForMultiStepPlanningLevel,
  getMultiStepPlanningLevelSpec,
  highestImplementedMultiStepPlanningLevel,
} from '@/lib/progression/multiStepPlanningLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const MULTI_STEP_PLANNING_SLUG = 'multi-step-plan';

/**
 * Map MSP trials to the canonical executive SupportLevel. The current game
 * UI has no in-trial scaffold (no hint button, no tile suppression) — the
 * patient just speaks. Every trial is `open_response`.
 */
export function mapMultiStepPlanningSupport(): SupportLevel {
  return 'open_response';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseMultiStepPlanningProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useMultiStepPlanningProgression({
  userId,
  profileId,
}: UseMultiStepPlanningProgressionArgs) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);

  useEffect(() => {
    // Ids missing (profile fetch failed/slow, or offline): fall back to the
    // default Level 1 state immediately instead of leaving the exercise stuck
    // on "Loading your progression…" forever — an aphasia patient cannot
    // troubleshoot a frozen spinner. When the ids arrive this effect re-runs
    // and loads the real persisted state (same pattern as Detective Mind /
    // Photo Naming). Flush already no-ops without ids, so nothing mis-persists.
    if (!userId || !profileId) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline',
        profileId: profileId ?? 'offline',
        exerciseSlug: MULTI_STEP_PLANNING_SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: MULTI_STEP_PLANNING_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[MultiStepPlanningProgression] loaded', {
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
          exerciseSlug: MULTI_STEP_PLANNING_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getMultiStepPlanningLevelSpec(level);
      const evidenceMet = evidenceMetForMultiStepPlanningLevel(trials, level);
      const progressDelta = calculateMultiStepPlanningProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: MULTI_STEP_PLANNING_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedMultiStepPlanningLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[MultiStepPlanningProgression] flush diagnostic', {
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
        console.warn('[MultiStepPlanningProgression] persist failed:', result.error);
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
