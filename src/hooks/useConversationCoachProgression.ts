/**
 * Verified, per-patient L1–L3 progression for the *guided* Conversation Coach.
 * The existing open-ended Smart Coach remains separate and untouched.
 *
 * Never update a row whose initial read failed and never advance into L4
 * until stage-specific content and clinician review actually ship.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySessionToState, defaultProgressionState, loadProgressionStateChecked,
  saveProgressionState, type ClinicalProgressionState,
} from '@/lib/progression/clinicalProgression';
import {
  earlyCoachEvidenceMet, earlyCoachProgressDelta,
  isEarlyCoachLevel, type EarlyCoachLevel, type EarlyCoachTrial,
} from '@/lib/progression/earlyConversationCoach';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const slug = 'conversation-coach';

export function useConversationCoachProgression({
  userId, profileId,
}: { userId: string | null | undefined; profileId: string | null | undefined }) {
  const identity = userId && profileId ? `${userId}/${profileId}/${slug}` : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading'|'verified'|'unverified'>('loading');
  const loadedIdentityRef = useRef<string | null>(null);
  const trialRef = useRef<EarlyCoachTrial | null>(null);
  const savedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadedIdentityRef.current = null;
    trialRef.current = null;
    savedRef.current = false;
    savingRef.current = false;
    setLoadStatus('loading');
    if (!identity || !userId || !profileId) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline', profileId: profileId ?? 'offline', exerciseSlug: slug,
      }));
      setLoadStatus('unverified');
      return () => { cancelled = true; };
    }
    void loadProgressionStateChecked({ userId, profileId, exerciseSlug: slug }).then(
      result => {
        if (cancelled || identityRef.current !== identity) return;
        setState(result.state);
        loadedIdentityRef.current = identity;
        setLoadStatus(result.verified && isEarlyCoachLevel(result.state.currentLevel)
          ? 'verified' : 'unverified');
      },
      error => {
        if (cancelled || identityRef.current !== identity) return;
        console.warn('[ConversationCoachProgression] initial read failed; practice only', error);
        setState(defaultProgressionState({ userId, profileId, exerciseSlug: slug }));
        loadedIdentityRef.current = identity;
        setLoadStatus('unverified');
      },
    );
    return () => { cancelled = true; };
  }, [userId, profileId, identity]);

  const matching = state && state.userId === (userId ?? 'offline') &&
    state.profileId === (profileId ?? 'offline') && state.exerciseSlug === slug ? state : null;
  const loaded = !!matching && loadStatus !== 'loading' &&
    (!identity || loadedIdentityRef.current === identity);
  const level: EarlyCoachLevel = matching && isEarlyCoachLevel(matching.currentLevel)
    ? matching.currentLevel : matching && matching.currentLevel > 3 ? 3 : 1;
  const verified = loaded && loadStatus === 'verified' &&
    !!matching && isEarlyCoachLevel(matching.currentLevel);

  const recordVerifiedTurn = useCallback((trial: EarlyCoachTrial) => {
    if (!verified || !identity || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity || trialRef.current ||
        savedRef.current || savingRef.current) return;
    if (trial.turnNumber !== 1) return;
    trialRef.current = trial;
  }, [identity, verified]);

  const flushAtSessionEnd = useCallback(async (sessionId: string | null) => {
    if (!verified || !identity || !matching || !sessionId || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity) {
      return { ok: false, skipped: true as const, error: 'clinical level unverified; practice only' };
    }
    if (savedRef.current || savingRef.current || matching.lastSessionId === sessionId) {
      return { ok: true, skipped: true as const };
    }
    const trial = trialRef.current;
    if (!trial) return { ok: false, skipped: true as const, error: 'no confirmed spoken trial saved' };

    savingRef.current = true;
    try {
      const trials = [trial];
      const evidenceMet = earlyCoachEvidenceMet(level, trials);
      const progressDelta = earlyCoachProgressDelta(level, trials);
      const gate = await readMasteryGate({
        profileId: matching.profileId, exerciseSlug: slug, difficulty: level,
      });
      if (identityRef.current !== identity) {
        return { ok: false, error: 'patient changed during clinical-level save' };
      }
      const next = applySessionToState(
        { ...matching, lastSessionId: sessionId },
        { trials, evidenceMet, progressDelta, masteryVerdict: gate.verdict, maxImplementedLevel: 3 },
      );
      const persisted = await saveProgressionState(next);
      if (persisted.ok && identityRef.current === identity) {
        savedRef.current = true;
        setState(next);
      }
      return { ...persisted, levelBefore: level, levelAfter: next.currentLevel, evidenceMet };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'clinical progress not saved' };
    } finally {
      savingRef.current = false;
    }
  }, [verified, identity, matching, level]);

  return {
    loaded, verified, level, state: matching,
    recordVerifiedTurn, flushAtSessionEnd,
    __verifiedTurnCount: () => trialRef.current ? 1 : 0,
  };
}
