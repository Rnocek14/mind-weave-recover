/**
 * readMasteryGate — Leak 4 fix rule tests.
 *
 * Pins the verdict rule in isolation so the gate cannot regress
 * silently. Tests the pure `evaluateGateRule` function — supabase
 * I/O is exercised by integration paths, not here.
 *
 * Locked rule (see readMasteryGate.ts header):
 *   pass  ↔ ≥1 skill at medium-or-high AND no skill stuck-low-with-volume
 *   block ↔ at least one skill has signal AND pass conditions not met
 *   skip  ↔ every skill at confidence:'none' (no opinion yet)
 *
 * "Stuck low with volume" = confidence:'low' AND trials_total ≥ 12
 * (mirrors computeMastery's medium threshold — a skill that has had its
 *  chance and still hasn't earned medium is a real weakness signal).
 */
import { describe, it, expect } from 'vitest';
import { evaluateGateRule, STUCK_LOW_TRIAL_FLOOR } from '../readMasteryGate';

describe('evaluateGateRule — Leak 4 locked rule', () => {
  it('case 1: all skills medium → pass', () => {
    expect(
      evaluateGateRule([
        { confidence: 'medium', trialsTotal: 20 },
        { confidence: 'medium', trialsTotal: 30 },
      ]),
    ).toBe('pass');
  });

  it('case 2: one medium, one stuck low (≥12 trials) → block', () => {
    expect(
      evaluateGateRule([
        { confidence: 'medium', trialsTotal: 20 },
        { confidence: 'low', trialsTotal: STUCK_LOW_TRIAL_FLOOR },
      ]),
    ).toBe('block');
  });

  it('case 3: one medium, one low but still ramping (<12 trials) → pass', () => {
    expect(
      evaluateGateRule([
        { confidence: 'medium', trialsTotal: 20 },
        { confidence: 'low', trialsTotal: STUCK_LOW_TRIAL_FLOOR - 1 },
      ]),
    ).toBe('pass');
  });

  it('case 4: every skill still ramping (none/low, no volume) → skip', () => {
    // No skill has any signal — gate refuses to render a verdict.
    expect(
      evaluateGateRule([
        { confidence: 'none', trialsTotal: 0 },
        { confidence: 'none', trialsTotal: 3 },
      ]),
    ).toBe('skip');
  });

  it('case 5: one medium, one none (insufficient volume) → pass', () => {
    // Realistic first-session shape on a multi-skill game where the
    // user happened to hit only high-frequency items. Obvious-but-wrong
    // implementation would treat the 'none' skill as blocking; the rule
    // correctly ignores it (no signal = no opinion = no block).
    expect(
      evaluateGateRule([
        { confidence: 'medium', trialsTotal: 15 },
        { confidence: 'none', trialsTotal: 0 },
      ]),
    ).toBe('pass');
  });

  // Additional boundary coverage — not in the user's 5 but worth pinning.

  it('boundary: low at exactly the floor counts as stuck-low', () => {
    expect(
      evaluateGateRule([
        { confidence: 'low', trialsTotal: STUCK_LOW_TRIAL_FLOOR },
      ]),
    ).toBe('block');
  });

  it('boundary: high beats stuck-low? no — stuck-low always blocks', () => {
    // A weak skill with volume is a real signal even if another skill
    // is strong. This is the MIN-across-skills spirit preserved under
    // the new rule.
    expect(
      evaluateGateRule([
        { confidence: 'high', trialsTotal: 50 },
        { confidence: 'low', trialsTotal: STUCK_LOW_TRIAL_FLOOR + 5 },
      ]),
    ).toBe('block');
  });

  it('boundary: signal exists but no medium-or-high yet → block', () => {
    // A skill at 'low' with <12 trials = signal exists (not skip), but
    // nothing has reached medium → block until either it does or the
    // weak skill earns its medium.
    expect(
      evaluateGateRule([
        { confidence: 'low', trialsTotal: 6 },
      ]),
    ).toBe('block');
  });

  it('empty skill list → skip (no game-trains-this-skill data)', () => {
    expect(evaluateGateRule([])).toBe('skip');
  });
});
