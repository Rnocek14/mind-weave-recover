/**
 * usePhotoNamingProgression — Step 2 wiring of Clinical Progression v1.
 *
 * Connects Photo Naming to the already-shipped persistence layer
 * (`src/lib/progression/clinicalProgression.ts`). This hook is intentionally
 * thin:
 *
 *   - On mount: load `clinical_progression_state` for (profile, photo-naming).
 *   - During play: caller pushes per-trial outcomes via `recordTrialOutcome`.
 *   - On session end: caller calls `flushAtSessionEnd` to roll trials into
 *     state and upsert.
 *
 * Strict scope (per the Step 2 instruction):
 *   - No new fields beyond what `clinical_progression_state` already has.
 *   - No demotion logic; no soft-regression staging beyond the existing
 *     `support_baseline` bump inside `applySessionToState`.
 *   - No UI side effects.
 *   - No governance/replay/receptive mastery work.
 *   - Does NOT touch in-game adaptation, cueing, pacing, or scoring.
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
  calculateLevelAwareProgressDelta,
  evidenceMetForLevel,
  getPhotoNamingLevelSpec,
} from '@/lib/progression/photoNamingLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const PHOTO_NAMING_SLUG = 'photo-naming';

/** Spec §2: legacy constant retained for reference; per-level evidence
 * thresholds now live in `photoNamingLevels.ts`. */

/** Map an in-session trial outcome to a clinical SupportLevel for Photo Naming. */
export function mapPhotoNamingSupport(args: {
  /** 'production' = spoken response; 'recognition' = tap from choice chips. */
  inputMode: 'production' | 'recognition';
  /** 0 = none, 1 = semantic, 2 = phonemic, 3 = full / carrier. */
  cueLevel: number;
}): SupportLevel {
  if (args.inputMode === 'recognition') return 'recognition_only';
  switch (Math.max(0, Math.min(3, Math.round(args.cueLevel)))) {
    case 0:
      return 'independent';
    case 1:
      return 'semantic_cue';
    case 2:
      return 'phonemic_cue';
    default:
      return 'carrier_or_full_model';
  }
}

/**
 * Resolve the SupportLevel for a *chip tap* on a Photo Naming trial.
 *
 * Bug fix (post-ASR-silence recovery): when the mic was active and the
 * patient attempted production but ASR returned silence / no_response, a
 * subsequent correct chip tap should NOT be classified as `recognition_only`.
 * That misclassification triggered false longitudinal struggle verdicts.
 *
 * Decision rule:
 *   - productionAttempted = false  → pure recognition tap (`recognition_only`)
 *   - productionAttempted = true   → scaffolded production. Map via the
 *     production branch with cueLevel floored to ≥ 1 so it lands on
 *     `semantic_cue` at minimum (chips reveal the lexical target without
 *     phonemic information).
 */
export function resolvePhotoNamingChipSupport(args: {
  productionAttempted: boolean;
  cueLevel: number;
}): SupportLevel {
  if (!args.productionAttempted) return 'recognition_only';
  return mapPhotoNamingSupport({
    inputMode: 'production',
    cueLevel: Math.max(1, args.cueLevel),
  });
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UsePhotoNamingProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function usePhotoNamingProgression({
  userId,
  profileId,
}: UsePhotoNamingProgressionArgs) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);

  // Load on mount / when ids resolve.
  useEffect(() => {
    if (!userId || !profileId) return;
    let cancelled = false;
    void (async () => {
      const loadedState = await loadProgressionState({
        userId,
        profileId,
        exerciseSlug: PHOTO_NAMING_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[PhotoNamingProgression] loaded', {
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

  /** Buffer one trial. Pure recording — no state change. */
  const recordTrialOutcome = useCallback((trial: BufferedTrial) => {
    trialsRef.current.push(trial);
  }, []);

  /**
   * Roll buffered trials into progression state and persist once.
   * Idempotent within a session — repeated calls become no-ops.
   *
   * Evidence rule (spec §5.3 + §2): independent (un-cued, un-recognition)
   * accuracy ≥ 70% across the buffered window.
   */
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
          exerciseSlug: PHOTO_NAMING_SLUG,
        });

      // Level-aware evidence + progress: each clinical level defines its own
      // "on-target" support tier and accuracy bar. Scaffolded chip recovery
      // graduates Level 1 (its training target) but NOT Level 4+
      // (independent naming).
      const level = prev.currentLevel;
      const levelSpec = getPhotoNamingLevelSpec(level);
      const evidenceMet = evidenceMetForLevel(trials, level);
      const progressDelta = calculateLevelAwareProgressDelta(trials, level);

      // Step 2: pull longitudinal mastery confidence as the FIRST mastery
      // enforcement layer. Undefined → backward-compatible no-op.
      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: PHOTO_NAMING_SLUG,
        difficulty: prev.currentLevel,
      });

      const next = applySessionToState(
        { ...prev, lastSessionId: params.sessionId ?? prev.lastSessionId },
        { trials, evidenceMet, progressDelta, masteryConfidence: gate.confidence }
      );

      if (import.meta.env.DEV) {
        const supportDist: Record<string, { total: number; correct: number }> = {};
        for (const t of trials) {
          const bucket = supportDist[t.support] ?? { total: 0, correct: 0 };
          bucket.total += 1;
          if (t.correct) bucket.correct += 1;
          supportDist[t.support] = bucket;
        }
        console.log('[PhotoNamingProgression] flush diagnostic', {
          rawTrials: trials,
          totalTrials: trials.length,
          supportDistribution: supportDist,
          level,
          levelSpec: {
            description: levelSpec.description,
            targetSupport: levelSpec.targetSupport,
            minOnTargetAttempts: levelSpec.minOnTargetAttempts,
            minOnTargetAccuracy: levelSpec.minOnTargetAccuracy,
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
          console.debug('[PhotoNamingProgression] persisted', {
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
        console.warn(
          '[PhotoNamingProgression] persist failed:',
          result.error
        );
      }
      return result;
    },
    [userId, profileId, state]
  );

  /** DEV-only diagnostic: number of trials currently buffered for flush. */
  const bufferedTrialCount = useCallback(() => trialsRef.current.length, []);

  return {
    /** Loaded persistent state (null until first load resolves). */
    state,
    /** True once initial load has completed. */
    loaded,
    /** Convenience: starting clinical level (1–8) or null if not yet loaded. */
    startingLevel: state?.currentLevel ?? null,
    recordTrialOutcome,
    flushAtSessionEnd,
    /** Diagnostic accessor — DO NOT use for clinical decisions. */
    __bufferedTrialCount: bufferedTrialCount,
  };
}
