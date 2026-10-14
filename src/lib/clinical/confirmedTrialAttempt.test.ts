import { describe, expect, it } from 'vitest';
import { isConfirmedTrialAttempt } from './confirmedTrialAttempt';

const expected = {
  attempt_id: 'a',
  session_id: 'session-1',
  exercise_slug: 'photo_naming',
};

describe('confirmed duplicate therapy attempt', () => {
  it('accepts a previously persisted attempt with the exact identity', () => {
    expect(isConfirmedTrialAttempt({ ...expected }, expected)).toBe(true);
  });

  it('rejects missing rows, cross-session attempts and other games', () => {
    expect(isConfirmedTrialAttempt(null, expected)).toBe(false);
    expect(isConfirmedTrialAttempt(undefined, expected)).toBe(false);
    expect(isConfirmedTrialAttempt({ ...expected, session_id: 'session-2' }, expected)).toBe(false);
    expect(isConfirmedTrialAttempt({ ...expected, exercise_slug: 'fix_sentence' }, expected)).toBe(false);
    expect(isConfirmedTrialAttempt({ ...expected, attempt_id: 'b' }, expected)).toBe(false);
  });
});
