/**
 * A mastery row computed by a superseded model is not evidence about this one.
 *
 * `readMasteryGate` runs at the START of a session's flush and
 * `flushMasteryShadow` rewrites the row at the END, so the row the gate reads
 * always predates the running model by at least one session. When the scoring
 * changes, the first session afterwards was still judged by the old maths — for
 * the practice-cadence fix that meant the very patient it was written for stayed
 * blocked one more time, with nothing on screen to explain it and nothing they
 * could do about it.
 *
 * A superseded row now reads as no signal, so the verdict degrades to 'skip' —
 * promotion proceeds on accuracy and evidence, exactly as for a new patient —
 * until the next flush rewrites it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let rows: Array<Record<string, unknown>> = [];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async () => ({ data: rows, error: null }),
        }),
      }),
    }),
  },
}));

import { readMasteryGate } from '../readMasteryGate';
import { MASTERY_MODEL_VERSION } from '../version';

/** A row that would block: 'low' confidence carrying real volume. */
function blockingRow(version: string | null) {
  return {
    skill_slug: 'naming.high-frequency',
    confidence: 'low',
    trials_total: 40,
    mastery_score: 0.9,
    cue_independence: 0.9,
    model_version: version,
  };
}

const args = { profileId: 'p1', exerciseSlug: 'photo_naming', difficulty: 2 };

describe('mastery gate and the model version', () => {
  beforeEach(() => {
    rows = [];
  });

  it('blocks on a row computed by the model now running', async () => {
    rows = [blockingRow(MASTERY_MODEL_VERSION)];
    expect((await readMasteryGate(args)).verdict).toBe('block');
  });

  it('has no opinion on a row computed by a superseded model', async () => {
    rows = [blockingRow('mastery-v0.1-shadow')];
    const gate = await readMasteryGate(args);
    expect(gate.verdict).toBe('skip');
    // Its quality numbers are from the old maths too, so they must not reach
    // the A.3 promotion floors either.
    expect(gate.minMasteryScore).toBeNull();
    expect(gate.minCueIndependence).toBeNull();
  });

  it('still trusts a row that predates the version column', async () => {
    // A null version is "cannot tell", not "superseded". Treating it as
    // superseded would disable the gate permanently rather than for one flush.
    rows = [blockingRow(null)];
    expect((await readMasteryGate(args)).verdict).toBe('block');
  });
});
