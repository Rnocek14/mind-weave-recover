/**
 * Snapshot fixtures for the digest layer (PR-B2).
 *
 * These cover the six canonical session shapes. Snapshot diffs become
 * therapeutic-language QA: any future change in tone or ordering shows up
 * in a snapshot review, not just a green-or-red unit test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  digestSessionRows,
  type AdaptationTrialRow,
} from '../sessionAdaptationDigest';
import { resetSafetyTelemetry } from '../safetyTelemetry';

// Fixture builders ----------------------------------------------------------

function row(overrides: Partial<AdaptationTrialRow> & { exercise_slug: string; trial_index: number }): AdaptationTrialRow {
  return {
    cue_level: 0,
    cue_dependency: 0.2,
    success_rate: 0.75,
    correct: true,
    fatigue: 'low',
    difficulty: 3,
    difficulty_change_direction: 'hold',
    ...overrides,
  };
}

function goodDay(): AdaptationTrialRow[] {
  // Independence gain: cue dependency falls, difficulty holds, accuracy strong.
  return Array.from({ length: 14 }, (_, i) =>
    row({
      exercise_slug: 'photo-naming',
      trial_index: i,
      cue_dependency: i < 7 ? 0.5 : 0.15,
      success_rate: 0.82,
      difficulty: 4,
      difficulty_change_direction: i === 13 ? 'up' : 'hold',
    }),
  );
}

function fatigueSession(): AdaptationTrialRow[] {
  return Array.from({ length: 12 }, (_, i) =>
    row({
      exercise_slug: 'narrative-retell',
      trial_index: i,
      fatigue: i >= 5 ? 'high' : 'low',
      success_rate: 0.6,
      difficulty_change_direction: i === 8 ? 'down' : 'hold',
      difficulty: i < 8 ? 4 : 3,
    }),
  );
}

function mixedSession(): AdaptationTrialRow[] {
  return [
    ...Array.from({ length: 11 }, (_, i) =>
      row({
        exercise_slug: 'photo-naming',
        trial_index: i,
        cue_dependency: i < 5 ? 0.55 : 0.18,
        success_rate: 0.78,
        difficulty: 4,
      }),
    ),
    ...Array.from({ length: 11 }, (_, i) =>
      row({
        exercise_slug: 'two-clues',
        trial_index: i,
        success_rate: 0.7,
        difficulty: 3,
        difficulty_change_direction: i % 3 === 0 ? 'up' : 'hold',
      }),
    ),
  ];
}

function steadySession(): AdaptationTrialRow[] {
  return Array.from({ length: 18 }, (_, i) =>
    row({
      exercise_slug: 'fix-sentence',
      trial_index: i,
      success_rate: 0.7 + (i % 2 === 0 ? 0.02 : -0.02),
      difficulty: 3,
    }),
  );
}

function lowDataSession(): AdaptationTrialRow[] {
  return Array.from({ length: 4 }, (_, i) =>
    row({ exercise_slug: 'photo-naming', trial_index: i }),
  );
}

function supportHeavySession(): AdaptationTrialRow[] {
  return [
    ...Array.from({ length: 12 }, (_, i) =>
      row({
        exercise_slug: 'narrative-retell',
        trial_index: i,
        fatigue: i >= 4 ? 'high' : 'low',
        success_rate: 0.55,
        difficulty: i < 6 ? 4 : 3,
        difficulty_change_direction: i === 6 ? 'down' : 'hold',
      }),
    ),
    ...Array.from({ length: 12 }, (_, i) =>
      row({
        exercise_slug: 'fix-sentence',
        trial_index: i,
        success_rate: 0.5,
        difficulty: i < 4 ? 4 : 3,
        difficulty_change_direction: i < 6 ? 'down' : 'hold',
      }),
    ),
  ];
}

// Tests ---------------------------------------------------------------------

beforeEach(() => resetSafetyTelemetry());

function summarize(name: string, rows: AdaptationTrialRow[]) {
  const result = digestSessionRows(rows, { resetTelemetry: true });
  return {
    fixture: name,
    insights: result.insights.map((i) => ({
      text: i.text,
      category: i.category,
      source: i.source,
      confidence: i.confidence,
    })),
    signalKinds: result.signals.map((s) => `${s.kind}:${s.confidence}`).sort(),
    telemetry: result.telemetry,
  };
}

describe('sessionAdaptationDigest — snapshot fixtures', () => {
  it('good day', () => {
    expect(summarize('good_day', goodDay())).toMatchSnapshot();
  });

  it('fatigue session', () => {
    expect(summarize('fatigue', fatigueSession())).toMatchSnapshot();
  });

  it('mixed session', () => {
    expect(summarize('mixed', mixedSession())).toMatchSnapshot();
  });

  it('steady session', () => {
    expect(summarize('steady', steadySession())).toMatchSnapshot();
  });

  it('low-data session', () => {
    expect(summarize('low_data', lowDataSession())).toMatchSnapshot();
  });

  it('support-heavy session', () => {
    expect(summarize('support_heavy', supportHeavySession())).toMatchSnapshot();
  });
});

describe('sessionAdaptationDigest — invariants', () => {
  it('returns empty insights and increments emptyOutputs for low-data sessions', () => {
    const r = digestSessionRows(lowDataSession(), { resetTelemetry: true });
    expect(r.insights).toEqual([]);
    expect(r.telemetry.emptyOutputs).toBe(1);
  });

  it('respects the support-line cap (≤1 support line per session)', () => {
    const r = digestSessionRows(supportHeavySession(), { resetTelemetry: true });
    const supportCount = r.insights.filter((i) => i.category === 'support').length;
    expect(supportCount).toBeLessThanOrEqual(1);
  });

  it('caps total lines at 2 by default', () => {
    const r = digestSessionRows(mixedSession(), { resetTelemetry: true });
    expect(r.insights.length).toBeLessThanOrEqual(2);
  });

  it('records signalsGenerated when any signal is derived', () => {
    const r = digestSessionRows(goodDay(), { resetTelemetry: true });
    expect(r.telemetry.signalsGenerated).toBeGreaterThan(0);
  });

  it('never emits a banned term', () => {
    const all = [
      ...goodDay(),
      ...fatigueSession(),
      ...mixedSession(),
      ...steadySession(),
      ...supportHeavySession(),
    ];
    const r = digestSessionRows(all, { resetTelemetry: true });
    const text = r.insights.map((i) => i.text).join(' ').toLowerCase();
    for (const banned of ['decreased', 'declined', 'regressed', 'failed', 'struggled', 'cue dependency']) {
      expect(text).not.toContain(banned);
    }
  });
});
