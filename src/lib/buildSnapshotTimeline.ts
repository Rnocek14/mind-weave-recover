/**
 * buildSnapshotTimeline – pure function that transforms raw DB rows
 * into a contiguous SnapshotDay[] array.
 *
 * This is the SINGLE SOURCE OF TRUTH for Recovery Snapshot metrics.
 * Every chart, stat, engagement score, and alert detector consumes this output.
 *
 * Metric contract:
 *   speechMinutes  → dose_logs where domain_slug = 'speech'
 *   therapyMinutes → dose_logs where domain_slug IN ('pt','ot','cognitive', + any unknown)
 *   activityMinutes→ dose_logs where domain_slug = 'activity'
 *   fatigueRating  → daily_readiness.fatigue_rating by checkin_date
 *   hasAnySignal   → any non-zero dose OR fatigue recorded
 *
 * Domain routing (Option A – documented intent):
 *   'speech'   → speechMinutes bucket
 *   'activity' → activityMinutes bucket
 *   everything else (pt, ot, cognitive, unknown future domains) → therapyMinutes bucket
 *
 * Range guard:
 *   Readiness and dose rows whose date falls outside the [startDate, startDate+days-1]
 *   window are explicitly skipped. This makes intent clear and prevents silent breakage
 *   if date-key formats change upstream.
 */

import type { SnapshotDay } from "@/hooks/useWeeklyRecoverySnapshot";
import { localYYYYMMDD } from "@/lib/localDate";

export interface ReadinessRow {
  checkin_date: string;
  fatigue_rating: number;
}

export interface DoseRow {
  log_date: string;
  domain_slug: string;
  dose_value: number;
}

interface BuildTimelineInput {
  startDate: Date;
  days: number;
  readinessRows: ReadinessRow[];
  doseRows: DoseRow[];
}

export function buildSnapshotTimeline({
  startDate,
  days,
  readinessRows,
  doseRows,
}: BuildTimelineInput): SnapshotDay[] {
  // Pre-compute the set of valid dates for range guarding
  const validDates = new Set<string>();
  const tmp = new Date(startDate);
  for (let i = 0; i < days; i++) {
    validDates.add(localYYYYMMDD(tmp));
    tmp.setDate(tmp.getDate() + 1);
  }

  // Index readiness by date (skip out-of-range rows)
  const fatigueMap = new Map<string, number>();
  for (const r of readinessRows) {
    if (!validDates.has(r.checkin_date)) continue;
    fatigueMap.set(r.checkin_date, r.fatigue_rating);
  }

  // Aggregate dose by date + bucket (skip out-of-range rows)
  const speechMap = new Map<string, number>();
  const therapyMap = new Map<string, number>();
  const activityMap = new Map<string, number>();

  for (const d of doseRows) {
    if (!validDates.has(d.log_date)) continue;
    const val = Number(d.dose_value) || 0;
    if (d.domain_slug === "speech") {
      speechMap.set(d.log_date, (speechMap.get(d.log_date) || 0) + val);
    } else if (d.domain_slug === "activity") {
      activityMap.set(d.log_date, (activityMap.get(d.log_date) || 0) + val);
    } else {
      // therapy domains + unknown domains default to therapy bucket
      therapyMap.set(d.log_date, (therapyMap.get(d.log_date) || 0) + val);
    }
  }

  // Build contiguous timeline
  const result: SnapshotDay[] = [];
  const cursor = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const d = localYYYYMMDD(cursor);
    const speech = speechMap.get(d) || 0;
    const therapy = therapyMap.get(d) || 0;
    const activity = activityMap.get(d) || 0;
    const fatigue = fatigueMap.get(d) ?? null;
    result.push({
      date: d,
      speechMinutes: speech,
      therapyMinutes: therapy,
      activityMinutes: activity,
      totalMinutes: speech + therapy + activity,
      fatigueRating: fatigue,
      hasAnySignal: speech > 0 || therapy > 0 || activity > 0 || fatigue !== null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
