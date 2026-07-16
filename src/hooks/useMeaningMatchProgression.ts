/**
 * useMeaningMatchProgression — Phase 1, Wave 1 wiring of the comprehension
 * ladder to `clinical_progression_state`.
 *
 * Receptive-safe: this hook drives persistent Clinical Level + engine floor
 * via the bridge, but Meaning Match's `submitTrial` continues to emit
 * `trialMode: 'recognition'` and the slug is INTENTIONALLY NOT added to
 * ADOPTED_TRIAL_MODE_SLUGS. Mastery routing for receptive tasks is deferred.
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
  calculateMeaningMatchProgressDelta,
  evidenceMetForMeaningMatchLevel,
  getMeaningMatchLevelSpec,
  highestImplementedMeaningMatchLevel,
} from '@/lib/progression/meaningMatchLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const MEANING_MATCH_SLUG = 'meaning-match';

/** Map MeaningMatch's hint usage to the canonical comprehension SupportLevel. */
export function mapMeaningMatchSupport(usedHint: boolean): SupportLevel {
  return usedHint ? 'semantic_cue' : 'recognition_only';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseMeaningMatchProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useMeaningMatchProgression({
  userId,
  profileId,
}: UseMeaningMatchProgressionArgs) {
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
        exerciseSlug: MEANING_MATCH_SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: MEANING_MATCH_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[MeaningMatchProgression] loaded', {
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
          exerciseSlug: MEANING_MATCH_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getMeaningMatchLevelSpec(level);
      const evidenceMet = evidenceMetForMeaningMatchLevel(trials, level);
      const progressDelta = calculateMeaningMatchProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: MEANING_MATCH_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedMeaningMatchLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[MeaningMatchProgression] flush diagnostic', {
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
        console.warn('[MeaningMatchProgression] persist failed:', result.error);
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
