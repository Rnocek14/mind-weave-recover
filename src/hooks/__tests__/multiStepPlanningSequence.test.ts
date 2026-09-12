/**
 * Multi-Step Planning must actually score the ORDER of a plan.
 *
 * The sequencing score used to be computed from each key step's index in the
 * item definition, collected in ascending order — so the list was sorted by
 * construction, every pair counted as in-order, and any answer mentioning two
 * steps scored 100% order, a perfectly reversed plan included. Ordering is the
 * executive skill this exercise trains, so the score now reads where each step
 * appears in what the patient said.
 */
import { describe, it, expect } from 'vitest';
import { computeSequenceScore, isSuccessfulPlan } from '@/hooks/useMultiStepPlanningGame';

const STEPS = ['fill the kettle', 'boil water', 'pour into mug', 'add sugar'];

describe('computeSequenceScore', () => {
  it('gives full credit for a plan spoken in the right order', () => {
    expect(computeSequenceScore('First fill the kettle, then boil water, then pour into mug', STEPS)).toBe(1);
  });

  it('gives no credit for a plan spoken backwards', () => {
    expect(computeSequenceScore('pour into mug, boil water, fill the kettle', STEPS)).toBe(0);
  });

  it('gives partial credit for one step out of place', () => {
    // kettle, sugar, water: pairs (kettle,sugar) ok, (kettle,water) ok, (sugar,water) reversed
    const score = computeSequenceScore('fill the kettle, add sugar, boil water', STEPS);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('gives no order credit when fewer than two steps are recognisable', () => {
    expect(computeSequenceScore('umm', STEPS)).toBe(0);
    expect(computeSequenceScore('boil water', STEPS)).toBe(0);
  });

  it('ignores short filler words when locating a step', () => {
    // A step is located by its content words, never by a shared "the".
    const steps = ['add the salt', 'stir the pot'];
    expect(computeSequenceScore('add the salt then stir the pot', steps)).toBe(1);
    expect(computeSequenceScore('stir the pot then add the salt', steps)).toBe(0);
  });
});

describe('isSuccessfulPlan — one trial, one verdict', () => {
  it('rejects a plan that names too little of the goal', () => {
    // Previously the page logged this as a fully-credited success.
    expect(isSuccessfulPlan({ goalCoverage: 0.4, sequenceScore: 1 })).toBe(false);
  });

  it('rejects a complete plan given in the wrong order', () => {
    expect(isSuccessfulPlan({ goalCoverage: 1, sequenceScore: 0 })).toBe(false);
  });

  it('accepts a mostly-complete plan in a sensible order', () => {
    expect(isSuccessfulPlan({ goalCoverage: 0.6, sequenceScore: 0.5 })).toBe(true);
    expect(isSuccessfulPlan({ goalCoverage: 1, sequenceScore: 1 })).toBe(true);
  });
});
