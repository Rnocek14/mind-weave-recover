/**
 * Verified retry ledger for the older generic exercise router.
 *
 * All legacy exercise_events writes retain one immutable attempt_id on retry,
 * including an acknowledgement lost after the backend actually inserted the
 * row. This deliberately changes neither scoring nor adaptation behavior;
 * it only prevents unverified writes being announced as completed therapy.
 */
import { useCallback, useRef } from 'react';
import { useExerciseTelemetry, type TrialData } from '@/hooks/useExerciseTelemetry';

interface EvidenceEntry {
  original: TrialData;
  confirmed: boolean;
  pending: Promise<boolean>;
}

export function useVerifiedLegacyTrialTelemetry(
  sessionId: string | null,
  exerciseSlug: string,
  userId: string | undefined,
  profileId: string | null,
) {
  const underlying = useExerciseTelemetry(sessionId, exerciseSlug);
  const scope = sessionId && userId && profileId
    ? JSON.stringify([userId, profileId, sessionId, exerciseSlug])
    : null;
  const ledger = useRef<{ scope: string | null; rows: Map<string, EvidenceEntry> }>({
    scope,
    rows: new Map(),
  });
  // A former patient's attempts must never be replayed under the current
  // patient's active session, including during a same-page profile switch.
  if (ledger.current.scope !== scope) {
    ledger.current = { scope, rows: new Map() };
  }

  const logTrial = useCallback((trial: TrialData): Promise<boolean> => {
    if (!scope || !sessionId || ledger.current.scope !== scope) {
      return Promise.resolve(false);
    }
    const attemptId = trial.attemptId ?? crypto.randomUUID();
    const alreadyTracked = ledger.current.rows.get(attemptId);
    if (alreadyTracked) return alreadyTracked.pending;
    const original: TrialData = { ...trial, attemptId };
    const entry: EvidenceEntry = {
      original,
      confirmed: false,
      pending: Promise.resolve(false),
    };
    ledger.current.rows.set(attemptId, entry);
    entry.pending = Promise.resolve().then(() => underlying.logTrial(original))
      .then(ok => { entry.confirmed = ok === true; return entry.confirmed; })
      .catch(error => {
        console.warn('[LegacyTrialTelemetry] Clinical write failed', error);
        entry.confirmed = false;
        return false;
      });
    return entry.pending;
  }, [scope, sessionId, underlying.logTrial]);

  const commitSession = useCallback(async (): Promise<{ ok: boolean }> => {
    const current = ledger.current;
    if (!scope || current.scope !== scope || current.rows.size === 0) {
      return { ok: false };
    }
    await Promise.all([...current.rows.values()].map(row => row.pending));
    return {
      ok: current === ledger.current &&
        [...current.rows.values()].every(row => row.confirmed),
    };
  }, [scope]);

  const retryFailedSubmissions = useCallback(async (): Promise<{ ok: boolean }> => {
    const current = ledger.current;
    if (!scope || current.scope !== scope) return { ok: false };
    for (const entry of current.rows.values()) {
      await entry.pending;
      if (entry.confirmed) continue;
      // The original clinical attempt ID and all speech/response metadata
      // are reused; a successful previous insert is idempotent at the DB.
      entry.pending = Promise.resolve()
        .then(() => underlying.logTrial(entry.original))
        .then(ok => { entry.confirmed = ok === true; return entry.confirmed; })
        .catch(error => {
          console.warn('[LegacyTrialTelemetry] Clinical replay failed', error);
          entry.confirmed = false;
          return false;
        });
      await entry.pending;
    }
    return {
      ok: current === ledger.current &&
        [...current.rows.values()].every(row => row.confirmed),
    };
  }, [scope, underlying.logTrial]);

  return { ...underlying, logTrial, commitSession, retryFailedSubmissions };
}
