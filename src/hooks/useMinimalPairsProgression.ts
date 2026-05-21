/**
 * useMinimalPairsProgression — Phase 1 stub of Clinical Progression v1 for
 * Minimal Pairs. Mirrors `usePhotoNamingProgression` and
 * `useFixSentenceProgression` so all three games share the same orchestration
 * shape ahead of the future `useClinicalProgression(contract)` refactor.
 *
 * Strict scope (matches the other two hooks):
 *   - On mount: load `clinical_progression_state` for (profile, minimal-pairs).
 *   - During play: caller pushes per-trial outcomes via `recordTrialOutcome`.
 *   - On session end: caller calls `flushAtSessionEnd` to roll trials into
 *     state and upsert.
 *   - Reads longitudinal mastery confidence as a level-up gate.
 *   - No demotion logic; soft-regression bookkeeping happens in
 *     `applySessionToState` and the bridge consumes the resulting
 *     `supportBaseline` for behavioral scaffolding.
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
  calculateMinimalPairsProgressDelta,
  cueDependencyForMinimalPairsSession,
  evidenceMetForMinimalPairsLevel,
  getMinimalPairsLevelSpec,
  isMinimalPairsCueDependencyBlocking,
  MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD,
} from '@/lib/progression/minimalPairsLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const MINIMAL_PAIRS_SLUG = 'minimal-pairs';

/**
 * Resolve SupportLevel for a Minimal Pairs trial. Two-tier model:
 *   audioReplayCount === 0 → first_listen (independent target)
 *   audioReplayCount >= 1  → after_replay (scaffolded)
 * `after_multiple_replays` is reserved for future granularity.
 */
export function mapMinimalPairsSupport(args: {
  audioReplayCount: number;
}): SupportLevel {
  const n = Math.max(0, Math.round(args.audioReplayCount));
  if (n === 0) return 'first_listen';
  return 'after_replay';
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseMinimalPairsProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useMinimalPairsProgression({
  userId,
  profileId,
}: UseMinimalPairsProgressionArgs) {
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
        exerciseSlug: MINIMAL_PAIRS_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[MinimalPairsProgression] loaded', {
          currentLevel: loadedState.currentLevel,
          progressPct: loadedState.progressPct,
          supportBaseline: loadedState.supportBaseline,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
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
          exerciseSlug: MINIMAL_PAIRS_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getMinimalPairsLevelSpec(level);
      const rawEvidenceMet = evidenceMetForMinimalPairsLevel(trials, level);
      const progressDelta = calculateMinimalPairsProgressDelta(trials, level);

      // PR3 — Cue-dependency gate. "Cue" here = patient-driven audio replay.
      // When the level's target is `first_listen` and the patient leans on
      // replays for > MINIMAL_PAIRS_CUE_DEPENDENCY_BLOCK_THRESHOLD of the
      // session, hold the level even when accuracy passes.
      const cueDependency = cueDependencyForMinimalPairsSession(trials, level);
      const cueDependencyBlocking = isMinimalPairsCueDependencyBlocking(trials, level);
      const evidenceMet = rawEvidenceMet && !cueDependencyBlocking;

      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: MINIMAL_PAIRS_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        { trials, evidenceMet, progressDelta, masteryConfidence: gate.confidence },
      );

      if (import.meta.env.DEV) {
        const supportDist: Record<string, { total: number; correct: number }> = {};
        for (const t of trials) {
          const bucket = supportDist[t.support] ?? { total: 0, correct: 0 };
          bucket.total += 1;
          if (t.correct) bucket.correct += 1;
          supportDist[t.support] = bucket;
        }
        console.log('[MinimalPairsProgression] flush diagnostic', {
          totalTrials: trials.length,
          supportDistribution: supportDist,
          level,
          levelSpec: {
            description: levelSpec.description,
            targetSupport: levelSpec.targetSupport,
            minOnTargetAttempts: levelSpec.minOnTargetAttempts,
            minOnTargetAccuracy: levelSpec.minOnTargetAccuracy,
            readiness: levelSpec.readiness,
          },
          progressDelta: Number(progressDelta.toFixed(3)),
          evidenceMet,
          prev: {
            level: prev.currentLevel,
            progressPct: prev.progressPct,
            supportBaseline: prev.supportBaseline,
            consecutiveStruggle: prev.consecutiveStruggleSessions,
          },
          next: {
            level: next.currentLevel,
            progressPct: next.progressPct,
            supportBaseline: next.supportBaseline,
            consecutiveStruggle: next.consecutiveStruggleSessions,
          },
        });
      }

      const result = await saveProgressionState(next);
      if (result.ok) {
        setState(next);
        flushedRef.current = true;
        if (import.meta.env.DEV) {
          console.debug('[MinimalPairsProgression] persisted', {
            from: { level: prev.currentLevel, pct: prev.progressPct },
            to: { level: next.currentLevel, pct: next.progressPct },
            evidenceMet,
            progressDelta,
            trials: trials.length,
            masteryGate: { confidence: gate.confidence, bySkill: gate.bySkill },
            masteryGateBlocked:
              evidenceMet &&
              prev.progressPct + progressDelta >= 100 &&
              next.currentLevel === prev.currentLevel,
          });
        }
      } else {
        console.warn('[MinimalPairsProgression] persist failed:', result.error);
      }
      const snapshot = {
        prev: { level: prev.currentLevel, progressPct: prev.progressPct },
        next: { level: next.currentLevel, progressPct: next.progressPct },
        leveledUp: next.currentLevel > prev.currentLevel,
        evidenceMet,
        progressDelta,
      };
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
