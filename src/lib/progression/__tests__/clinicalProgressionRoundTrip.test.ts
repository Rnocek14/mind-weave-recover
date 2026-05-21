/**
 * PR2 — Round-trip persistence test for clinical_progression_state.
 *
 * Goal: prove that a state computed by `applySessionToState` survives a
 * save → load cycle byte-for-byte (within numeric tolerance). This is the
 * minimum bar before we trust per-(profile × game) progression in prod.
 *
 * We mock the supabase client with an in-memory store keyed by
 * (profile_id, exercise_slug) — same as the real `onConflict` clause.
 * No new clinical logic is introduced.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => {
  const store = new Map<string, any>();
  const key = (row: any) => `${row.profile_id}::${row.exercise_slug}`;
  const builder = () => {
    let filters: Record<string, any> = {};
    const api: any = {
      select: () => api,
      eq: (col: string, val: any) => { filters[col] = val; return api; },
      maybeSingle: async () => {
        const k = `${filters.profile_id}::${filters.exercise_slug}`;
        return { data: store.get(k) ?? null, error: null };
      },
      upsert: async (row: any) => { store.set(key(row), row); return { error: null }; },
    };
    return api;
  };
  return {
    supabase: { from: () => builder() },
    __store: store,
  };
});

import {
  defaultProgressionState,
  applySessionToState,
  loadProgressionState,
  saveProgressionState,
} from '../clinicalProgression';
import * as client from '@/integrations/supabase/client';

const ids = { userId: 'u-roundtrip', profileId: 'p-roundtrip', exerciseSlug: 'photo-naming' };

describe('clinical_progression_state — round-trip persistence (PR2)', () => {
  beforeEach(() => {
    (client as any).__store.clear();
  });

  it('load() returns Level 1 default when no row exists', async () => {
    const loaded = await loadProgressionState(ids);
    expect(loaded.currentLevel).toBe(1);
    expect(loaded.progressPct).toBe(0);
    expect(loaded.supportBaseline).toBe(0);
  });

  it('save() then load() returns identical level / progress / support', async () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, {
      trials: Array.from({ length: 25 }, () => ({
        correct: true as const,
        support: 'independent' as const,
      })),
      evidenceMet: false,
    });
    const save = await saveProgressionState(s);
    expect(save.ok).toBe(true);

    const loaded = await loadProgressionState(ids);
    expect(loaded.currentLevel).toBe(s.currentLevel);
    expect(loaded.stableLevel).toBe(s.stableLevel);
    expect(loaded.supportBaseline).toBe(s.supportBaseline);
    expect(loaded.progressPct).toBeCloseTo(s.progressPct, 5);
    expect(loaded.consecutiveSuccessSessions).toBe(s.consecutiveSuccessSessions);
    expect(loaded.consecutiveStruggleSessions).toBe(s.consecutiveStruggleSessions);
  });

  it('a level-up survives the round-trip (Level 1 → Level 2)', async () => {
    let s = defaultProgressionState(ids);
    s = applySessionToState(s, {
      trials: Array.from({ length: 10000 }, () => ({
        correct: true as const, support: 'independent' as const,
      })),
      evidenceMet: true,
    });
    expect(s.currentLevel).toBe(2);
    await saveProgressionState(s);

    const loaded = await loadProgressionState(ids);
    expect(loaded.currentLevel).toBe(2);
    expect(loaded.progressPct).toBe(0); // reset on level-up
  });

  it('progression is keyed by (profile_id, exercise_slug) — no cross-game leakage', async () => {
    const naming = { ...ids, exerciseSlug: 'photo-naming' };
    const pairs = { ...ids, exerciseSlug: 'minimal-pairs' };

    let a = applySessionToState(defaultProgressionState(naming), {
      trials: [{ correct: true, support: 'independent' }],
      evidenceMet: false,
    });
    await saveProgressionState(a);

    const loadedPairs = await loadProgressionState(pairs);
    expect(loadedPairs.currentLevel).toBe(1);
    expect(loadedPairs.progressPct).toBe(0);

    const loadedNaming = await loadProgressionState(naming);
    expect(loadedNaming.progressPct).toBeGreaterThan(0);
  });
});
