/**
 * useSynonymGeneratorProgression — Phase 2, Wave 3 wiring of the
 * divergent lexical-semantic ladder to `clinical_progression_state`.
 *
 * Expressive routing: SynonymGenerator emits `trialMode: 'production'`
 * only on completed speech-only rounds. Typed, mixed and early-ended
 * practice is logged but excluded by unified submission; the slug remains
 * adopted for eligible speech production.
 *
 * Mirrors useMultiStepPlanningProgression line-for-line; differences are
 * limited to the slug + per-game helpers and support mapping.
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
  calculateSynonymGeneratorProgressDelta,
  evidenceMetForSynonymGeneratorLevel,
  getSynonymGeneratorLevelSpec,
  highestImplementedSynonymGeneratorLevel,
} from '@/lib/progression/synonymGeneratorLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const SYNONYM_GENERATOR_SLUG = 'synonym-generator';

/**
 * Map Synonym Generator trials to the canonical lexical SupportLevel.
 * The current game UI has no in-trial scaffold (no hint/cue chips).
 * Eligible spoken trials are `open_response`; typed/mixed/early-ended
 * practice is excluded from this hook rather than miscredited as speech.
 */
export function mapSynonymGeneratorSupport(): SupportLevel {
  return 'open_response';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseSynonymGeneratorProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useSynonymGeneratorProgression({
  userId,
  profileId,
}: UseSynonymGeneratorProgressionArgs) {
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
        exerciseSlug: SYNONYM_GENERATOR_SLUG,
      }));
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setState(null);
    trialsRef.current = [];
    flushedRef.current = false;
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: SYNONYM_GENERATOR_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[SynonymGeneratorProgression] loaded', {
          currentLevel: loadedState.currentLevel,
          progressPct: loadedState.progressPct,
          supportBaseline: loadedState.supportBaseline,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, profileId]);

  const recordTrialOutcome = useCallback((trial: BufferedTrial) => {
    if (!loaded || state?.loadUnavailable ||
        (userId && profileId && (!state || state.userId !== userId || state.profileId !== profileId))) return;
    trialsRef.current.push(trial);
  }, [loaded, state, userId, profileId]);

  const flushAtSessionEnd = useCallback(
    async (params: { sessionId: string | null }) => {
      if (flushedRef.current) return { ok: true, skipped: true as const };
      if (state?.loadUnavailable ||
          (userId && profileId && (!loaded || !state || state.userId !== userId || state.profileId !== profileId))) {
        return { ok: false, error: 'Patient progression unavailable. Reopen practice to try again.' };
      }
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
          exerciseSlug: SYNONYM_GENERATOR_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getSynonymGeneratorLevelSpec(level);
      const evidenceMet = evidenceMetForSynonymGeneratorLevel(trials, level);
      const progressDelta = calculateSynonymGeneratorProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: SYNONYM_GENERATOR_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedSynonymGeneratorLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[SynonymGeneratorProgression] flush diagnostic', {
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
        console.warn('[SynonymGeneratorProgression] persist failed:', result.error);
      }
      return { ...result, snapshot };
    },
    [userId, profileId, state],
  );

  const bufferedTrialCount = useCallback(() => trialsRef.current.length, []);

  return {
    state,
    loaded: loaded && state?.loadUnavailable !== true &&
      (!userId || !profileId || (state?.userId === userId && state?.profileId === profileId)),
    loadUnavailable: state?.loadUnavailable === true,
    startingLevel: loaded && state?.loadUnavailable !== true &&
      (!userId || !profileId || (state?.userId === userId && state?.profileId === profileId))
      ? state?.currentLevel ?? null : null,
    recordTrialOutcome,
    flushAtSessionEnd,
    __bufferedTrialCount: bufferedTrialCount,
  };
}
