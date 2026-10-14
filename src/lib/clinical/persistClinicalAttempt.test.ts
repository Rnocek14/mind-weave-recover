import { describe, expect, it, vi } from 'vitest';
import { persistClinicalAttempt } from './persistClinicalAttempt';

const identity = {
  attempt_id: 'attempt-a',
  session_id: 'session-a',
  exercise_slug: 'photo_naming',
};

const noWait = { delaysMs: [0, 0, 0] } as const;

describe('clinical trial retry acknowledgement', () => {
  it('inserts once on a normal acknowledgement', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const findByAttempt = vi.fn();
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(findByAttempt).not.toHaveBeenCalled();
  });

  it('recovers an ambiguous response by verifying the same persisted attempt', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '504', message: 'upstream timed out after commit' },
    });
    const findByAttempt = vi.fn().mockResolvedValue({
      data: { ...identity },
      error: null,
    });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('accepts a unique violation only after confirming the same session and game', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    });
    const findByAttempt = vi.fn().mockResolvedValue({ data: { ...identity }, error: null });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(true);
  });

  it('does not accept a duplicate attempt owned by a different session', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    });
    const findByAttempt = vi.fn().mockResolvedValue({
      data: { ...identity, session_id: 'another-session' }, error: null,
    });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(false);
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it('does not accept a duplicate attempt owned by a different exercise', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key' },
    });
    const findByAttempt = vi.fn().mockResolvedValue({
      data: { ...identity, exercise_slug: 'fix_sentence' }, error: null,
    });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(false);
  });

  it('retries after network exceptions and succeeds only when storage acknowledges', async () => {
    const insert = vi.fn()
      .mockRejectedValueOnce(new Error('network offline'))
      .mockResolvedValueOnce({ error: null });
    const findByAttempt = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('fails closed when inserts fail and lookup is denied', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('offline'));
    const findByAttempt = vi.fn().mockResolvedValue({
      data: null, error: { code: '42501', message: 'denied' },
    });
    expect(await persistClinicalAttempt(identity, { insert, findByAttempt }, noWait)).toBe(false);
    expect(insert).toHaveBeenCalledTimes(3);
    expect(findByAttempt).toHaveBeenCalledTimes(3);
  });
});
