/**
 * useSentenceConstructionProgression — Phase 2, Wave 2 wiring of the
 * grammar-production ladder to `clinical_progression_state`.
 *
 * Mirrors useTwoCluesProgression / useSemanticFeaturesProgression line-for-
 * line; differences are limited to the slug + per-game evidence/progress
 * helpers and the executive-axis support mapping.
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
  calculateSentenceConstructionProgressDelta,
  evidenceMetForSentenceConstructionLevel,
  getSentenceConstructionLevelSpec,
  highestImplementedSentenceConstructionLevel,
} from '@/lib/progression/sentenceConstructionLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const SENTENCE_CONSTRUCTION_SLUG = 'sentence-construction';

/**
 * Map sentence-construction in-game hint usage to the canonical executive
 * SupportLevel.
 *   hintUsed=true  → highlight_plus_choice (clinician played model audio)
 *   hintUsed=false → choice_based          (tiles only, no model)
 */
export function mapSentenceConstructionSupport(hintUsed: boolean): SupportLevel {
  return hintUsed ? 'highlight_plus_choice' : 'choice_based';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseSentenceConstructionProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useSentenceConstructionProgression({
  userId,
  profileId,
}: UseSentenceConstructionProgressionArgs) {
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
        exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[SentenceConstructionProgression] loaded', {
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
          exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getSentenceConstructionLevelSpec(level);
      const evidenceMet = evidenceMetForSentenceConstructionLevel(trials, level);
      const progressDelta = calculateSentenceConstructionProgressDelta(trials, level);

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        {
          trials,
          evidenceMet,
          progressDelta,
          masteryVerdict: gate.verdict,
          maxImplementedLevel: highestImplementedSentenceConstructionLevel(),
        },
      );

      if (import.meta.env.DEV) {
        console.log('[SentenceConstructionProgression] flush diagnostic', {
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
        console.warn('[SentenceConstructionProgression] persist failed:', result.error);
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
