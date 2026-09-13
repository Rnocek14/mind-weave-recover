/**
 * The retention window only exists if the flush actually fetches it — and a
 * wider fetch must not write rows a narrow one never touched.
 *
 * `computeMastery` counts distinct sessions across 90 days, but it can only
 * count what it is handed, so `flushMasteryShadow` has to read that far back.
 * Widening the read carries two hazards, both of which this locks down.
 *
 * 1. PostgREST enforces a server-side row ceiling, and an ASCENDING query that
 *    hits it silently returns the OLDEST rows — dropping precisely the recent
 *    trials that accuracy, cue independence and the EWMA score are computed
 *    from. Newest-first under an explicit cap means truncation shortens the
 *    retention window instead of deleting the present.
 *
 * 2. The wider read drags in skills the patient has not touched in a fortnight
 *    (`mapTrialToSkills` keys on difficulty, so one game writes to two skill
 *    nodes). computeMastery finds an empty recency window for those and returns
 *    confidence 'none' with null accuracy and null cue independence; upserting
 *    that would blank a real row — including the cue-independence signal the
 *    A.3 promotion classifier reads. The write set therefore stays scoped to
 *    the recency window: exactly the rows a 14-day fetch used to produce.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Recorded {
  table: string;
  gte: Array<[string, string]>;
  order: Array<[string, { ascending?: boolean } | undefined]>;
  limit: number | null;
}

const calls: Recorded[] = [];
const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];
/** Rows the 90-day history read returns. Set per test. */
let historyRows: unknown[] = [];

function builder(table: string, rows: () => unknown[]) {
  const rec: Recorded = { table, gte: [], order: [], limit: null };
  calls.push(rec);
  const chain: Record<string, unknown> = {};
  const step = (name: string) => (...args: unknown[]) => {
    if (name === 'gte') rec.gte.push(args as [string, string]);
    if (name === 'order') rec.order.push(args as [string, { ascending?: boolean }]);
    return chain;
  };
  for (const m of ['select', 'eq', 'or', 'in', 'gte', 'order']) chain[m] = step(m);
  chain.limit = (...args: unknown[]) => {
    rec.limit = args[0] as number;
    return Promise.resolve({ data: rows(), error: null });
  };
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows(), error: null }).then(resolve);
  chain.upsert = async (row: Record<string, unknown>) => {
    upserts.push({ table, row });
    return { error: null };
  };
  return chain;
}

function trialRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    exercise_slug: 'photo_naming',
    correct: true,
    cue_level: 0,
    created_at: new Date().toISOString(),
    session_id: 's1',
    difficulty: 2,
    trial_mode: 'production',
    graded_score: null,
    score_vector: null,
    signal_granularity: 'binary',
    ...over,
  };
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'adaptation_trial_logs') return builder(table, () => []);
      // The first read is this session's logs; every later one is the history.
      const isFirst = !calls.some((c) => c.table === 'adaptation_trial_logs');
      return builder(table, () => (isFirst ? [trialRow()] : historyRows));
    },
  },
}));

import { flushMasteryShadow } from '../flushMasteryShadow';
import {
  MASTERY_RECENCY_WINDOW_DAYS,
  MASTERY_RETENTION_WINDOW_DAYS,
} from '../computeMastery';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

describe('mastery shadow fetch window', () => {
  beforeEach(() => {
    calls.length = 0;
    upserts.length = 0;
    historyRows = [trialRow()];
  });

  it('reads the retention window newest-first under an explicit cap', async () => {
    const before = Date.now();
    await flushMasteryShadow({ sessionId: 's1', userId: 'u1', profileId: 'p1' });

    const history = calls.filter(
      (c) => c.table === 'adaptation_trial_logs' && c.gte.length > 0,
    );
    expect(history.length, 'the history read never happened').toBe(1);

    const [, sinceIso] = history[0].gte[0];
    const spannedDays = (before - new Date(sinceIso).getTime()) / 86400_000;
    expect(spannedDays).toBeGreaterThan(MASTERY_RETENTION_WINDOW_DAYS - 1);
    expect(spannedDays).toBeLessThan(MASTERY_RETENTION_WINDOW_DAYS + 1);

    // Newest-first, so a truncated page keeps the present.
    expect(history[0].order[0][0]).toBe('created_at');
    expect(history[0].order[0][1]?.ascending).toBe(false);
    expect(history[0].limit, 'an uncapped page can be truncated server-side').toBeGreaterThan(0);
  });

  it('never writes a skill the patient has not practised recently', async () => {
    // Photo naming at difficulty >= 3 is a different skill node from
    // difficulty < 3. The patient worked low-frequency words six weeks ago and
    // high-frequency words today, so only the latter may be rewritten.
    historyRows = [
      trialRow({ difficulty: 4, session_id: 'old-1', created_at: daysAgo(45) }),
      trialRow({ difficulty: 4, session_id: 'old-2', created_at: daysAgo(40) }),
      ...Array.from({ length: 6 }, (_, i) =>
        trialRow({ difficulty: 2, session_id: 's1', created_at: daysAgo(i % 3) }),
      ),
    ];

    await flushMasteryShadow({ sessionId: 's1', userId: 'u1', profileId: 'p1' });

    const written = upserts
      .filter((u) => u.table === 'user_skill_mastery')
      .map((u) => u.row.skill_slug);
    expect(written).toContain('naming.high-frequency');
    expect(
      written,
      'a stale skill was recomputed from an empty recency window and would be blanked',
    ).not.toContain('naming.low-frequency');

    // And nothing that IS written may carry the empty-window signature.
    for (const u of upserts.filter((x) => x.table === 'user_skill_mastery')) {
      expect(u.row.trials_recent, String(u.row.skill_slug)).not.toBe(0);
      expect(u.row.confidence, String(u.row.skill_slug)).not.toBe('none');
    }
    expect(MASTERY_RECENCY_WINDOW_DAYS).toBeLessThan(MASTERY_RETENTION_WINDOW_DAYS);
  });
});
