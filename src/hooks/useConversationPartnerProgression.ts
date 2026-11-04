/**
 * Persistent clinical practice progression for Conversation Partner L1–L3.
 * Every credited turn requires a successfully stored raw turn event AND an
 * actual LLM on-topic result. Unavailable DB reads permit practice only.
 *
 * Higher levels are not built and cannot receive stage-4 content or credit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySessionToState, defaultProgressionState, loadProgressionStateChecked,
  saveProgressionState, type ClinicalProgressionState,
} from '@/lib/progression/clinicalProgression';
import {
  EARLY_PARTNER_STAGES, earlyPartnerEvidenceMet,
  earlyPartnerProgressDelta, isEarlyPartnerLevel, type EarlyPartnerTrial,
  type EarlyPartnerLevel,
} from '@/lib/progression/conversationPartnerClinical';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

export function useConversationPartnerProgression({
  userId, profileId,
}: { userId: string | null | undefined; profileId: string | null | undefined }) {
  const slug = 'conversation-partner';
  const identity = userId && profileId ? `${userId}/${profileId}/${slug}` : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading'|'verified'|'unverified'>('loading');
  const loadedIdentityRef = useRef<string | null>(null);
  const trialsRef = useRef(new Map<number, EarlyPartnerTrial>());
  const savedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadedIdentityRef.current = null;
    trialsRef.current.clear();
    savedRef.current = false;
    savingRef.current = false;
    setLoadStatus('loading');
    if (!identity || !userId || !profileId) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline',
        profileId: profileId ?? 'offline',
        exerciseSlug: slug,
      }));
      setLoadStatus('unverified');
      return () => { cancelled = true; };
    }
    void loadProgressionStateChecked({ userId, profileId, exerciseSlug: slug }).then(
      result => {
        if (cancelled || identityRef.current !== identity) return;
        setState(result.state);
        loadedIdentityRef.current = identity;
        setLoadStatus(result.verified && isEarlyPartnerLevel(result.state.currentLevel)
          ? 'verified' : 'unverified');
      },
      error => {
        if (cancelled || identityRef.current !== identity) return;
        console.warn('[ConversationPartnerProgression] read unavailable; practice only', error);
        setState(defaultProgressionState({ userId, profileId, exerciseSlug: slug }));
        loadedIdentityRef.current = identity;
        setLoadStatus('unverified');
      },
    );
    return () => { cancelled = true; };
  }, [identity, userId, profileId]);

  const matching = state && state.userId === (userId ?? 'offline') &&
    state.profileId === (profileId ?? 'offline') && state.exerciseSlug === slug ? state : null;
  const loaded = !!matching && loadStatus !== 'loading' &&
    (!identity || loadedIdentityRef.current === identity);
  const level: EarlyPartnerLevel = matching && isEarlyPartnerLevel(matching.currentLevel)
    ? matching.currentLevel : matching && matching.currentLevel > 3 ? 3 : 1;
  const verified = loaded && loadStatus === 'verified' &&
    !!matching && isEarlyPartnerLevel(matching.currentLevel);

  const recordVerifiedTurn = useCallback((trial: EarlyPartnerTrial) => {
    if (!verified || !identity || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity || savedRef.current || savingRef.current) return;
    if (!Number.isInteger(trial.turnNumber) || trial.turnNumber < 1 ||
        trial.turnNumber > EARLY_PARTNER_STAGES[level].turnCount) return;
    if (trialsRef.current.has(trial.turnNumber)) return;
    trialsRef.current.set(trial.turnNumber, trial);
  }, [identity, verified, level]);

  const flushAtSessionEnd = useCallback(async (sessionId: string | null) => {
    if (!verified || !identity || !matching || !sessionId || identityRef.current !== identity ||
        loadedIdentityRef.current !== identity) {
      return { ok: false, skipped: true as const, error: 'clinical level unverified; practice only' };
    }
    if (savedRef.current || savingRef.current || matching.lastSessionId === sessionId) {
      return { ok: true, skipped: true as const };
    }
    const trials = [...trialsRef.current.values()].sort((a, b) => a.turnNumber - b.turnNumber);
    const expected = EARLY_PARTNER_STAGES[level].turnCount;
    // A partially logged exchange, fallback model score, or interrupted
    // session cannot earn any progression from incomplete evidence.
    if (trials.length !== expected) {
      return { ok: false, skipped: true as const, error: 'insufficient saved, LLM-scored conversation turns' };
    }

    savingRef.current = true;
    try {
      const evidenceMet = earlyPartnerEvidenceMet(level, trials);
      const progressDelta = earlyPartnerProgressDelta(level, trials);
      const gate = await readMasteryGate({ profileId: matching.profileId, exerciseSlug: slug, difficulty: level });
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
      return { ok: false, error: error instanceof Error ? error.message : 'clinical progression not saved' };
    } finally {
      savingRef.current = false;
    }
  }, [verified, identity, matching, level]);

  return {
    loaded, verified, level, state: matching,
    recordVerifiedTurn, flushAtSessionEnd,
    __verifiedTurnCount: () => trialsRef.current.size,
  };
}
