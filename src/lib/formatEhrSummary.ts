import type { SnapshotDay, RecoveryFlag } from "@/hooks/useWeeklyRecoverySnapshot";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";
import type { EngagementResult } from "@/lib/computeEngagementScore";
import { localYYYYMMDD } from "@/lib/localDate";

/**
 * Generates a clinically-structured plaintext summary suitable for
 * pasting into an EHR progress note.
 *
 * Does NOT include PHI (name, DOB, MRN).
 */
export function formatEhrSummary({
  timeline,
  flags,
  alerts,
  lastActiveDate,
  engagement,
}: {
  timeline: SnapshotDay[];
  flags: RecoveryFlag[];
  alerts: RecoveryAlert[];
  lastActiveDate: string | null;
  engagement: EngagementResult | null;
}): string {
  const lines: string[] = [];

  // Header
  lines.push("WEEKLY RECOVERY SNAPSHOT (Last 14 days)");
  lines.push(`Generated: ${localYYYYMMDD()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
  lines.push(`Last active: ${formatLastActive(lastActiveDate)}`);
  lines.push("");

  // Engagement score
  if (engagement) {
    const b = engagement.breakdown;
    lines.push(`Engagement Score (14d): ${engagement.score}/100 (${engagement.band})`);
    lines.push(`- Active days: ${b.activeDays}/${b.daysTotal}`);
    lines.push(`- Dose days (≥10 min): ${b.doseDays}/${b.daysTotal}`);
    lines.push(`- Readiness check-ins: ${b.readinessDays}/${b.daysTotal}`);
    if (b.fatigueDaysRecorded > 0) {
      lines.push(`- Fatigue stable (≤3/5): ${b.fatigueStableDays}/${b.fatigueDaysRecorded} recorded days`);
    } else {
      lines.push(`- Fatigue: not recorded`);
    }
    lines.push("");
  }

  // 7-day averages
  const last7 = timeline.slice(-7);
  const avgSpeech = avg(last7.map((d) => d.speechMinutes));
  const avgTherapy = avg(last7.map((d) => d.therapyMinutes));
  const avgActivity = avg(last7.map((d) => d.activityMinutes));

  const speechActiveDays = last7.filter((d) => d.speechMinutes > 0).length;
  const fatigueDays = last7.filter((d) => d.fatigueRating !== null);
  const avgFatigue =
    fatigueDays.length > 0
      ? avg(fatigueDays.map((d) => d.fatigueRating!))
      : null;

  lines.push("Last 7 days (avg/day):");
  lines.push(
    `- Speech dose: ${avgSpeech.toFixed(0)} min/day (${speechActiveDays}/7 days active)`
  );
  lines.push(
    `- Therapy dose (PT/OT/Cog): ${avgTherapy.toFixed(0)} min/day`
  );
  lines.push(`- Activity dose: ${avgActivity.toFixed(0)} min/day`);
  if (fatigueDays.length === 0) {
    lines.push(`- Fatigue: not recorded`);
  } else {
    lines.push(
      `- Fatigue: ${avgFatigue!.toFixed(1)}/5 (recorded ${fatigueDays.length}/7 days)`
    );
  }
  lines.push("");

  // Flags
  if (flags.length > 0) {
    lines.push("Flags:");
    for (const f of flags) {
      lines.push(`- ${f.label}`);
    }
    lines.push("");
  }

  // Unresolved alerts with ack status
  const unresolvedAlerts = alerts.filter((a) => !a.resolved_at);
  if (unresolvedAlerts.length > 0) {
    lines.push("Active Alerts:");
    for (const a of unresolvedAlerts) {
      const sev = a.severity.toUpperCase();
      const ackStatus = a.acknowledged_at ? "acknowledged" : "unacknowledged";
      lines.push(`- ${sev} (${ackStatus}): ${a.title}`);
      if (a.description) {
        lines.push(`  ${a.description}`);
      }
    }
    lines.push("");
  }

  // Physical ↔ Fatigue correlation (last 7 days)
  const pairedDays = last7.filter((d) => {
    const load = getPhysLoad(d);
    return load !== null && d.fatigueRating !== null;
  });

  if (pairedDays.length < 3) {
    lines.push(
      `Physical ↔ Fatigue: insufficient paired data (${pairedDays.length}/7 days with both recorded).`
    );
  } else {
    const loads = pairedDays.map((d) => getPhysLoad(d)!);
    const meanLoad = avg(loads);
    const highPhysDays = pairedDays.filter((d) => getPhysLoad(d)! > meanLoad);
    const lowPhysDays = pairedDays.filter((d) => getPhysLoad(d)! <= meanLoad);

    // Determine which load signal was used most
    const loadBasisCounts = { activeMin: 0, workoutMin: 0, steps: 0 };
    for (const d of pairedDays) {
      if (d.activeMinutesObjective !== null) loadBasisCounts.activeMin++;
      else if (d.workoutMinutesObjective !== null) loadBasisCounts.workoutMin++;
      else if (d.steps !== null) loadBasisCounts.steps++;
    }
    const loadBasis = loadBasisCounts.activeMin >= loadBasisCounts.workoutMin && loadBasisCounts.activeMin >= loadBasisCounts.steps
      ? "activeMin"
      : loadBasisCounts.workoutMin >= loadBasisCounts.steps
        ? "workoutMin"
        : "steps";

    const avgFatigueHigh = highPhysDays.length > 0
      ? avg(highPhysDays.map((d) => d.fatigueRating!))
      : null;
    const avgFatigueLow = lowPhysDays.length > 0
      ? avg(lowPhysDays.map((d) => d.fatigueRating!))
      : null;

    if (avgFatigueHigh !== null && avgFatigueLow !== null) {
      lines.push(
        `Physical ↔ Fatigue: fatigue avg was ${avgFatigueHigh.toFixed(1)}/5 on higher-activity days vs ${avgFatigueLow.toFixed(1)}/5 on lower-activity days (n=${pairedDays.length}, split=mean, basis=${loadBasis}).`
      );
    } else {
      lines.push(
        `Physical ↔ Fatigue: insufficient variation to compare (n=${pairedDays.length}, basis=${loadBasis}).`
      );
    }
  }
  lines.push("");

  // Suggested clinician note
  const suggestions: string[] = [];
  if (flags.some((f) => f.type === "no_signal")) {
    suggestions.push("consider outreach to assess barriers");
  }
  if (flags.some((f) => f.type === "fatigue_spike")) {
    suggestions.push(
      "assess fatigue drivers; consider reducing task difficulty"
    );
  }
  if (speechActiveDays < 5 && speechActiveDays > 0) {
    suggestions.push("reinforce short daily speech sessions");
  }
  if (suggestions.length > 0) {
    lines.push("Clinician note (suggested):");
    const joined = suggestions.join("; ");
    lines.push(`${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`);
  }

  return lines.join("\n");
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function sortedMedian(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** physLoad: activeMinutes > workoutMinutes > steps/200 > null */
function getPhysLoad(d: SnapshotDay): number | null {
  if (d.activeMinutesObjective !== null) return d.activeMinutesObjective;
  if (d.workoutMinutesObjective !== null) return d.workoutMinutesObjective;
  if (d.steps !== null) return d.steps / 200;
  return null;
}

function formatLastActive(lastActiveDate: string | null): string {
  if (!lastActiveDate) return "No activity yet";
  const today = new Date();
  const last = new Date(lastActiveDate + "T12:00:00");
  const diffDays = Math.round(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
