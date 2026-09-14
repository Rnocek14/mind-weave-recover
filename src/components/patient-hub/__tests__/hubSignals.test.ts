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
import { slopePerDayToPctPerWeek, learningRateSlopeIfTrustworthy } from '@/lib/learningRateUnits';

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

describe('learning-rate slope units stay consistent per consumer', () => {
  // useWeeklySessionStats feeds two families of consumer: the glance cards,
  // which read percentage points per week, and the alert detector / progress
  // note / next actions, whose ±0.01 and > 0.5 thresholds are calibrated to
  // the stored fraction-per-day. Converting inside the hook silently broke the
  // second family (a flat 0.001/day read as +0.7 %/wk → "trajectory positive",
  // "+1400.0%/day"). Each family now gets its own field.
  it('the hook exposes the stored unit as accuracySlope and the converted one separately', () => {
    const src = readFileSync('src/hooks/useWeeklySessionStats.ts', 'utf8');
    expect(src).toMatch(/accuracySlopePctPerWeek: slopePerDayToPctPerWeek\(/);
    expect(src).not.toMatch(/accuracySlope: slopePerDayToPctPerWeek\(/);
  });

  it('the glance cards get the per-week field; the alert detector and progress note keep the stored unit', () => {
    const hub = readFileSync('src/pages/PatientHub.tsx', 'utf8');
    const statusCard = hub.slice(hub.indexOf('<ClinicianStatusCard'), hub.indexOf('/>', hub.indexOf('<ClinicianStatusCard')));
    const progressCard = hub.slice(hub.indexOf('<ClinicianProgressCard'), hub.indexOf('/>', hub.indexOf('<ClinicianProgressCard')));
    expect(statusCard).toMatch(/accuracySlope=\{sessionStats\.accuracySlopePctPerWeek\}/);
    expect(progressCard).toMatch(/accuracySlope=\{sessionStats\.accuracySlopePctPerWeek\}/);
    const alertStats = hub.slice(hub.indexOf('const alertSessionStats'), hub.indexOf('}, [sessionStats]);'));
    expect(alertStats).toMatch(/accuracySlope: sessionStats\.accuracySlope,/);
    const note = hub.slice(hub.indexOf('generateProgressNote({'), hub.indexOf('});', hub.indexOf('generateProgressNote({')));
    expect(note).toMatch(/accuracySlope: sessionStats\.accuracySlope,/);
  });
});

describe('learningRateSlopeIfTrustworthy — no trend on thin evidence', () => {
  // Three sessions of ten trials at a constant 75% regress to ±5 points per
  // day almost half the time. Below the evidence floor the hub shows nothing
  // rather than a confident wrong arrow.
  it('returns the slope only with ≥30 trials and ≥5 practice days', () => {
    expect(learningRateSlopeIfTrustworthy({ accuracy_slope: -0.05, trial_count: 30, active_days: 3 })).toBeNull();
    expect(learningRateSlopeIfTrustworthy({ accuracy_slope: -0.05, trial_count: 12, active_days: 6 })).toBeNull();
    expect(learningRateSlopeIfTrustworthy({ accuracy_slope: -0.02, trial_count: 40, active_days: 6 })).toBe(-0.02);
  });

  it('a row written before active_days existed is not shown as a trend', () => {
    expect(learningRateSlopeIfTrustworthy({ accuracy_slope: 0.03, trial_count: 80, active_days: null })).toBeNull();
    expect(learningRateSlopeIfTrustworthy(null)).toBeNull();
    expect(learningRateSlopeIfTrustworthy({ accuracy_slope: null, trial_count: 80, active_days: 10 })).toBeNull();
  });

  it('the hook names the row it reads: speech domain, 14-day window', () => {
    const src = readFileSync('src/hooks/useWeeklySessionStats.ts', 'utf8');
    expect(src).toMatch(/\.eq\("domain", LEARNING_RATE_DOMAIN\)/);
    expect(src).toMatch(/\.eq\("time_window_days", LEARNING_RATE_WINDOW_DAYS\)/);
    expect(src).toMatch(/learningRateSlopeIfTrustworthy\(/);
  });
});
