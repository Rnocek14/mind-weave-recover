/**
 * Compares current period vs prior period for key metrics.
 * Returns deltas for accuracy, trials, sessions, minutes, fatigue.
 */
import { useMemo } from "react";
import type { DayGroup } from "@/hooks/useWeeklySessionTimeline";
import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";

export interface PeriodSummary {
  activeDays: number;
  totalSessions: number;
  totalTrials: number;
  totalMinutes: number;
  avgAccuracy: number | null;
  avgFatigue: number | null;
}

export interface WeekOverWeekDelta {
  metric: string;
  label: string;
  current: number | null;
  prior: number | null;
  delta: number | null;
  unit: string;
  /** positive = good, negative = bad, neutral = neither */
  direction: "positive" | "negative" | "neutral";
  tooltip: string;
}

function computePeriodSummary(
  dayGroups: DayGroup[],
  timeline: SnapshotDay[]
): PeriodSummary {
  const activeDays = dayGroups.filter((d) => d.sessions.length > 0).length;
  const totalSessions = dayGroups.reduce((s, d) => s + d.sessions.length, 0);
  const totalTrials = dayGroups.reduce((s, d) => s + d.totalTrials, 0);
  const totalMinutes = dayGroups.reduce((s, d) => s + d.totalMinutes, 0);

  const allCorrect = dayGroups.reduce((s, d) => {
    if (d.avgAccuracy !== null) return s + Math.round((d.avgAccuracy / 100) * d.totalTrials);
    return s;
  }, 0);
  const avgAccuracy = totalTrials > 0 ? Math.round((allCorrect / totalTrials) * 100) : null;

  const rated = timeline.filter((d) => d.fatigueRating !== null);
  const avgFatigue = rated.length > 0
    ? Math.round((rated.reduce((s, d) => s + d.fatigueRating!, 0) / rated.length) * 10) / 10
    : null;

  return { activeDays, totalSessions, totalTrials, totalMinutes, avgAccuracy, avgFatigue };
}

export function useWeekOverWeek(
  currentDayGroups: DayGroup[],
  priorDayGroups: DayGroup[],
  currentTimeline: SnapshotDay[],
  priorTimeline: SnapshotDay[]
): { current: PeriodSummary; prior: PeriodSummary; deltas: WeekOverWeekDelta[] } {
  return useMemo(() => {
    const current = computePeriodSummary(currentDayGroups, currentTimeline);
    const prior = computePeriodSummary(priorDayGroups, priorTimeline);

    const delta = (c: number | null, p: number | null) =>
      c !== null && p !== null ? c - p : null;

    const deltas: WeekOverWeekDelta[] = [
      {
        metric: "activeDays",
        label: "Active Days",
        current: current.activeDays,
        prior: prior.activeDays,
        delta: delta(current.activeDays, prior.activeDays),
        unit: "d",
        direction: (current.activeDays >= (prior.activeDays || 0)) ? "positive" : "negative",
        tooltip: "Number of days with at least one recorded therapy session. More active days = better adherence to the home practice schedule.",
      },
      {
        metric: "totalSessions",
        label: "Sessions",
        current: current.totalSessions,
        prior: prior.totalSessions,
        delta: delta(current.totalSessions, prior.totalSessions),
        unit: "",
        direction: (current.totalSessions >= (prior.totalSessions || 0)) ? "positive" : "negative",
        tooltip: "Total completed practice sessions. Each session is a distinct practice period where the patient worked on exercises.",
      },
      {
        metric: "totalTrials",
        label: "Trials",
        current: current.totalTrials,
        prior: prior.totalTrials,
        delta: delta(current.totalTrials, prior.totalTrials),
        unit: "",
        direction: (current.totalTrials >= (prior.totalTrials || 0)) ? "positive" : "negative",
        tooltip: "Individual exercise attempts. Higher trial counts indicate more practice volume — a key driver of neuroplasticity-based recovery.",
      },
      {
        metric: "totalMinutes",
        label: "Practice Time",
        current: current.totalMinutes,
        prior: prior.totalMinutes,
        delta: delta(current.totalMinutes, prior.totalMinutes),
        unit: "min",
        direction: (current.totalMinutes >= (prior.totalMinutes || 0)) ? "positive" : "negative",
        tooltip: "Total minutes spent in therapy sessions. Research suggests consistent daily practice (even 15-20 min) is more effective than infrequent longer sessions.",
      },
      {
        metric: "avgAccuracy",
        label: "Accuracy",
        current: current.avgAccuracy,
        prior: prior.avgAccuracy,
        delta: delta(current.avgAccuracy, prior.avgAccuracy),
        unit: "%",
        direction:
          current.avgAccuracy !== null && prior.avgAccuracy !== null
            ? current.avgAccuracy >= prior.avgAccuracy ? "positive" : "negative"
            : "neutral",
        tooltip: "Average percentage of correct responses across all exercises. Tracks whether the patient is maintaining or improving performance. A drop may indicate exercises are too hard, fatigue, or regression.",
      },
      {
        metric: "avgFatigue",
        label: "Avg Fatigue",
        current: current.avgFatigue,
        prior: prior.avgFatigue,
        delta: delta(current.avgFatigue, prior.avgFatigue),
        unit: "/5",
        // Lower fatigue = positive
        direction:
          current.avgFatigue !== null && prior.avgFatigue !== null
            ? current.avgFatigue <= prior.avgFatigue ? "positive" : "negative"
            : "neutral",
        tooltip: "Average self-reported fatigue rating (1=low, 5=high). Sustained high fatigue (≥4) may signal over-exertion or need for session length adjustment. Fatigue inversely correlates with practice quality.",
      },
    ];

    return { current, prior, deltas };
  }, [currentDayGroups, priorDayGroups, currentTimeline, priorTimeline]);
}
