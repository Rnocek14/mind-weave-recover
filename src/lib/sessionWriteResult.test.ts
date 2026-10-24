import { describe, expect, it } from 'vitest';
import { sessionWriteApplied } from './sessionWriteResult';

describe('session write acknowledgement', () => {
  it('requires an explicit true from PostgreSQL', () => {
    expect(sessionWriteApplied(true, null)).toBe(true);
  });

  it.each([false, null, undefined, 0, 1, 'true', {}, []])(
    'does not treat a non-boolean response as persisted: %s',
    (value) => {
      expect(sessionWriteApplied(value, null)).toBe(false);
    },
  );

  it('does not treat a database error as a persisted write', () => {
    expect(sessionWriteApplied(true, { message: 'database rejected write' })).toBe(false);
  });
});
