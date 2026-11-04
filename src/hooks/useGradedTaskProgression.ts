/**
 * Single reused clinical-level adapter for the three discourse/description
 * games. The game-specific clinical requirements live in gradedTaskLevels.
 *
 * On a failed database read, patients can still practice L1, but no clinical
 * state is saved. Event logging is independent. No live-data test is run here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySessionToState, defaultProgressionState, loadProgressionStateChecked,
  saveProgressionState, type ClinicalProgressionState, type SupportLevel,
} from '@/lib/progression/clinicalProgression';
import {
  gradedTaskEvidenceMet, gradedTaskProgressDelta,
  type GradedTaskSlug,
} from '@/lib/progression/gradedTaskLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

interface GradedTrial { correct: boolean; support: SupportLevel; stimulusId?: string }

export function useGradedTaskProgression({
  userId, profileId, slug,
}: { userId: string | null | undefined; profileId: string | null | undefined; slug: GradedTaskSlug }) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'verified' | 'unverified'>('loading');
  const identity = userId && profileId ? `${userId}/${profileId}/${slug}` : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const loadedIdentityRef = useRef<string | null>(null);
  const trialBufferRef = useRef<GradedTrial[]>([]);
  const seenStimuliRef = useRef(new Set<string>());
  const flushedRef = useRef(false);
  const flushingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadedIdentityRef.current = null;
    trialBufferRef.current = [];
    seenStimuliRef.current.clear();
    flushedRef.current = false;
    flushingRef.current = false;
    setLoadStatus('loading');
    if (!userId || !profileId || !identity) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline', profileId: profileId ?? 'offline', exerciseSlug: slug,
      }));
      setLoadStatus('unverified');
      return () => { cancelled = true; };
    }
    void loadProgressionStateChecked({ userId, profileId, exerciseSlug: slug })
      .then(result => {
        if (cancelled || identityRef.current !== identity) return;
        setState(result.state);
        loadedIdentityRef.current = identity;
        setLoadStatus(result.verified ? 'verified' : 'unverified');
      })
      .catch(err => {
        if (cancelled || identityRef.current !== identity) return;
        console.warn('[GradedTaskProgression] unavailable; practice only', err);
        setState(defaultProgressionState({ userId, profileId, exerciseSlug: slug }));
        loadedIdentityRef.current = identity;
        setLoadStatus('unverified');
      });
    return () => { cancelled = true; };
  }, [userId, profileId, slug, identity]);

  const matchingState = state && state.exerciseSlug === slug &&
    state.userId === (userId ?? 'offline') &&
    state.profileId === (profileId ?? 'offline') ? state : null;
  const loaded = loadStatus !== 'loading' && (identity ? loadedIdentityRef.current === identity : true) &&
    matchingState !== null;
  const verified = loaded && loadStatus === 'verified';

  const recordTrialOutcome = useCallback((trial: GradedTrial) => {
    if (!identity || identityRef.current !== identity || loadedIdentityRef.current !== identity ||
        loadStatus !== 'verified' || flushedRef.current || flushingRef.current) return;
    if (trial.stimulusId) {
      if (seenStimuliRef.current.has(trial.stimulusId)) return;
      seenStimuliRef.current.add(trial.stimulusId);
    }
    trialBufferRef.current.push({ correct: trial.correct, support: trial.support });
  }, [identity, loadStatus]);

  const flushAtSessionEnd = useCallback(async ({ sessionId }: { sessionId: string | null }) => {
    if (!identity || !userId || !profileId || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity || loadStatus !== 'verified' || !matchingState) {
      return { ok: false, skipped: true as const, error: 'clinical level not verified; practice only' };
    }
    if (flushedRef.current || flushingRef.current) return { ok: true, skipped: true as const };
    const trials = trialBufferRef.current;
    if (trials.length === 0) {
      flushedRef.current = true;
      return { ok: true, skipped: true as const };
    }
    flushingRef.current = true;
    try {
      const evidenceMet = gradedTaskEvidenceMet(trials, slug, matchingState.currentLevel);
      const progressDelta = gradedTaskProgressDelta(trials, slug, matchingState.currentLevel);
      const gate = await readMasteryGate({
        profileId, exerciseSlug: slug, difficulty: matchingState.currentLevel,
      });
      if (identityRef.current !== identity) {
        return { ok: false, error: 'patient profile changed during save' };
      }
      const next = applySessionToState(
        { ...matchingState, lastSessionId: sessionId ?? matchingState.lastSessionId },
        { trials, evidenceMet, progressDelta, masteryVerdict: gate.verdict, maxImplementedLevel: 8 },
      );
      const persisted = await saveProgressionState(next);
      if (persisted.ok && identityRef.current === identity) {
        flushedRef.current = true;
        setState(next);
      }
      return {
        ...persisted,
        snapshot: {
          prev: { level: matchingState.currentLevel, progressPct: matchingState.progressPct },
          next: { level: next.currentLevel, progressPct: next.progressPct },
          leveledUp: next.currentLevel > matchingState.currentLevel,
          evidenceMet, progressDelta,
        },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'progression save failed' };
    } finally {
      flushingRef.current = false;
    }
  }, [identity, userId, profileId, loadStatus, matchingState, slug]);

  return {
    loaded, verified, state: matchingState,
    startingLevel: matchingState?.currentLevel ?? null,
    recordTrialOutcome, flushAtSessionEnd,
    __bufferedTrialCount: () => trialBufferRef.current.length,
  };
}
