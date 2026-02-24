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
 * Physical layer (objective device signals):
 *   steps, workoutMinutesObjective, activeMinutesObjective, sleepMinutes
 *   Source precedence: device sources (healthkit/googlefit/health_connect) win
 *   over 'manual'. Among device sources, latest last_sync_at wins.
 *
 * Domain routing (Option A – documented intent):
 *   'speech'   → speechMinutes bucket
 *   'activity' → activityMinutes bucket
 *   everything else (pt, ot, cognitive, unknown future domains) → therapyMinutes bucket
 *
 * Range guard:
 *   All input rows whose date falls outside the [startDate, startDate+days-1]
 *   window are explicitly skipped.
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

export interface PhysicalRow {
  metric_date: string;
  steps: number | null;
  active_minutes: number | null;
  workout_minutes: number | null;
  sleep_minutes: number | null;
  source: string;
  last_sync_at: string | null;
}

export interface PhysicalMeta {
  coverageDays: number;
  sourcesSeen: string[];
  lastSyncAtMax: string | null;
}

interface BuildTimelineInput {
  startDate: Date;
  days: number;
  readinessRows: ReadinessRow[];
  doseRows: DoseRow[];
  physicalRows?: PhysicalRow[];
}

export interface BuildTimelineResult {
  timeline: SnapshotDay[];
  physicalMeta: PhysicalMeta;
}

const DEVICE_SOURCES = new Set(["healthkit", "googlefit", "health_connect"]);

/**
 * Pick the best physical row for a given date.
 * Device sources win over manual; among ties, latest last_sync_at wins.
 */
function pickBestPhysicalRow(rows: PhysicalRow[]): PhysicalRow {
  if (rows.length === 1) return rows[0];
  return rows.sort((a, b) => {
    const aDevice = DEVICE_SOURCES.has(a.source) ? 1 : 0;
    const bDevice = DEVICE_SOURCES.has(b.source) ? 1 : 0;
    if (aDevice !== bDevice) return bDevice - aDevice; // device first
    // Among same tier, latest sync wins
    const aSync = a.last_sync_at || "";
    const bSync = b.last_sync_at || "";
    return bSync.localeCompare(aSync);
  })[0];
}

export function buildSnapshotTimeline({
  startDate,
  days,
  readinessRows,
  doseRows,
  physicalRows = [],
}: BuildTimelineInput): BuildTimelineResult {
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
      therapyMap.set(d.log_date, (therapyMap.get(d.log_date) || 0) + val);
    }
  }

  // Group physical rows by date (skip out-of-range), pick best per day
  const physicalByDate = new Map<string, PhysicalRow[]>();
  const allSourcesSeen = new Set<string>();
  let maxSyncAt: string | null = null;

  for (const p of physicalRows) {
    if (!validDates.has(p.metric_date)) continue;
    allSourcesSeen.add(p.source);
    if (p.last_sync_at && (!maxSyncAt || p.last_sync_at > maxSyncAt)) {
      maxSyncAt = p.last_sync_at;
    }
    const arr = physicalByDate.get(p.metric_date) || [];
    arr.push(p);
    physicalByDate.set(p.metric_date, arr);
  }

  const bestPhysical = new Map<string, PhysicalRow>();
  for (const [date, rows] of physicalByDate) {
    bestPhysical.set(date, pickBestPhysicalRow(rows));
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
    const phys = bestPhysical.get(d);
    result.push({
      date: d,
      speechMinutes: speech,
      therapyMinutes: therapy,
      activityMinutes: activity,
      totalMinutes: speech + therapy + activity,
      fatigueRating: fatigue,
      hasAnySignal: speech > 0 || therapy > 0 || activity > 0 || fatigue !== null,
      // Physical layer (nullable)
      steps: phys?.steps ?? null,
      workoutMinutesObjective: phys?.workout_minutes ?? null,
      activeMinutesObjective: phys?.active_minutes ?? null,
      sleepMinutes: phys?.sleep_minutes ?? null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const physicalMeta: PhysicalMeta = {
    coverageDays: bestPhysical.size,
    sourcesSeen: Array.from(allSourcesSeen),
    lastSyncAtMax: maxSyncAt,
  };

  return { timeline: result, physicalMeta };
}
