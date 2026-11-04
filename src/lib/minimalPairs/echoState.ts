/**
 * What the echo step is allowed to claim.
 *
 * REPORTED: "minimal pairs im not sure if the microphone is working when it
 * asks you to say it."
 *
 * In this game the echo step IS the interaction — the person is asked to say a
 * word, and one line of text is the only signal that anything is listening.
 * That line used to be set optimistically: `setEchoStatus('listening')` ran
 * BEFORE `startListening()`, and the call sat inside `try { } catch {}` with an
 * empty handler. A recogniser that refused to open — no instance, cooldown,
 * permission denied — left the screen saying "Listening…" at someone speaking
 * into nothing, with no way to tell.
 *
 * So the label is derived, never asserted: it may only say "listening" when the
 * recogniser reports that it is.
 */
export type EchoStatus = 'idle' | 'arming' | 'listening' | 'analyzing' | 'heard' | 'skipped' | 'unavailable' | 'analysis-unavailable';

export type EchoLabel = 'get-ready' | 'one-moment' | 'listening' | 'analyzing' | 'heard' | 'moving-on' | 'mic-failed' | 'analysis-unavailable';

export function echoLabelFor(status: EchoStatus, recogniserIsListening: boolean): EchoLabel {
  switch (status) {
    case 'idle':
      return 'get-ready';
    case 'arming':
      return 'one-moment';
    case 'listening':
      // The load-bearing line. Status alone is not evidence of a microphone.
      return recogniserIsListening ? 'listening' : 'one-moment';
    case 'analyzing':
      return 'analyzing';
    case 'heard':
      return 'heard';
    case 'skipped':
      return 'moving-on';
    case 'unavailable':
      return 'mic-failed';
    case 'analysis-unavailable':
      return 'analysis-unavailable';
  }
}

/**
 * Is the echo step finished, so the trial may complete and advance?
 *
 * 'unavailable' counts. A microphone that never opened is not something the
 * person can resolve by trying harder, and leaving the round parked on a step
 * they cannot complete is worse than moving on.
 */
export function echoIsDone(status: EchoStatus): boolean {
  return status === 'heard' || status === 'skipped' || status === 'unavailable' || status === 'analysis-unavailable';
}
