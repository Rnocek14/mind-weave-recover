import { describe, expect, it } from 'vitest';
import { verifyPhrasePracticeWrites } from '@/lib/phrasePractice/verifyPhrasePracticeWrites';

describe('Phrase Practice raw attempt save barrier', () => {
  it('waits for a delayed final write', async () => {
    let release!: (saved: boolean) => void;
    const pending = new Promise<boolean>((resolve) => { release = resolve; });
    const check = verifyPhrasePracticeWrites([Promise.resolve(true), pending], 2, true);
    let done = false;
    void check.then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    release(true);
    expect(await check).toEqual({ ok: true });
  });

  it('rejects missing, failed, unverified and disconnected attempts', async () => {
    expect((await verifyPhrasePracticeWrites([Promise.resolve(false)], 1, true)).ok).toBe(false);
    expect((await verifyPhrasePracticeWrites([Promise.reject(new Error('offline'))], 1, true)).ok).toBe(false);
    expect((await verifyPhrasePracticeWrites([Promise.resolve(undefined)], 1, true)).ok).toBe(false);
    expect((await verifyPhrasePracticeWrites([], 1, true)).ok).toBe(false);
    expect((await verifyPhrasePracticeWrites([], 1, false)).ok).toBe(false);
  });
});
