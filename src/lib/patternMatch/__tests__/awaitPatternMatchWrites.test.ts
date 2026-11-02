import { describe, expect, it, vi } from 'vitest';
import { awaitPatternMatchWrites } from '@/lib/patternMatch/awaitPatternMatchWrites';

describe('Pattern Match save barrier', () => {
  it('waits for every raw trial before permitting session completion', async () => {
    let release!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { release = resolve; });
    const gate = awaitPatternMatchWrites([Promise.resolve(true), pending], 2);
    const done = vi.fn();
    void gate.then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    release(true);
    expect(await gate).toEqual({ ok: true });
  });

  it('rejects a write failure, missing trial and rejected promise', async () => {
    expect((await awaitPatternMatchWrites([Promise.resolve(false)], 1)).ok).toBe(false);
    expect((await awaitPatternMatchWrites([Promise.resolve(true)], 2)).ok).toBe(false);
    expect((await awaitPatternMatchWrites([Promise.reject(new Error('offline'))], 1)).ok).toBe(false);
  });

  it('rejects a malformed expected count instead of treating zero saved events as success', async () => {
    expect((await awaitPatternMatchWrites([], 0)).ok).toBe(false);
  });
});
