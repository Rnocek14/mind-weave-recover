/**
 * "minimal pairs im not sure if the microphone is working when it asks you to
 * say it."
 *
 * These exercise the SHIPPED functions the component renders from, not a
 * restatement of them.
 */
import { describe, it, expect } from 'vitest';
import { echoLabelFor, echoIsDone, type EchoStatus } from '@/lib/minimalPairs/echoState';

describe('the label may not claim a microphone it does not have', () => {
  it('never says listening when the recogniser is not listening', () => {
    // The exact failure: status was set to 'listening' BEFORE startListening
    // ran, and the call was wrapped in an empty catch. The person was asked to
    // speak into a microphone that had refused to open.
    expect(echoLabelFor('listening', false)).toBe('one-moment');
  });

  it('says listening once the recogniser really is', () => {
    expect(echoLabelFor('listening', true)).toBe('listening');
  });

  it('shows an honest in-between while the mic is being armed', () => {
    expect(echoLabelFor('arming', false)).toBe('one-moment');
    expect(echoLabelFor('arming', true)).toBe('one-moment');
  });

  it('tells the person plainly when the mic never opened', () => {
    expect(echoLabelFor('unavailable', false)).toBe('mic-failed');
  });

  it('asks them to get ready before anything is open', () => {
    expect(echoLabelFor('idle', false)).toBe('get-ready');
  });

  it('is total — every status has a label', () => {
    const all: EchoStatus[] = ['idle', 'arming', 'listening', 'heard', 'skipped', 'unavailable'];
    for (const s of all) {
      for (const live of [true, false]) {
        expect(echoLabelFor(s, live), `${s}/${live}`).toBeTruthy();
      }
    }
  });
});

describe('a microphone that never opened must not strand the round', () => {
  it('counts as finished, like a skip', () => {
    // Not something the person can resolve by trying harder. Parking the round
    // on a step they cannot complete is worse than moving on.
    expect(echoIsDone('unavailable')).toBe(true);
    expect(echoIsDone('skipped')).toBe(true);
    expect(echoIsDone('heard')).toBe(true);
  });

  it('does not let an in-progress echo finish the trial early', () => {
    expect(echoIsDone('idle')).toBe(false);
    expect(echoIsDone('arming')).toBe(false);
    expect(echoIsDone('listening')).toBe(false);
  });
});
