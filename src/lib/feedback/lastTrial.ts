/**
 * lastTrial — an in-memory record of the trial that just happened.
 *
 * WHY A MODULE SINGLETON AND NOT CONTEXT: the report button is mounted once
 * at the app root (like the pause control) so that no game needs editing, but
 * a useful report needs the trial's context — what was asked, what was said,
 * how it scored. Threading that up through eighteen games via props or a
 * provider would touch eighteen files in the exact code paths where we have
 * previously introduced bugs. One write, from the single unified submission
 * hook, reaches every game that uses the unified trial contract.
 *
 * Deliberately NOT persisted. A report should describe the session in front
 * of the person, not something recovered from storage an hour later.
 */

/** The subset of a trial worth attaching to a report. */
export interface LastTrial {
  exerciseSlug: string;
  sessionId: string | null;
  level: number;
  trialIndex: number | null;
  stimulusId: string | null;
  /** What the app was looking for. */
  expected: string | null;
  /** What the app decided the person said, after its own cleanup. */
  userResponse: string | null;
  /** What the browser's recognizer actually heard, before cleanup. */
  browserTranscript: string | null;
  isCorrect: boolean;
  cueLevel: number | null;
  /** Epoch ms, so the control can hide itself once the trial is stale. */
  at: number;
}

let current: LastTrial | null = null;

/**
 * Record the trial just submitted. Never throws: this runs inside the
 * submission path, and a broken feedback feature must not be able to break
 * a practice session.
 */
export function recordLastTrial(trial: Omit<LastTrial, 'at'>, now: number = Date.now()): void {
  try {
    current = { ...trial, at: now };
  } catch {
    /* ignore — feedback is never worth an exception here */
  }
}

/**
 * The last trial, if it is recent enough to still be the one on screen.
 * Beyond the window we return null so the button can disappear rather than
 * offer to report something the person has already forgotten.
 */
export function getRecentTrial(maxAgeMs = 120_000, now: number = Date.now()): LastTrial | null {
  if (!current) return null;
  return now - current.at <= maxAgeMs ? current : null;
}

/** Clear on exercise exit, so a report can't leak across exercises. */
export function clearLastTrial(): void {
  current = null;
}
