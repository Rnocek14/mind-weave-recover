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
  loadProgressionStateChecked,
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
  const identity = userId && profileId
    ? `${userId}/${profileId}/${SENTENCE_CONSTRUCTION_SLUG}`
    : null;
  // Synchronous ref protects against stale callbacks before useEffect runs
  // when a caregiver or clinician switches the active patient.
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const loadedIdentityRef = useRef<string | null>(null);
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'verified' | 'unverified'>('loading');
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);
  const flushingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    trialsRef.current = [];
    flushedRef.current = false;
    flushingRef.current = false;
    loadedIdentityRef.current = null;
    setLoadStatus('loading');

    if (!identity || !userId || !profileId) {
      // A missing active profile cannot block the exercise indefinitely.
      // Default L1 is practice only: never save or overwrite a real patient.
      setState(defaultProgressionState({
        userId: userId ?? 'offline',
        profileId: profileId ?? 'offline',
        exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
      }));
      setLoadStatus('unverified');
      return () => { cancelled = true; };
    }

    void loadProgressionStateChecked({
      userId,
      profileId,
      exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
    }).then(
      result => {
        if (cancelled || identityRef.current !== identity) return;
        loadedIdentityRef.current = identity;
        setState(result.state);
        setLoadStatus(result.verified ? 'verified' : 'unverified');
        if (!result.verified) {
          console.warn(
            '[SentenceConstructionProgression] saved level not verified; L1 practice only:',
            result.error,
          );
        }
      },
      error => {
        if (cancelled || identityRef.current !== identity) return;
        loadedIdentityRef.current = identity;
        setState(defaultProgressionState({
          userId, profileId, exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
        }));
        setLoadStatus('unverified');
        console.warn('[SentenceConstructionProgression] saved level unavailable; practice only', error);
      },
    );
    return () => { cancelled = true; };
  }, [identity, userId, profileId]);

  // Never expose the previous patient's level during a profile switch.
  const matching = state &&
    state.userId === (userId ?? 'offline') &&
    state.profileId === (profileId ?? 'offline') &&
    state.exerciseSlug === SENTENCE_CONSTRUCTION_SLUG ? state : null;
  const loaded = !!matching && loadStatus !== 'loading' &&
    (!identity || loadedIdentityRef.current === identity);
  const verified = loaded && loadStatus === 'verified' && !!identity;

  const recordTrialOutcome = useCallback((trial: BufferedTrial) => {
    // Raw exercise events remain available during L1 fallback practice, but
    // failed/ambiguous reads must NEVER grant patient-level progress.
    if (!verified || !identity || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity || flushedRef.current || flushingRef.current) return;
    trialsRef.current.push(trial);
  }, [verified, identity]);

  const flushAtSessionEnd = useCallback(
    async (params: { sessionId: string | null }) => {
      if (!verified || !identity || !matching || !params.sessionId ||
          identityRef.current !== identity || loadedIdentityRef.current !== identity) {
        return { ok: false, skipped: true as const, error: 'saved clinical level unverified; practice only' };
      }
      if (flushedRef.current || flushingRef.current || matching.lastSessionId === params.sessionId) {
        return { ok: true, skipped: true as const };
      }
      const trials = [...trialsRef.current];
      if (trials.length === 0) {
        return { ok: true, skipped: true as const };
      }

      flushingRef.current = true;
      try {
        const prev = matching;
        const level = prev.currentLevel;
        const levelSpec = getSentenceConstructionLevelSpec(level);
        const evidenceMet = evidenceMetForSentenceConstructionLevel(trials, level);
        const progressDelta = calculateSentenceConstructionProgressDelta(trials, level);

        const gate = await readMasteryGate({
          profileId: prev.profileId,
          exerciseSlug: SENTENCE_CONSTRUCTION_SLUG,
          difficulty: level,
        });
        if (identityRef.current !== identity || loadedIdentityRef.current !== identity) {
          return { ok: false, error: 'patient changed while clinical level was being saved' };
        }

        const next = applySessionToState(
          { ...prev, lastSessionId: params.sessionId },
          {
            trials,
            evidenceMet,
            progressDelta,
            masteryVerdict: gate.verdict,
            maxImplementedLevel: highestImplementedSentenceConstructionLevel(),
          },
        );

        if (import.meta.env.DEV) {
          console.debug('[SentenceConstructionProgression] flush diagnostic', {
            sessionId: params.sessionId,
            totalTrials: trials.length,
            level,
            targetSupport: levelSpec.targetSupport,
            minOnTargetAttempts: levelSpec.minOnTargetAttempts,
            progressDelta: Number(progressDelta.toFixed(3)),
            evidenceMet,
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
        if (result.ok && identityRef.current === identity) {
          setState(next);
          flushedRef.current = true;
        } else if (!result.ok) {
          console.warn('[SentenceConstructionProgression] persist failed:', result.error);
        }
        return { ...result, snapshot };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'clinical progress not saved' };
      } finally {
        flushingRef.current = false;
      }
    },
    [verified, identity, matching],
  );

  const bufferedTrialCount = useCallback(() => trialsRef.current.length, []);

  return {
    state: matching,
    loaded,
    verified,
    startingLevel: loaded ? matching?.currentLevel ?? null : null,
    recordTrialOutcome,
    flushAtSessionEnd,
    __bufferedTrialCount: bufferedTrialCount,
  };
}
