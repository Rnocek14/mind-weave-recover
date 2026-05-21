/**
 * useFixSentenceProgression — Clinical Progression v1 wiring for Fix Sentence.
 *
 * Mirrors `usePhotoNamingProgression` in *architecture* (load → buffer →
 * flush → upsert) but uses the Fix-Sentence-specific level semantics
 * (`fixSentenceLevels.ts`). Photo Naming's naming-independence ladder is
 * intentionally NOT applied here.
 *
 * Strict scope:
 *   - Persistence + per-trial buffering only.
 *   - No new schema fields.
 *   - No demotion logic beyond `applySessionToState` baseline bump/decay.
 *   - No UI side effects.
 *   - Does NOT touch in-game adaptation, scoring, or content selection.
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
  calculateFixSentenceProgressDelta,
  cueDependencyForFixSentenceSession,
  evidenceMetForFixSentenceLevel,
  FIX_SENTENCE_CUE_DEPENDENCY_BLOCK_THRESHOLD,
  getFixSentenceLevelSpec,
  isFixSentenceCueDependencyBlocking,
} from '@/lib/progression/fixSentenceLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const FIX_SENTENCE_SLUG = 'fix-sentence';

/**
 * Map a Fix Sentence trial's interaction surface to a clinical SupportLevel.
 *
 * Today the live UI offers two surfaces:
 *   - speech / typed open production → `open_response`
 *   - (future) tap-to-choose chips    → `choice_based`
 *   - (future) chips + extra hint     → `highlight_plus_choice`
 *
 * The wrong word being visually highlighted is part of the task itself
 * (the sentence is *given* to repair), not a clinical scaffold — it does
 * NOT downgrade support to highlight_plus_choice on its own.
 */
export function mapFixSentenceSupport(args: {
  inputMode: 'speech' | 'typed' | 'choice' | 'highlight_choice';
}): SupportLevel {
  switch (args.inputMode) {
    case 'choice':
      return 'choice_based';
    case 'highlight_choice':
      return 'highlight_plus_choice';
    case 'speech':
    case 'typed':
    default:
      return 'open_response';
  }
}

interface BufferedTrial {
  correct: boolean;
  support: SupportLevel;
}

export interface UseFixSentenceProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useFixSentenceProgression({
  userId,
  profileId,
}: UseFixSentenceProgressionArgs) {
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
        exerciseSlug: FIX_SENTENCE_SLUG,
      });
      if (cancelled) return;
      setState(loadedState);
      setLoaded(true);
      if (import.meta.env.DEV) {
        console.debug('[FixSentenceProgression] loaded', {
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
          exerciseSlug: FIX_SENTENCE_SLUG,
        });

      const level = prev.currentLevel;
      const levelSpec = getFixSentenceLevelSpec(level);
      const evidenceMet = evidenceMetForFixSentenceLevel(trials, level);
      const progressDelta = calculateFixSentenceProgressDelta(trials, level);

      // Step 2: longitudinal mastery confidence gate (medium+ required to
      // unlock level-up). Undefined → backward-compatible no-op.
      const gate = await readMasteryGate({
        profileId,
        exerciseSlug: FIX_SENTENCE_SLUG,
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
        console.log('[FixSentenceProgression] flush diagnostic', {
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
          masteryGate: { confidence: gate.confidence, bySkill: gate.bySkill },
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
      } else {
        console.warn('[FixSentenceProgression] persist failed:', result.error);
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
    /** DEV-only diagnostic accessor — DO NOT use for clinical decisions. */
    __bufferedTrialCount: bufferedTrialCount,
  };
}
