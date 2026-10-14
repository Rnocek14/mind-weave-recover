import {
  isConfirmedTrialAttempt,
  type ClinicalAttemptIdentity,
} from './confirmedTrialAttempt';

export interface ClinicalWriteError {
  code?: string;
  message?: string;
}

export interface ClinicalAttemptWriter {
  insert: () => Promise<{ error: ClinicalWriteError | null }>;
  findByAttempt: () => Promise<{
    data: ClinicalAttemptIdentity | null;
    error: ClinicalWriteError | null;
  }>;
}

const DEFAULT_DELAYS_MS = [0, 700, 2000] as const;

/**
 * Retry with one immutable attempt identity. If an HTTP response was lost
 * after a successful insert, check the database before retrying. PostgreSQL
 * enforces a unique attempt_id, so a verified pre-existing row is an ACK,
 * not another trial. Never treat an unverified uniqueness error as success.
 *
 * This does NOT authorize a different user/session; the caller's database
 * lookup must remain protected by RLS and this verifies its exact identity.
 */
export async function persistClinicalAttempt(
  identity: ClinicalAttemptIdentity,
  writer: ClinicalAttemptWriter,
  options: {
    delaysMs?: readonly number[];
    sleep?: (milliseconds: number) => Promise<void>;
    onFailedAttempt?: (attempt: number, message: string) => void;
  } = {},
): Promise<boolean> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  for (let i = 0; i < delays.length; i += 1) {
    if (delays[i] > 0) await sleep(delays[i]);
    let failureMessage = 'unknown write failure';

    try {
      const { error } = await writer.insert();
      if (error == null) return true;
      failureMessage = error.message ?? error.code ?? failureMessage;
    } catch (error) {
      failureMessage = error instanceof Error ? error.message : failureMessage;
    }

    // Includes ambiguous transport errors and 23505 unique violations. Only
    // a row with matching session + exercise + attempt_id counts as saved.
    try {
      const { data, error } = await writer.findByAttempt();
      if (!error && isConfirmedTrialAttempt(data, identity)) return true;
    } catch {
      // A failed check is not an acknowledgement.
    }

    options.onFailedAttempt?.(i + 1, failureMessage);
  }

  return false;
}
