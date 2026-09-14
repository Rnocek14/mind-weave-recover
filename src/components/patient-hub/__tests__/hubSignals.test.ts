/**
 * Three ways the clinician's Patient Hub could not say what it claimed.
 *
 *  - Six cards and tabs were keyed by the VIEWER's auth id, not the patient's.
 *    Invisible in self-view (the ids coincide); wrong the moment a clinician
 *    opens a patient.
 *  - Triage counted flags by a `severity` the flag type never carried, so
 *    "No flags" was reported over a fortnight of silence.
 *  - The status card read learning_rates.accuracy_slope (a fraction per day)
 *    as percentage points per week, so its −5 / −10 thresholds never fired.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeRecoveryFlags, type SnapshotDay } from '@/hooks/useWeeklyRecoverySnapshot';
import { slopePerDayToPctPerWeek } from '@/lib/learningRateUnits';

function day(date: string, over: Partial<SnapshotDay> = {}): SnapshotDay {
  return {
    date,
    hasAnySignal: true,
    totalMinutes: 10,
    fatigueRating: null,
    ...over,
  } as SnapshotDay;
}

describe('Patient Hub signals', () => {
  it('every card and tab is keyed by the patient, never by the viewer', () => {
    const src = readFileSync('src/pages/PatientHub.tsx', 'utf8');
    expect(src.match(/userId=\{user\?\.id/g) ?? []).toHaveLength(0);
    expect((src.match(/userId=\{patientUserId\}/g) ?? []).length).toBeGreaterThanOrEqual(7);
  });

  it('a week of silence is a red flag; a shorter gap is amber', () => {
    const active = Array.from({ length: 7 }, (_, i) => day(`2026-09-0${i + 1}`));
    const quiet = (n: number) =>
      Array.from({ length: n }, (_, i) => day(`2026-09-1${i}`, { hasAnySignal: false, totalMinutes: 0 }));
    expect(computeRecoveryFlags([...active, ...quiet(3)]).map((f) => [f.type, f.severity])).toEqual([['no_signal', 'orange']]);
    expect(computeRecoveryFlags([...active, ...quiet(7)]).map((f) => [f.type, f.severity])).toEqual([['no_signal', 'red']]);
    expect(computeRecoveryFlags([...active, ...quiet(2)])).toEqual([]);
  });

  it('high fatigue with a falling dose is an amber flag', () => {
    const prior = Array.from({ length: 7 }, (_, i) => day(`2026-09-0${i + 1}`, { totalMinutes: 20 }));
    const recent = Array.from({ length: 7 }, (_, i) =>
      day(`2026-09-1${i}`, { totalMinutes: 5, fatigueRating: i < 3 ? 5 : 2 }),
    );
    const flags = computeRecoveryFlags([...prior, ...recent]);
    expect(flags.find((f) => f.type === 'fatigue_spike')?.severity).toBe('orange');
  });

  it('a slope of −0.02 accuracy per day is −14 points a week, not −0%', () => {
    expect(slopePerDayToPctPerWeek(-0.02)).toBeCloseTo(-14, 6);
    expect(slopePerDayToPctPerWeek(0)).toBe(0);
    expect(slopePerDayToPctPerWeek(null)).toBeNull();
    expect(slopePerDayToPctPerWeek(Number.NaN)).toBeNull();
  });
});
