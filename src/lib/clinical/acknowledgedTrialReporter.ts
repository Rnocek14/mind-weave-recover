/**
 * A patient can finish responding long before optional speech analysis does.
 * Persist the response once, using the best evidence available by the deadline,
 * and expose an explicit persistence acknowledgement before allowing advance.
 * Late analysis may still write speech-specific evidence but never a second
 * scored exercise_event for the same attempt.
 */
export function createAcknowledgedTrialReporter<T>(
  write: (result: T) => Promise<boolean> | boolean,
  fallback: T,
  deadlineMs = 3000,
  writeDeadlineMs = 25000,
): {
  report: (result: T) => Promise<boolean>;
  acknowledgement: Promise<boolean>;
  retry: () => Promise<boolean>;
} {
  let reported = false;
  let submitted: T | undefined;
  let resolveAck: (ok: boolean) => void = () => {};
  let retryPending: Promise<boolean> | null = null;
  const acknowledgement = new Promise<boolean>((resolve) => {
    resolveAck = resolve;
  });

  const writeWithDeadline = async (result: T): Promise<boolean> => {
    // Even a hung network request must eventually surface a retryable failure
    // instead of trapping the patient on feedback forever.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => write(result)).then((saved) => saved === true).catch(() => false),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), writeDeadlineMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  };

  const report = async (result: T): Promise<boolean> => {
    if (reported) return acknowledgement;
    reported = true;
    submitted = result;
    clearTimeout(deadline);
    const persisted = await writeWithDeadline(result);
    resolveAck(persisted);
    return persisted;
  };

  // This timer is a safety deadline, not a validity/accuracy threshold.
  // A slow optional AI service cannot block the primary clinical write forever.
  const deadline = setTimeout(() => { void report(fallback); }, deadlineMs);

  const retry = async (): Promise<boolean> => {
    if (!reported || submitted === undefined) return false;
    if (retryPending) return retryPending;
    retryPending = writeWithDeadline(submitted)
      .finally(() => { retryPending = null; });
    return retryPending;
  };

  return { report, acknowledgement, retry };
}
