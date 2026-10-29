import { useCallback, useEffect, useRef, useState } from 'react';

export type ExerciseSaveState = 'idle' | 'saving' | 'error' | 'complete';

interface VerifiedCompletionOptions<T> {
  /** A patient/profile/session-specific key. Null means clinical saving is unavailable. */
  scope: string | null;
  /** Includes the last in-flight exercise_events writes and progression/mastery flush. */
  commitSession: () => Promise<{ ok: boolean }>;
  /** Must acknowledge the actual session close, not just dispatch a UI event. */
  completeSession: () => Promise<boolean>;
  /** Replays only unconfirmed raw attempts under their original attempt_id. */
  retryFailedSubmissions: () => Promise<{ ok: boolean }>;
  /** Called once AFTER both persistence confirmations. UI/navigation failures do not undo a save. */
  onConfirmed: (results: T) => void | Promise<void>;
}

interface CompletionState<T> {
  scope: string | null;
  pending: boolean;
  committed: boolean;
  confirmed: boolean;
  results: T | null;
}

/**
 * Patient-safe completion barrier shared by therapy pages.
 *
 * A saved trial is NOT a saved session; a successful progression flush is NOT
 * proof of session closure. Neither the page nor the parent lesson is told
 * "complete" until both boundaries acknowledge success. If the final close
 * fails after a successful commit, retry must NOT flush progression twice.
 */
export function useVerifiedExerciseCompletion<T>({
  scope,
  commitSession,
  completeSession,
  retryFailedSubmissions,
  onConfirmed,
}: VerifiedCompletionOptions<T>) {
  const [saveState, setSaveState] = useState<ExerciseSaveState>('idle');
  const stateRef = useRef<CompletionState<T>>({
    scope,
    pending: false,
    committed: false,
    confirmed: false,
    results: null,
  });

  useEffect(() => {
    // A component may remain mounted as a caregiver changes active profiles.
    // A previous patient's result must never be retried against the new scope.
    if (stateRef.current.scope !== scope) {
      stateRef.current = {
        scope, pending: false, committed: false, confirmed: false, results: null,
      };
      setSaveState('idle');
    }
  }, [scope]);

  const attempt = useCallback(async (retry: boolean, results?: T): Promise<boolean> => {
    const current = stateRef.current;
    if (current.scope !== scope || current.pending || current.confirmed) return false;
    if (results !== undefined) current.results = results;
    if (current.results === null) return false;
    // Never present an unsaved offline/no-session attempt as saved clinical care.
    if (!scope) {
      setSaveState('error');
      return false;
    }

    current.pending = true;
    setSaveState('saving');
    try {
      if (retry && !current.committed) {
        const recovery = await retryFailedSubmissions();
        if (!recovery.ok) throw new Error('Unconfirmed trial writes remain');
      }

      if (!current.committed) {
        const commit = await commitSession();
        if (!commit.ok) throw new Error('Clinical trial commit was not confirmed');
        current.committed = true;
      }

      const closed = await completeSession();
      if (!closed) throw new Error('Session closure was not confirmed');

      // An old outstanding request cannot celebrate or advance a new patient.
      if (current !== stateRef.current || current.scope !== scope) return false;
      current.confirmed = true;
      setSaveState('complete');

      try {
        await onConfirmed(current.results);
      } catch (error) {
        // Clinical persistence succeeded. A UI callback failure must not
        // display a false "not saved" state or replay already saved trials.
        console.error('[ExerciseCompletion] Post-save UI transition failed:', error);
      }
      return true;
    } catch {
      if (current === stateRef.current && current.scope === scope) {
        setSaveState('error');
      }
      return false;
    } finally {
      current.pending = false;
    }
  }, [scope, commitSession, completeSession, retryFailedSubmissions, onConfirmed]);

  const finish = useCallback((results: T) => attempt(false, results), [attempt]);
  const retry = useCallback(() => attempt(true), [attempt]);
  return { saveState, finish, retry };
}
