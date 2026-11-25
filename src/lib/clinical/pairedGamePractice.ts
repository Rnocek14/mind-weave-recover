import { normalizeExerciseSlug } from "@/lib/exerciseSlugNormalizer";
import { isComparableScoredEvent, type PresentationEvent } from "./metricsPresentation";

export const cohortDimensions = {
  stroke_mechanism_tag: "Stroke mechanism",
  aphasia_type: "Aphasia type",
  laterality: "Laterality",
  primary_territory: "Vascular territory",
  chronicity_tag: "Chronicity",
} as const;
export type CohortDimension = keyof typeof cohortDimensions;
type Profile = { id: string } & Partial<Record<CohortDimension, string | null>>;
type Event = PresentationEvent & { session_id: string; created_at: string | null };
type Observation = { day: number; condition: string; credit: number };
export type GamePracticeRow = {
  game: string; group: string; recorded: number; baseline: number; pending: number;
  absent: number; unmatched: number; paired: number;
  median: number | null; q1: number | null; q3: number | null;
};

const dayNumber = (ms: number) => Math.floor(ms / 86_400_000);

function observation(event: Event, today: number): Observation | null {
  const task = event.task_parameters;
  if (!task || typeof task !== "object" || Array.isArray(task)) return null;
  const t = task as Record<string, unknown>;
  const level = t.game_level;
  const mode = t.trial_mode;
  if (t.unified_trial_v1 !== true || !isComparableScoredEvent(event) ||
      (event.score !== 0 && event.score !== 100) || t.manual_confirmed === true ||
      t.confirmation_mode === "manual" || t.interaction_mode === "caregiver_assisted" ||
      !Number.isInteger(level) || Number(level) < 1 || Number(level) > 10 ||
      (mode !== "production" && mode !== "recognition" && mode !== "scaffolded")) return null;
  const day = dayNumber(Date.parse(event.created_at ?? ""));
  if (!Number.isFinite(day) || day > today) return null;
  // This is recorded final task credit. The available contract cannot always identify
  // the first utterance, ordered cues, item familiarity, or transfer to daily life.
  return { day, condition: JSON.stringify([level, mode, t.interaction_mode ?? null]), credit: event.score };
}

function periodRates(observations: Observation[], first: number, last: number) {
  const rates = new Map<string, { sum: number; n: number }>();
  for (const { day, condition, credit } of observations) {
    if (day < first || day > last) continue;
    const rate = rates.get(condition) ?? { sum: 0, n: 0 };
    rate.n++;
    rate.sum += credit;
    rates.set(condition, rate);
  }
  return rates;
}

function quantile(sorted: number[], p: number): number | null {
  if (sorted.length < 2) return null;
  const i = (sorted.length - 1) * p;
  return Math.round((sorted[Math.floor(i)] + (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1)) * 10) / 10;
}

export function pairedGamePractice(
  profiles: readonly Profile[], events: readonly Event[], sessionProfiles: ReadonlyMap<string, string>,
  dimension: CohortDimension, asOf = Date.now(),
): GamePracticeRow[] {
  const today = dayNumber(asOf);
  const subjects = new Map(profiles.map(p => [p.id, p]));
  type Cell = { game: string; group: string; people: Map<string, Observation[]> };
  const cells = new Map<string, Cell>();
  for (const e of events) {
    const id = sessionProfiles.get(e.session_id);
    if (!id || !e.exercise_slug) continue;
    const profile = subjects.get(id);
    if (!profile) continue;
    const game = normalizeExerciseSlug(e.exercise_slug);
    const group = profile[dimension]?.trim() || "Unknown";
    const key = JSON.stringify([game, group]);
    const cell = cells.get(key) ?? { game, group, people: new Map<string, Observation[]>() };
    const records = cell.people.get(id) ?? [];
    const valid = observation(e, today);
    if (valid) records.push(valid);
    cell.people.set(id, records);
    cells.set(key, cell);
  }

  return Array.from(cells.values(), ({ game, group, people }) => {
    let baseline = 0, pending = 0, absent = 0, unmatched = 0;
    const changes: number[] = [];
    for (const records of people.values()) {
      if (!records.length) continue;
      baseline++;
      const first = records.reduce((min, r) => Math.min(min, r.day), Infinity);
      if (today < first + 28) { pending++; continue; }
      const follow = periodRates(records, first + 21, first + 27);
      if (!follow.size) { absent++; continue; }
      const start = periodRates(records, first, first + 6);
      const diffs: number[] = [];
      for (const [condition, a] of start) {
        const b = follow.get(condition);
        if (b) diffs.push(b.sum / b.n - a.sum / a.n);
      }
      if (!diffs.length) { unmatched++; continue; }
      changes.push(diffs.reduce((sum, d) => sum + d, 0) / diffs.length);
    }
    changes.sort((a, b) => a - b);
    return { game, group, recorded: people.size, baseline, pending, absent, unmatched, paired: changes.length,
      median: quantile(changes, 0.5), q1: quantile(changes, 0.25), q3: quantile(changes, 0.75) };
  }).sort((a, b) => b.paired - a.paired || a.game.localeCompare(b.game) || a.group.localeCompare(b.group));
}
