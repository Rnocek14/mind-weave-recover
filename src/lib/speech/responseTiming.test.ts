import { describe, expect, it } from 'vitest';
import {
  averageResponseTimeMs, makeResponseTiming, measuredResponseTimeMs,
  parseResponseTiming, readUtteranceResponseTimeMs,
} from './responseTiming';

const timing = (elapsedMs: unknown) => ({
  version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs,
});

describe('accepted-answer measurement provenance', () => {
  it('retains the captured interval and a real zero with its definition', () => {
    expect(makeResponseTiming(2400)).toEqual(timing(2400));
    expect(readUtteranceResponseTimeMs({ responseTiming: timing(0) })).toBe(0);
  });

  it.each([undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY, '2400', false])(
    'does not coerce unavailable or invalid milliseconds: %j', value => {
      expect(measuredResponseTimeMs(value)).toBeNull();
      expect(makeResponseTiming(value)).toBeNull();
      expect(readUtteranceResponseTimeMs({ responseTiming: timing(value) })).toBeNull();
    },
  );

  it.each([
    { elapsedMs: 2400 },
    { ...timing(2400), version: 2 },
    { ...timing(2400), version: '1' },
    { ...timing(2400), basis: 'analysis_completion' },
    [timing(2400)],
  ])('rejects a duration without the exact supported timing definition: %j', value => {
    expect(parseResponseTiming(value)).toBeNull();
    expect(readUtteranceResponseTimeMs({ responseTiming: value })).toBeNull();
  });

  it('does not infer patient response time from historical diagnostic or recording values', () => {
    expect(readUtteranceResponseTimeMs({
      latency_ms: 20_000, recording_duration_ms: 3000, latencyToFirstWordMs: 800,
      pronunciationTimingsMs: { total: 17_000 },
    })).toBeNull();
  });

  it('averages only observed values and retains the zero observation', () => {
    expect(averageResponseTimeMs([0, 4000, null, undefined, Number.NaN, -1])).toBe(2000);
    expect(averageResponseTimeMs([null, undefined, Number.NaN])).toBeNull();
    expect(averageResponseTimeMs([])).toBeNull();
  });

  it('does not round before existing consumers apply their own decision boundary', () => {
    expect(averageResponseTimeMs([3000, 3001])).toBe(3000.5);
  });
});
