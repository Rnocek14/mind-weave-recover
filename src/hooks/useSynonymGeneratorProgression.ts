/**
 * useSynonymGeneratorProgression — Phase 2, Wave 3 wiring of the
 * divergent lexical-semantic ladder to `clinical_progression_state`.
 *
 * Expressive routing: SynonymGenerator's submitTrial emits
 * `trialMode: 'production'` and the slug IS in ADOPTED_TRIAL_MODE_SLUGS.
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
 * The current game UI has no in-trial scaffold (no hint, no cue chips —
 * typing fallback is an input modality, not a clinical scaffold). Every
 * trial is `open_response`.
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
    if (!userId || !profileId) return;
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
    loaded,
    startingLevel: state?.currentLevel ?? null,
    recordTrialOutcome,
    flushAtSessionEnd,
    __bufferedTrialCount: bufferedTrialCount,
  };
}
