// Regression tests for the telemetry anomaly detector.
// Source of truth: docs/telemetry-validation-checklist.md (v0.1)
// Each rule has at least one POSITIVE (should fire) and one NEGATIVE (should not fire) fixture.
//
// Run with: lovable-exec test or deno test (via supabase--test_edge_functions).

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { evalTrial, evalSession, type TrialRow } from './evaluator.ts';

const RUN_ID = '00000000-0000-0000-0000-000000000001';

function trial(overrides: Partial<TrialRow> = {}): TrialRow {
  return {
    id: 't1',
    session_id: 's1',
    user_id: 'u1',
    exercise_slug: 'photo_naming',
    correct: true,
    response_text: 'cat',
    trial_mode: 'production',
    graded_score: null,
    score_vector: null,
    signal_granularity: 'boolean',
    scaffold_level: 0,
    dominant_axis: 'recognition-to-production',
    archetype: 'content-expanding',
    outputs: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const fired = (rules: ReturnType<typeof evalTrial>, id: string) => rules.some((r) => r.rule_id === id);

// ---------- TRIAL-SCOPE RULES ----------

Deno.test('S6 fires when boolean granularity carries graded_score', () => {
  const a = evalTrial(trial({ signal_granularity: 'boolean', graded_score: 0.5 }), RUN_ID);
  assert(fired(a, 'S6'));
});
Deno.test('S6 does not fire on clean boolean trial', () => {
  const a = evalTrial(trial(), RUN_ID);
  assert(!fired(a, 'S6'));
});

Deno.test('S7 fires when graded granularity has null graded_score', () => {
  const a = evalTrial(trial({ signal_granularity: 'graded', graded_score: null, archetype: 'open-ended' }), RUN_ID);
  assert(fired(a, 'S7'));
});
Deno.test('S7 does not fire when graded_score present', () => {
  const a = evalTrial(trial({ signal_granularity: 'graded', graded_score: 0.7, archetype: 'open-ended', dominant_axis: 'mixed' }), RUN_ID);
  assert(!fired(a, 'S7'));
});

Deno.test('S8 fires when multi-dimensional has null score_vector', () => {
  const a = evalTrial(trial({ signal_granularity: 'multi-dimensional', score_vector: null, archetype: 'open-ended', dominant_axis: 'mixed' }), RUN_ID);
  assert(fired(a, 'S8'));
});
Deno.test('S8 does not fire with valid score_vector object', () => {
  const a = evalTrial(trial({ signal_granularity: 'multi-dimensional', score_vector: { lexical: 0.8, syntactic: 0.6 }, archetype: 'open-ended', dominant_axis: 'mixed' }), RUN_ID);
  assert(!fired(a, 'S8'));
});

Deno.test('S10 fires when granular fields set without archetype', () => {
  const a = evalTrial(trial({ archetype: null }), RUN_ID);
  assert(fired(a, 'S10'));
});
Deno.test('S10 does not fire on legacy null-only row', () => {
  const a = evalTrial(trial({ trial_mode: null, signal_granularity: null, scaffold_level: null, archetype: null, dominant_axis: null, graded_score: null, score_vector: null }), RUN_ID);
  assert(!fired(a, 'S10'));
});

Deno.test('C1 fires on production+correct with empty response_text', () => {
  const a = evalTrial(trial({ trial_mode: 'production', correct: true, response_text: '' }), RUN_ID);
  assert(fired(a, 'C1'));
});
Deno.test('C1 does not fire on production+correct with response_text', () => {
  const a = evalTrial(trial({ trial_mode: 'production', correct: true, response_text: 'cat' }), RUN_ID);
  assert(!fired(a, 'C1'));
});
Deno.test('C1 does not fire on recognition with empty response_text', () => {
  const a = evalTrial(trial({ trial_mode: 'recognition', correct: true, response_text: '' }), RUN_ID);
  assert(!fired(a, 'C1'));
});

Deno.test('C3 fires on scaffolded with no scaffold signal', () => {
  const a = evalTrial(trial({ trial_mode: 'scaffolded', scaffold_level: 0, outputs: {} }), RUN_ID);
  assert(fired(a, 'C3'));
});
Deno.test('C3 does not fire when scaffold_level > 0', () => {
  const a = evalTrial(trial({ trial_mode: 'scaffolded', scaffold_level: 1 }), RUN_ID);
  assert(!fired(a, 'C3'));
});
Deno.test('C3 does not fire when caregiver_rated flag set', () => {
  const a = evalTrial(trial({ trial_mode: 'scaffolded', scaffold_level: 0, outputs: { caregiver_rated: true } }), RUN_ID);
  assert(!fired(a, 'C3'));
});

Deno.test('C4 fires on exposure trial carrying correct flag', () => {
  const a = evalTrial(trial({ trial_mode: 'exposure', correct: true }), RUN_ID);
  assert(fired(a, 'C4'));
});
Deno.test('C4 does not fire on exposure trial with correct=null', () => {
  const a = evalTrial(trial({ trial_mode: 'exposure', correct: null }), RUN_ID);
  assert(!fired(a, 'C4'));
});

Deno.test('C6 fires on content-expanding with disallowed axis', () => {
  const a = evalTrial(trial({ archetype: 'content-expanding', dominant_axis: 'pressure-retention' }), RUN_ID);
  assert(fired(a, 'C6'));
});
Deno.test('C6 does not fire on content-expanding with allowed axis', () => {
  const a = evalTrial(trial({ archetype: 'content-expanding', dominant_axis: 'recognition-to-production' }), RUN_ID);
  assert(!fired(a, 'C6'));
});

Deno.test('C7 fires on performance-pressure with non-pressure axis', () => {
  const a = evalTrial(trial({ archetype: 'performance-pressure', dominant_axis: 'content-complexity', signal_granularity: 'boolean' }), RUN_ID);
  assert(fired(a, 'C7'));
});
Deno.test('C7 does not fire on performance-pressure with pressure-retention axis', () => {
  const a = evalTrial(trial({ archetype: 'performance-pressure', dominant_axis: 'pressure-retention' }), RUN_ID);
  assert(!fired(a, 'C7'));
});

Deno.test('C8 fires on open-ended archetype with boolean granularity', () => {
  const a = evalTrial(trial({ archetype: 'open-ended', dominant_axis: 'mixed', signal_granularity: 'boolean' }), RUN_ID);
  assert(fired(a, 'C8'));
});
Deno.test('C8 does not fire on open-ended with graded granularity', () => {
  const a = evalTrial(trial({ archetype: 'open-ended', dominant_axis: 'mixed', signal_granularity: 'graded', graded_score: 0.5 }), RUN_ID);
  assert(!fired(a, 'C8'));
});

// ---------- SESSION-SCOPE RULES (photo_naming only) ----------

function makeSession(modes: Array<{ mode: string | null; correct?: boolean | null; n: number }>): TrialRow[] {
  const out: TrialRow[] = [];
  let i = 0;
  for (const g of modes) {
    for (let k = 0; k < g.n; k++) {
      out.push(trial({ id: `t${i++}`, trial_mode: g.mode, correct: g.correct ?? false }));
    }
  }
  return out;
}

Deno.test('D1 fires when production share < 30%', () => {
  const trials = makeSession([{ mode: 'production', n: 2 }, { mode: 'recognition', n: 8 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(a.some((r) => r.rule_id === 'D1'));
});
Deno.test('D1 does not fire at 30% production share', () => {
  const trials = makeSession([{ mode: 'production', n: 3 }, { mode: 'recognition', n: 7 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(!a.some((r) => r.rule_id === 'D1'));
});

Deno.test('D2 fires when recognition share > 60%', () => {
  const trials = makeSession([{ mode: 'recognition', n: 7 }, { mode: 'production', n: 3 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(a.some((r) => r.rule_id === 'D2'));
});
Deno.test('D2 does not fire at exactly 60% recognition', () => {
  const trials = makeSession([{ mode: 'recognition', n: 6 }, { mode: 'production', n: 4 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(!a.some((r) => r.rule_id === 'D2'));
});

Deno.test('D3 fires when scaffolded share > 40%', () => {
  const trials = makeSession([{ mode: 'scaffolded', n: 5 }, { mode: 'production', n: 5 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(a.some((r) => r.rule_id === 'D3'));
});
Deno.test('D3 does not fire at 40% scaffolded', () => {
  const trials = makeSession([{ mode: 'scaffolded', n: 4 }, { mode: 'production', n: 6 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(!a.some((r) => r.rule_id === 'D3'));
});

Deno.test('D4 fires when any trial has untyped trial_mode in adopted slug', () => {
  const trials = makeSession([{ mode: null, n: 1 }, { mode: 'production', n: 9 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(a.some((r) => r.rule_id === 'D4'));
});
Deno.test('D4 does not fire on non-adopted slug (e.g. narrative_retell)', () => {
  const trials = makeSession([{ mode: null, n: 5 }]);
  const a = evalSession('narrative_retell', 's1', 'u1', trials, RUN_ID);
  assertEquals(a.length, 0);
});

Deno.test('D7 fires on 100% production accuracy over 10+ trials', () => {
  const trials = makeSession([{ mode: 'production', correct: true, n: 12 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(a.some((r) => r.rule_id === 'D7'));
});
Deno.test('D7 does not fire under 10 production trials', () => {
  const trials = makeSession([{ mode: 'production', correct: true, n: 9 }]);
  const a = evalSession('photo_naming', 's1', 'u1', trials, RUN_ID);
  assert(!a.some((r) => r.rule_id === 'D7'));
});

// ---------- META ----------

Deno.test('Adopted-slug gating: distributional rules skip narrative_retell entirely', () => {
  const trials = makeSession([{ mode: 'recognition', n: 100 }]);
  const a = evalSession('narrative_retell', 's1', 'u1', trials, RUN_ID);
  assertEquals(a.length, 0);
});

Deno.test('Idempotency contract: scope_ref_hash stable for same (rule, trial)', () => {
  const t = trial({ trial_mode: 'production', correct: true, response_text: '' });
  const a1 = evalTrial(t, RUN_ID);
  const a2 = evalTrial(t, 'different-run-id');
  const c1 = a1.find((r) => r.rule_id === 'C1');
  const c2 = a2.find((r) => r.rule_id === 'C1');
  assertEquals(c1?.scope_ref_hash, c2?.scope_ref_hash);
});

Deno.test('Severity propagation: detector tags rule severity from registry', () => {
  const a = evalTrial(trial({ archetype: null }), RUN_ID);
  const s10 = a.find((r) => r.rule_id === 'S10');
  assertEquals(s10?.severity, 'warn');
  const a2 = evalSession('photo_naming', 's1', 'u1', makeSession([{ mode: null, n: 1 }, { mode: 'production', n: 9 }]), RUN_ID);
  const d4 = a2.find((r) => r.rule_id === 'D4');
  assertEquals(d4?.severity, 'error');
});

Deno.test('Checklist version is stamped on every anomaly', () => {
  const a = evalTrial(trial({ trial_mode: 'production', correct: true, response_text: '' }), RUN_ID);
  for (const r of a) assertEquals(r.checklist_version, '0.1');
});
