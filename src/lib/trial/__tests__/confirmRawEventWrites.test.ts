import { describe, expect, it } from 'vitest';
import { confirmRawEventWrites } from '@/lib/trial/confirmRawEventWrites';

describe('confirmRawEventWrites', () => {
  it('waits for delayed final attempt before declaring a game complete', async () => {
    let finish!: (saved: boolean) => void;
    const last = new Promise<boolean>(resolve => { finish = resolve; });
    const pending = confirmRawEventWrites([Promise.resolve(true), last], 2);
    let complete = false;
    void pending.then(() => { complete = true; });
    await Promise.resolve();
    expect(complete).toBe(false);
    finish(true);
    expect(await pending).toEqual({ ok: true, saved: 2 });
  });

  it('fails closed on lost, missing, rejected and zero-attempt sessions', async () => {
    const outcomes = await Promise.all([
      confirmRawEventWrites([Promise.resolve(false)], 1),
      confirmRawEventWrites([Promise.reject(new Error('offline'))], 1),
      confirmRawEventWrites([Promise.resolve(true)], 2),
      confirmRawEventWrites([], 0),
    ]);
    for (const outcome of outcomes) expect(outcome.ok).toBe(false);
  });

  it('preserves counts of actually saved attempts for audit', async () => {
    expect(await confirmRawEventWrites(
      [Promise.resolve(true), Promise.resolve(false), Promise.resolve(true)], 3,
    )).toEqual({ ok: false, saved: 2, reason: 'One or more raw attempt writes failed' });
  });
});
