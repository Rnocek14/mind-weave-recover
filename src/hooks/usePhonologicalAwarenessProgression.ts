/**
 * usePhonologicalAwarenessProgression — Phase 2, Wave 3 wiring of the
 * phonological-awareness ladder to `clinical_progression_state`.
 *
 * Receptive-safe routing: submitTrial emits `trialMode: 'recognition'`
 * and the slug is INTENTIONALLY NOT in ADOPTED_TRIAL_MODE_SLUGS — same
 * precedent as minimal_pairs / meaning_match / detective_mind.
 *
 * Mirrors useDetectiveMindProgression line-for-line; differences are
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
  calculatePhonologicalAwarenessProgressDelta,
  evidenceMetForPhonologicalAwarenessLevel,
  getPhonologicalAwarenessLevelSpec,
  highestImplementedPhonologicalAwarenessLevel,
} from '@/lib/progression/phonologicalAwarenessLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const PHONOLOGICAL_AWARENESS_SLUG = 'phonological-awareness';

/**
 * Map Phonological Awareness trials to the canonical receptive
 * SupportLevel. The game has no in-trial scaffold today (no replay-slow,
 * no highlight) — every trial is `recognition_only`.
 */
export function mapPhonologicalAwarenessSupport(): SupportLevel {
  return 'recognition_only';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UsePhonologicalAwarenessProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function usePhonologicalAwarenessProgression({
  userId,
  profileId,
}: UsePhonologicalAwarenessProgressionArgs) {
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
        exerciseSlug: PHONOLOGICAL_AWARENESS_SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: PHONOLOGICAL_AWARENESS_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[PhonologicalAwarenessProgression] loaded', {
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
          exerciseSlug: PHONOLOGICAL_AWARENESS_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getPhonologicalAwarenessLevelSpec(level);
      const evidenceMet = evidenceMetForPhonologicalAwarenessLevel(trials, level);
      const progressDelta = calculatePhonologicalAwarenessProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: PHONOLOGICAL_AWARENESS_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedPhonologicalAwarenessLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[PhonologicalAwarenessProgression] flush diagnostic', {
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
        console.warn('[PhonologicalAwarenessProgression] persist failed:', result.error);
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
