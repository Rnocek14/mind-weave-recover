/**
 * Tests for shadow progression gate (S1).
 * Pure-function tests only. No DB, no React, no integration.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateGate,
  isAdoptedForGate,
  type GateInput,
  type GateAnomaly,
} from '../gate';

const ADOPTED = 'photo-naming';
const NOT_ADOPTED = 'category-fluency';

function baseInput(over: Partial<GateInput> = {}): GateInput {
  return {
    surface: 'mastery_write',
    trial: { exercise_slug: ADOPTED, trial_mode: 'production' },
    trialAnomalies: [],
    sessionAnomalies: [],
    windowAnomalies: [],
    checklistVersion: 'test-1',
    ...over,
  };
}

const a = (rule_id: string, scope: GateAnomaly['scope'] = 'trial'): GateAnomaly => ({
  rule_id,
  scope,
});

describe('evaluateGate — adopted-slug gating', () => {
  it('photo-naming is adopted; other slugs are not', () => {
    expect(isAdoptedForGate(ADOPTED)).toBe(true);
    expect(isAdoptedForGate(NOT_ADOPTED)).toBe(false);
    expect(isAdoptedForGate('')).toBe(false);
  });

  it('non-adopted slug returns pass with slug_not_adopted reason regardless of anomalies', () => {
    const r = evaluateGate(
      baseInput({
        trial: { exercise_slug: NOT_ADOPTED, trial_mode: 'production' },
        trialAnomalies: [a('S1'), a('C4')],
      }),
    );
    expect(r.decision).toBe('pass');
    expect(r.would_change).toBe(false);
    expect(r.reasons).toEqual(['slug_not_adopted']);
    expect(r.rule_ids).toEqual([]);
  });

  it('empty exercise_slug is treated as not adopted', () => {
    const r = evaluateGate(
      baseInput({
        trial: { exercise_slug: '', trial_mode: 'production' },
        trialAnomalies: [a('S1')],
      }),
    );
    expect(r.decision).toBe('pass');
    expect(r.reasons).toEqual(['slug_not_adopted']);
  });
});

describe('evaluateGate — pass-through', () => {
  it('no anomalies → pass', () => {
    const r = evaluateGate(baseInput());
    expect(r.decision).toBe('pass');
    expect(r.would_change).toBe(false);
    expect(r.rule_ids).toEqual([]);
  });

  it('unknown rule_id contributes nothing', () => {
    const r = evaluateGate(
      baseInput({ trialAnomalies: [a('Z99'), a('UNKNOWN')] }),
    );
    expect(r.decision).toBe('pass');
  });

  it('rule that has policy on a different surface contributes nothing', () => {
    // D8 only affects scaffold_withdraw; on mastery_write it must pass.
    const r = evaluateGate(
      baseInput({
        surface: 'mastery_write',
        windowAnomalies: [a('D8', 'user_slug_window')],
      }),
    );
    expect(r.decision).toBe('pass');
  });
});

describe('evaluateGate — mastery_write rules', () => {
  it.each(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'])(
    '%s drops on mastery_write',
    (rule) => {
      const r = evaluateGate(baseInput({ trialAnomalies: [a(rule)] }));
      expect(r.decision).toBe('drop');
      expect(r.rule_ids).toEqual([rule]);
      expect(r.would_change).toBe(true);
    },
  );

  it('S10 annotates on mastery_write', () => {
    const r = evaluateGate(baseInput({ trialAnomalies: [a('S10')] }));
    expect(r.decision).toBe('annotate');
  });

  it('C1 delays on mastery_write', () => {
    const r = evaluateGate(baseInput({ trialAnomalies: [a('C1')] }));
    expect(r.decision).toBe('delay');
  });

  it('C4 (exposure judged) drops', () => {
    const r = evaluateGate(baseInput({ trialAnomalies: [a('C4')] }));
    expect(r.decision).toBe('drop');
  });

  it('D4 (logger gap) drops via session anomaly', () => {
    const r = evaluateGate(
      baseInput({ sessionAnomalies: [a('D4', 'session')] }),
    );
    expect(r.decision).toBe('drop');
  });

  it.each(['D5', 'D6'])('%s annotates', (rule) => {
    const r = evaluateGate(
      baseInput({ sessionAnomalies: [a(rule, 'session')] }),
    );
    expect(r.decision).toBe('annotate');
  });
});

describe('evaluateGate — surface-aware behavior (C3)', () => {
  it('C3 annotates on mastery_write but drops on scaffold_withdraw', () => {
    const masteryR = evaluateGate(
      baseInput({ surface: 'mastery_write', trialAnomalies: [a('C3')] }),
    );
    expect(masteryR.decision).toBe('annotate');

    const scaffoldR = evaluateGate(
      baseInput({ surface: 'scaffold_withdraw', trialAnomalies: [a('C3')] }),
    );
    expect(scaffoldR.decision).toBe('drop');
  });
});

describe('evaluateGate — level_up surface', () => {
  it('D1 drops level_up (next-session semantics)', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'level_up',
        sessionAnomalies: [a('D1', 'session')],
      }),
    );
    expect(r.decision).toBe('drop');
    expect(r.rule_ids).toEqual(['D1']);
  });

  it('D2 drops level_up', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'level_up',
        sessionAnomalies: [a('D2', 'session')],
      }),
    );
    expect(r.decision).toBe('drop');
  });

  it('D7 delays level_up', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'level_up',
        sessionAnomalies: [a('D7', 'session')],
      }),
    );
    expect(r.decision).toBe('delay');
  });

  it('D3 does not affect level_up (scaffold-only)', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'level_up',
        sessionAnomalies: [a('D3', 'session')],
      }),
    );
    expect(r.decision).toBe('pass');
  });
});

describe('evaluateGate — scaffold_withdraw surface', () => {
  it.each(['D2', 'D3', 'D8', 'D9'])('%s drops scaffold_withdraw', (rule) => {
    const r = evaluateGate(
      baseInput({
        surface: 'scaffold_withdraw',
        sessionAnomalies: [a(rule, 'session')],
        windowAnomalies: [a(rule, 'user_slug_window')],
      }),
    );
    expect(r.decision).toBe('drop');
  });

  it('D1 alone does NOT drop scaffold_withdraw (only level_up)', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'scaffold_withdraw',
        sessionAnomalies: [a('D1', 'session')],
      }),
    );
    expect(r.decision).toBe('pass');
  });
});

describe('evaluateGate — strictest-wins ordering', () => {
  it('drop beats delay beats annotate beats pass', () => {
    // S10 (annotate) + C1 (delay) + S1 (drop) → drop
    const r = evaluateGate(
      baseInput({ trialAnomalies: [a('S10'), a('C1'), a('S1')] }),
    );
    expect(r.decision).toBe('drop');
    expect(r.rule_ids).toEqual(['S1']);
    expect(r.reasons).toEqual(['schema_invariant']);
  });

  it('delay beats annotate', () => {
    const r = evaluateGate(
      baseInput({ trialAnomalies: [a('S10'), a('C1')] }),
    );
    expect(r.decision).toBe('delay');
    expect(r.rule_ids).toEqual(['C1']);
  });

  it('annotate beats pass', () => {
    const r = evaluateGate(baseInput({ trialAnomalies: [a('S10')] }));
    expect(r.decision).toBe('annotate');
  });
});

describe('evaluateGate — tie-break determinism', () => {
  it('multiple drops are returned sorted lexicographically', () => {
    const r = evaluateGate(
      baseInput({ trialAnomalies: [a('S5'), a('S1'), a('S3')] }),
    );
    expect(r.decision).toBe('drop');
    expect(r.rule_ids).toEqual(['S1', 'S3', 'S5']);
  });

  it('duplicate rule_ids are de-duplicated', () => {
    const r = evaluateGate(
      baseInput({
        trialAnomalies: [a('S1'), a('S1')],
        sessionAnomalies: [a('S1', 'session')],
      }),
    );
    expect(r.rule_ids).toEqual(['S1']);
  });

  it('lower-tier hits are excluded from rule_ids but still appear in inputs_snapshot', () => {
    const r = evaluateGate(
      baseInput({ trialAnomalies: [a('S1'), a('S10'), a('C1')] }),
    );
    expect(r.decision).toBe('drop');
    expect(r.rule_ids).toEqual(['S1']);
    expect(r.inputs_snapshot.trial_anomaly_ids).toEqual(['S1', 'S10', 'C1']);
  });
});

describe('evaluateGate — purity & determinism', () => {
  it('same input → same output across repeated calls', () => {
    const input = baseInput({
      trialAnomalies: [a('S1'), a('S10')],
      sessionAnomalies: [a('D5', 'session')],
    });
    const r1 = evaluateGate(input);
    const r2 = evaluateGate(input);
    expect(r1).toEqual(r2);
  });

  it('does not mutate its input arrays', () => {
    const trialAnoms = [a('S5'), a('S1')];
    const input = baseInput({ trialAnomalies: trialAnoms });
    const before = [...trialAnoms];
    evaluateGate(input);
    expect(trialAnoms).toEqual(before);
  });

  it('stamps checklist_version onto the decision', () => {
    const r = evaluateGate(baseInput({ checklistVersion: 'gating-spec-v0.1' }));
    expect(r.checklist_version).toBe('gating-spec-v0.1');
  });

  it('defaults checklist_version to "unset" when not provided', () => {
    const r = evaluateGate({
      surface: 'mastery_write',
      trial: { exercise_slug: ADOPTED, trial_mode: 'production' },
    });
    expect(r.checklist_version).toBe('unset');
  });
});

describe('evaluateGate — inputs_snapshot integrity', () => {
  it('captures slug, mode, and anomaly ids per bucket', () => {
    const r = evaluateGate(
      baseInput({
        trial: { exercise_slug: ADOPTED, trial_mode: 'recognition' },
        trialAnomalies: [a('C4')],
        sessionAnomalies: [a('D5', 'session')],
        windowAnomalies: [a('D8', 'user_slug_window')],
        recentCleanTrials: 7,
      }),
    );
    expect(r.inputs_snapshot.exercise_slug).toBe(ADOPTED);
    expect(r.inputs_snapshot.trial_mode).toBe('recognition');
    expect(r.inputs_snapshot.trial_anomaly_ids).toEqual(['C4']);
    expect(r.inputs_snapshot.session_anomaly_ids).toEqual(['D5']);
    expect(r.inputs_snapshot.window_anomaly_ids).toEqual(['D8']);
    expect(r.inputs_snapshot.recent_clean_trials).toBe(7);
  });
});

describe('evaluateGate — visible_progress surface (no policy in v0.1)', () => {
  it('passes regardless of anomaly set (no rule routes to visible_progress yet)', () => {
    const r = evaluateGate(
      baseInput({
        surface: 'visible_progress',
        trialAnomalies: [a('S1'), a('C1')],
        sessionAnomalies: [a('D1', 'session'), a('D4', 'session')],
        windowAnomalies: [a('D8', 'user_slug_window')],
      }),
    );
    expect(r.decision).toBe('pass');
    expect(r.would_change).toBe(false);
  });
});
