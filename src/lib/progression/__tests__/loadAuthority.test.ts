/**
 * A session must never be persisted on top of progression we could not read.
 *
 * `loadProgressionState` falls back to a default Level 1 state when the row
 * cannot be read — a transport error, a thrown network error, or the caller's
 * own load timeout on a cold start or a poor mobile link. That fallback is
 * indistinguishable from a genuine new patient, so the end-of-session upsert
 * wrote it straight over real progress: a patient stored at Level 4 came back
 * from one failed read as Level 1, losing three levels and the soft-regression
 * anchor, with an audit row recording the demotion as a normal session flush.
 *
 * "No row yet" (a real new patient) must still persist normally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upsert = vi.fn(async (..._args: unknown[]) => ({ error: null }));
const insert = vi.fn(async (..._args: unknown[]) => ({ error: null }));
let selectResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: (..._a: unknown[]) => ({
        eq: (..._b: unknown[]) => ({
          eq: (..._c: unknown[]) => ({ maybeSingle: async () => selectResult }),
        }),
      }),
      upsert: (...args: unknown[]) => upsert(...args),
      insert: (...args: unknown[]) => insert(...args),
    }),
  },
}));

import {
  loadProgressionState,
  saveProgressionState,
  defaultProgressionState,
} from '../clinicalProgression';

const ids = { userId: 'u1', profileId: 'p1', exerciseSlug: 'photo-naming' };

describe('progression load authority', () => {
  beforeEach(() => {
    upsert.mockClear();
    insert.mockClear();
    selectResult = { data: null, error: null };
  });

  it('marks a failed read so it cannot be written back', async () => {
    selectResult = { data: null, error: { message: 'network down' } };
    const state = await loadProgressionState(ids);
    expect(state.currentLevel).toBe(1);
    expect(state.loadFailed).toBe(true);

    const result = await saveProgressionState(state);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('progression_load_not_authoritative');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('still persists normally for a genuinely new patient with no row', async () => {
    selectResult = { data: null, error: null };
    const state = await loadProgressionState(ids);
    expect(state.loadFailed).toBeUndefined();

    const result = await saveProgressionState(state);
    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('carries the flag through a session rollup', async () => {
    const fallback = defaultProgressionState(ids, { loadFailed: true });
    // Hooks spread prev into the next state, so the flag must survive.
    const next = { ...fallback, currentLevel: 2 };
    const result = await saveProgressionState(next);
    expect(result.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
