/**
 * Practising less often must not be treated as failing.
 *
 * `computeMastery` counted distinct sessions inside the 14-day recency window,
 * so "distributed practice" was really measuring *frequency*. A patient working
 * a skill every ten days banked plenty of trials but only ever two sessions per
 * fortnight, which pinned confidence at 'low'; `evaluateGateRule` reads
 * low-with-≥12-trials as "stuck low" and returns 'block', and
 * `applySessionToState` refuses to level up on a blocked verdict. The result was
 * a permanent ceiling: progress sat at 100% forever, with no on-screen
 * explanation, purely because of practice cadence. Worse, a patient who had
 * already earned 'medium' lost it by easing off.
 *
 * Session count and day span now read a 90-day retention window while accuracy,
 * cue independence, the EWMA score and trial volume stay on recency.
 */
import { describe, it, expect } from 'vitest';
import {
  computeMastery,
  MASTERY_RECENCY_WINDOW_DAYS,
  MASTERY_RETENTION_WINDOW_DAYS,
  type MasteryTrial,
} from '../computeMastery';
import { evaluateGateRule } from '../readMasteryGate';
import { applySessionToState, defaultProgressionState } from '@/lib/progression/clinicalProgression';

const NOW = new Date('2026-09-13T12:00:00Z');

function history(sessions: number, perSession: number, everyDays: number): MasteryTrial[] {
  const out: MasteryTrial[] = [];
  for (let s = 0; s < sessions; s++) {
    for (let i = 0; i < perSession; i++) {
      out.push({
        is_correct: true,
        cue_level: 0,
        created_at: new Date(
          NOW.getTime() - s * everyDays * 86400_000 + i * 60_000,
        ).toISOString(),
        session_id: `sess-${s}`,
      });
    }
  }
  return out;
}

/** What flushMasteryShadow hands computeMastery: everything newer than `days`. */
function fetched(all: MasteryTrial[], days: number): MasteryTrial[] {
  const cut = NOW.getTime() - days * 86400_000;
  return all.filter((t) => new Date(t.created_at).getTime() >= cut);
}

function verdictFor(trials: MasteryTrial[]) {
  const row = computeMastery(trials, null, NOW);
  return {
    row,
    verdict: evaluateGateRule([
      { confidence: row.confidence, trialsTotal: row.trials_total },
    ]),
  };
}

describe('mastery confidence and practice cadence', () => {
  it('does not block a patient who practises a skill every ten days', () => {
    const all = history(9, 10, 10); // 90 days of once-per-10-days practice

    // The old shape: a 14-day fetch saw two sessions and 20 trials.
    const old = verdictFor(fetched(all, MASTERY_RECENCY_WINDOW_DAYS));
    expect(old.row.confidence).toBe('low');
    expect(old.verdict).toBe('block');

    // The shipped shape: the retention window sees the same 20 recent trials
    // spread across nine separate occasions.
    const now = verdictFor(fetched(all, MASTERY_RETENTION_WINDOW_DAYS));
    expect(now.verdict).toBe('pass');
    expect(now.row.confidence === 'medium' || now.row.confidence === 'high').toBe(true);
  });

  it('still withholds confidence from one massed sitting', () => {
    // 40 trials, all in a single session. Volume is not evidence of retention,
    // and the retention window cannot manufacture occasions that never happened.
    const { row, verdict } = verdictFor(history(1, 40, 0));
    expect(row.confidence).toBe('low');
    expect(verdict).toBe('block');
  });

  it('leaves every recency-scoped number exactly where it was', () => {
    // The widened fetch must not move accuracy, volume or the EWMA score — the
    // only signals that changed are session count and day span.
    for (const [sessions, per, every] of [
      [12, 10, 2],
      [8, 10, 3.5],
      [9, 10, 10],
      [1, 40, 0],
    ] as Array<[number, number, number]>) {
      const all = history(sessions, per, every);
      const narrow = computeMastery(fetched(all, MASTERY_RECENCY_WINDOW_DAYS), null, NOW);
      const wide = computeMastery(fetched(all, MASTERY_RETENTION_WINDOW_DAYS), null, NOW);
      expect(wide.trials_total).toBe(narrow.trials_total);
      expect(wide.trials_recent).toBe(narrow.trials_recent);
      expect(wide.accuracy_recent).toBe(narrow.accuracy_recent);
      expect(wide.cue_independence).toBe(narrow.cue_independence);
      expect(wide.mastery_score).toBeCloseTo(narrow.mastery_score, 12);
    }
  });

  it('can only relax a gate verdict, never tighten one', () => {
    // Sweep cadence AND session size. Session size matters on its own: the
    // shipped lesson presets include blocks as short as three trials, and a
    // widened window that let stale trials satisfy the ≥5 / ≥12 trial floors
    // would turn today's honest 'skip' — no data, no opinion, promotion
    // proceeds on accuracy — into a permanent 'block' for exactly the
    // infrequent, short-session patients this change exists to help. Volume
    // therefore stays on recency, and this is the proof.
    const RANK = { none: 0, low: 1, medium: 2, high: 3 } as const;
    const ORDER = { skip: 0, block: 1, pass: 2 } as const;
    for (let every = 1; every <= 30; every++) {
      for (const per of [3, 4, 5, 8, 10, 20]) {
        const all = history(12, per, every);
        const narrow = verdictFor(fetched(all, MASTERY_RECENCY_WINDOW_DAYS));
        const wide = verdictFor(fetched(all, MASTERY_RETENTION_WINDOW_DAYS));
        const where = `every ${every}d x ${per} trials`;
        expect(
          RANK[wide.row.confidence],
          `${where}: confidence fell ${narrow.row.confidence} -> ${wide.row.confidence}`,
        ).toBeGreaterThanOrEqual(RANK[narrow.row.confidence]);
        expect(
          ORDER[wide.verdict],
          `${where}: verdict tightened ${narrow.verdict} -> ${wide.verdict}`,
        ).toBeGreaterThanOrEqual(ORDER[narrow.verdict]);
      }
    }
  });

  it('will not manufacture occasions out of incidental one-trial visits', () => {
    // The failure the retention window makes possible: two stray taps months
    // ago plus one long sitting today would read as three separate occasions
    // and clear a gate that one massed sitting must not clear.
    const stray = (daysBack: number, id: string): MasteryTrial => ({
      is_correct: true,
      cue_level: 0,
      created_at: new Date(NOW.getTime() - daysBack * 86400_000).toISOString(),
      session_id: id,
    });
    const massedToday = history(1, 40, 0);
    const { row, verdict } = verdictFor([
      stray(80, 'stray-a'),
      stray(70, 'stray-b'),
      ...massedToday,
    ]);
    expect(row.confidence).toBe('low');
    expect(verdict).toBe('block');

    // Two REAL sessions months ago, though, are real evidence.
    const { verdict: withRealSessions } = verdictFor([
      ...history(1, 8, 0).map((t) => ({ ...t, session_id: 'old-a', created_at: new Date(NOW.getTime() - 80 * 86400_000).toISOString() })),
      ...history(1, 8, 0).map((t) => ({ ...t, session_id: 'old-b', created_at: new Date(NOW.getTime() - 70 * 86400_000).toISOString() })),
      ...massedToday,
    ]);
    expect(withRealSessions).toBe('pass');
  });

  it('keeps its silence on a short lesson block practised monthly', () => {
    // Three trials once a month: the gate has no data worth an opinion, so it
    // must return 'skip' and let accuracy and evidence decide — not 'block',
    // which no amount of correct work could ever clear at that dose.
    const { row, verdict } = verdictFor(
      fetched(history(4, 3, 30), MASTERY_RETENTION_WINDOW_DAYS),
    );
    expect(row.confidence).toBe('none');
    expect(verdict).toBe('skip');
  });

  it('documents why the verdict matters: block stops level-up outright', () => {
    // This one asserts against code the change does not touch, and so cannot
    // fail if the fix regresses — it is here to record the CONSEQUENCE the rest
    // of the file is about. Without it, "the verdict was 'block'" reads as a
    // diagnostic rather than as the thing that froze the patient's progress.
    const base = defaultProgressionState({
      userId: 'u',
      profileId: 'p',
      exerciseSlug: 'photo-naming',
    });
    const atCeiling = { ...base, progressPct: 100 };
    const trials = Array.from({ length: 10 }, () => ({
      correct: true,
      support: 'independent' as const,
    }));

    const blocked = applySessionToState(atCeiling, {
      trials,
      evidenceMet: true,
      masteryVerdict: 'block',
    });
    expect(blocked.currentLevel).toBe(base.currentLevel);

    const cleared = applySessionToState(atCeiling, {
      trials,
      evidenceMet: true,
      masteryVerdict: 'pass',
    });
    expect(cleared.currentLevel).toBe(base.currentLevel + 1);
  });
});
