import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

const DOSE_THRESHOLD_MINUTES = 10;
const FATIGUE_STABLE_MAX = 3;

const WEIGHTS = {
  activity: 0.4,
  dose: 0.3,
  readiness: 0.2,
  fatigue: 0.1,
} as const;

export interface EngagementBreakdown {
  activeDays: number;
  doseDays: number;
  readinessDays: number;
  fatigueStableDays: number;
  fatigueDaysRecorded: number;
  daysTotal: number;
}

export type EngagementBand = "Low" | "Moderate" | "Strong";

export interface EngagementResult {
  score: number; // 0–100
  band: EngagementBand;
  breakdown: EngagementBreakdown;
}

function toBand(score: number): EngagementBand {
  if (score < 40) return "Low";
  if (score < 70) return "Moderate";
  return "Strong";
}

export function computeEngagementScore(
  timeline: SnapshotDay[]
): EngagementResult {
  const daysTotal = timeline.length || 1;

  let activeDays = 0;
  let doseDays = 0;
  let readinessDays = 0;
  let fatigueStableDays = 0;
  let fatigueDaysRecorded = 0;

  for (const day of timeline) {
    if (day.hasAnySignal) activeDays++;
    if (day.totalMinutes >= DOSE_THRESHOLD_MINUTES) doseDays++;
    if (day.fatigueRating !== null) {
      readinessDays++;
      fatigueDaysRecorded++;
      if (day.fatigueRating <= FATIGUE_STABLE_MAX) fatigueStableDays++;
    }
  }

  const activityScore = activeDays / daysTotal;
  const doseScore = doseDays / daysTotal;
  const readinessScore = readinessDays / daysTotal;
  const fatigueScore =
    fatigueDaysRecorded > 0
      ? fatigueStableDays / fatigueDaysRecorded
      : 0.5; // neutral when no fatigue recorded

  const raw =
    WEIGHTS.activity * activityScore +
    WEIGHTS.dose * doseScore +
    WEIGHTS.readiness * readinessScore +
    WEIGHTS.fatigue * fatigueScore;

  const score = Math.round(Math.min(100, Math.max(0, raw * 100)));

  return {
    score,
    band: toBand(score),
    breakdown: {
      activeDays,
      doseDays,
      readinessDays,
      fatigueStableDays,
      fatigueDaysRecorded,
      daysTotal,
    },
  };
}
