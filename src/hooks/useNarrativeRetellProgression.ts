/**
 * Persisted Narrative Retell main-fact recall progression (L1–L8).
 * No changes to shared clinical math or mastery routing.
 * Story transcripts continue to be logged by the page's existing telemetry
 * writer; only successfully stored, scorable trials feed this buffer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applySessionToState, defaultProgressionState, loadProgressionState,
  saveProgressionState, type ClinicalProgressionState, type SupportLevel,
} from '@/lib/progression/clinicalProgression';
import {
  calculateNarrativeRetellProgressDelta,
  evidenceMetForNarrativeRetellLevel,
  highestImplementedNarrativeRetellLevel,
} from '@/lib/progression/narrativeRetellClinicalLevels';
import { readMasteryGate } from '@/lib/mastery/readMasteryGate';

const SLUG = 'narrative-retell';

type BufferedTrial = { correct: boolean; support: SupportLevel };

export interface UseNarrativeRetellProgressionArgs {
  userId: string | null | undefined;
  profileId: string | null | undefined;
}

export function useNarrativeRetellProgression({ userId, profileId }: UseNarrativeRetellProgressionArgs) {
  const [state, setState] = useState<ClinicalProgressionState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trialsRef = useRef<BufferedTrial[]>([]);
  const flushedRef = useRef(false);

  useEffect(() => {
    // Profile changes must never reuse the prior patient's buffered events.
    trialsRef.current = [];
    flushedRef.current = false;
    if (!userId || !profileId) {
      setState(defaultProgressionState({
        userId: userId ?? 'offline', profileId: profileId ?? 'offline', exerciseSlug: SLUG,
      }));
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      const next = await loadProgressionState({ userId, profileId, exerciseSlug: SLUG });
      if (!cancelled) { setState(next); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [userId, profileId]);

  const recordTrialOutcome = useCallback((trial: BufferedTrial) => {
    trialsRef.current.push(trial);
  }, []);

  const flushAtSessionEnd = useCallback(async ({ sessionId }: { sessionId: string | null }) => {
    if (flushedRef.current) return { ok: true, skipped: true as const };
    if (!userId || !profileId || trialsRef.current.length === 0) {
      flushedRef.current = true;
      return { ok: true, skipped: true as const };
    }
    const prev = state ?? defaultProgressionState({ userId, profileId, exerciseSlug: SLUG });
    const trials = trialsRef.current;
    const evidenceMet = evidenceMetForNarrativeRetellLevel(trials, prev.currentLevel);
    const progressDelta = calculateNarrativeRetellProgressDelta(trials, prev.currentLevel);
    const gate = await readMasteryGate({ profileId, exerciseSlug: SLUG, difficulty: prev.currentLevel });
    const next = applySessionToState(
      { ...prev, lastSessionId: sessionId ?? prev.lastSessionId },
      {
        trials, evidenceMet, progressDelta, masteryVerdict: gate.verdict,
        maxImplementedLevel: highestImplementedNarrativeRetellLevel(),
      },
    );
    const result = await saveProgressionState(next);
    if (result.ok) {
      setState(next);
      flushedRef.current = true;
    } else {
      console.warn('[NarrativeRetellProgression] save failed', result.error);
    }
    return {
      ...result,
      snapshot: {
        prev: { level: prev.currentLevel, progressPct: prev.progressPct },
        next: { level: next.currentLevel, progressPct: next.progressPct },
        leveledUp: next.currentLevel > prev.currentLevel,
        evidenceMet, progressDelta,
      },
    };
  }, [userId, profileId, state]);

  const bufferedTrialCount = useCallback(() => trialsRef.current.length, []);
  return {
    loaded, state, startingLevel: state?.currentLevel ?? null,
    recordTrialOutcome, flushAtSessionEnd, __bufferedTrialCount: bufferedTrialCount,
  };
}
