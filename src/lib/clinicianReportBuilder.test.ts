import { describe, expect, it } from 'vitest';
import { format, subDays } from 'date-fns';
import { buildClinicianReport } from './clinicianReportBuilder';
import type { DailyTrend } from '@/hooks/useWeeklyTrends';

function day(daysAgo: number, attempts: number, accuracy: number): DailyTrend {
  const date = format(subDays(new Date(), daysAgo), 'yyyy-MM-dd');
  return {
    date, displayDate: 'Test',
    timeMinutes: attempts,
    totalTrials: attempts,
    correctTrials: Math.round(attempts * accuracy / 100),
    accuracy,
  };
}

describe('clinician report accuracy and trend provenance', () => {
  it('prints an actual measured 0% and never invents improvement from empty days', () => {
    const trends = [
      day(6, 0, 0),
      day(5, 0, 0),
      day(4, 0, 0),
      day(3, 40, 0),
      day(2, 0, 0),
      day(1, 0, 0),
      day(0, 0, 0),
    ];
    const report = buildClinicianReport(trends, [], null, null, [], 7);
    expect(report.sample).toMatchObject({
      trials: 40, practiceDays: 1, taskAccuracyPct: 0,
    });
    expect(report.recovery.verdict).toBe('insufficient_data');
    expect(report.recovery.accuracyChange).toBeNull();
    expect(report.confidence.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/distinct practice periods/i),
    ]));
  });

  it('does not label absent clinical evidence as 0% accuracy', () => {
    const report = buildClinicianReport([day(0, 0, 0)], [], null, null, [], 7);
    expect(report.sample).toMatchObject({ trials: 0, taskAccuracyPct: null });
    expect(report.recovery.verdict).toBe('insufficient_data');
    expect(report.recovery.accuracyChange).toBeNull();
  });

  it('compares weighted observed practice periods, excluding missing days', () => {
    const trends = [
      day(6, 10, 40),
      day(5, 0, 0),
      day(4, 0, 0),
      day(3, 0, 0),
      day(2, 0, 0),
      day(1, 10, 80),
      day(0, 10, 100),
    ];
    const report = buildClinicianReport(trends, [], null, null, [], 7);
    // Three practice days => no earlier comparison period yet, rather than
    // treating the calendar's no-practice dates as 0% results.
    expect(report.sample).toMatchObject({ trials: 30, practiceDays: 3, taskAccuracyPct: 73.3 });
    expect(report.recovery.verdict).toBe('insufficient_data');

    const four = [
      day(6, 10, 40),
      day(5, 10, 50),
      day(4, 0, 0),
      day(3, 0, 0),
      day(2, 0, 0),
      day(1, 10, 80),
      day(0, 10, 100),
    ];
    const reportFour = buildClinicianReport(four, [], null, null, [], 7);
    expect(reportFour.sample).toMatchObject({
      trials: 40, practiceDays: 4, taskAccuracyPct: 67.5,
    });
    expect(reportFour.recovery.accuracyChange).toBeCloseTo((50 + 80 + 100) / 3 - 40, 3);
    expect(reportFour.recovery.verdict).toBe('improving');
  });
});
