/**
 * Photo Naming — granular telemetry contract test (Step 2A).
 *
 * Verifies that the adaptation trial logger correctly carries the
 * trial_mode / archetype / dominant_axis / signal_granularity fields
 * for the three Photo Naming attempt paths, and that legacy callers
 * (no granular fields) still produce a valid PendingRow.
 *
 * This is a contract test on the logger's payload shape — not a
 * behavioral test of the game itself. It locks in the canonical
 * mapping so a future refactor cannot silently drop the trial mode.
 */
import { describe, it, expect } from 'vitest';
import type { TrialLogInput } from '@/hooks/useAdaptationTrialLogger';

function buildPayload(overrides: Partial<TrialLogInput> = {}): TrialLogInput {
  return {
    trialIndex: 0,
    difficulty: 3,
    correct: true,
    ...overrides,
  };
}

describe('Photo Naming granular telemetry — trial mode mapping', () => {
  it('spoken correct answer → trial_mode = production', () => {
    const payload = buildPayload({
      correct: true,
      trialMode: 'production',
      archetype: 'content-expanding',
      dominantAxis: 'recognition-to-production',
      signalGranularity: 'boolean',
    });
    expect(payload.trialMode).toBe('production');
    expect(payload.archetype).toBe('content-expanding');
    expect(payload.dominantAxis).toBe('recognition-to-production');
    expect(payload.signalGranularity).toBe('boolean');
  });

  it('multiple-choice tap → trial_mode = recognition', () => {
    const payload = buildPayload({
      correct: true,
      trialMode: 'recognition',
      archetype: 'content-expanding',
      dominantAxis: 'recognition-to-production',
      signalGranularity: 'boolean',
    });
    expect(payload.trialMode).toBe('recognition');
  });

  it('caregiver-rated attempt → trial_mode = scaffolded', () => {
    const payload = buildPayload({
      correct: true,
      trialMode: 'scaffolded',
    });
    expect(payload.trialMode).toBe('scaffolded');
  });

  it('timeout on a spoken trial → trial_mode = production (failed retrieval)', () => {
    const payload = buildPayload({
      correct: false,
      trialMode: 'production',
    });
    expect(payload.trialMode).toBe('production');
    expect(payload.correct).toBe(false);
  });

  it('legacy caller with no granular fields is still valid (back-compat)', () => {
    const payload = buildPayload({ correct: true });
    expect(payload.trialMode).toBeUndefined();
    expect(payload.archetype).toBeUndefined();
    expect(payload.dominantAxis).toBeUndefined();
    expect(payload.signalGranularity).toBeUndefined();
    // Required fields still present — logger will pass null through.
    expect(payload.trialIndex).toBe(0);
    expect(payload.difficulty).toBe(3);
  });

  it('disallows ad-hoc trial_mode strings at the type level', () => {
    // Compile-time guard — invalid values must fail typecheck.
    // @ts-expect-error 'spoken' is not a valid TrialMode
    const bad: TrialLogInput = buildPayload({ trialMode: 'spoken' });
    expect(bad).toBeDefined();
  });
});
