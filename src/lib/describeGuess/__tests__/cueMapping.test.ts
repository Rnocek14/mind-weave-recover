import { describe, it, expect } from 'vitest';
import { deriveCueTelemetry } from '../cueMapping';

describe('deriveCueTelemetry', () => {
  it('0 prompts → cueLevel 0, cueTypeGiven none, cueWasEffective null', () => {
    expect(deriveCueTelemetry(0, true)).toEqual({
      cueLevel: 0, cueTypeGiven: 'none', cueWasEffective: null,
    });
    expect(deriveCueTelemetry(0, false)).toEqual({
      cueLevel: 0, cueTypeGiven: 'none', cueWasEffective: null,
    });
  });

  it('1 prompt → cueLevel 1, semantic', () => {
    expect(deriveCueTelemetry(1, true).cueLevel).toBe(1);
    expect(deriveCueTelemetry(1, true).cueTypeGiven).toBe('semantic');
  });

  it('2 prompts → cueLevel 2, semantic', () => {
    expect(deriveCueTelemetry(2, false).cueLevel).toBe(2);
    expect(deriveCueTelemetry(2, false).cueTypeGiven).toBe('semantic');
  });

  it('3+ prompts → cueLevel 3', () => {
    expect(deriveCueTelemetry(3, true).cueLevel).toBe(3);
    expect(deriveCueTelemetry(5, true).cueLevel).toBe(3);
    expect(deriveCueTelemetry(99, false).cueLevel).toBe(3);
  });

  it('cued + correct → cueWasEffective true', () => {
    expect(deriveCueTelemetry(1, true).cueWasEffective).toBe(true);
    expect(deriveCueTelemetry(2, true).cueWasEffective).toBe(true);
    expect(deriveCueTelemetry(3, true).cueWasEffective).toBe(true);
  });

  it('cued + incorrect → cueWasEffective false', () => {
    expect(deriveCueTelemetry(1, false).cueWasEffective).toBe(false);
    expect(deriveCueTelemetry(2, false).cueWasEffective).toBe(false);
    expect(deriveCueTelemetry(3, false).cueWasEffective).toBe(false);
  });

  it('handles negative or fractional prompt counts defensively', () => {
    expect(deriveCueTelemetry(-1, true).cueLevel).toBe(0);
    expect(deriveCueTelemetry(1.7, true).cueLevel).toBe(1);
  });
});
