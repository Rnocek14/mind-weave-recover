/**
 * Read-only metrics presentation. This does not re-score attempts, alter
 * clinical progression, or turn speaker attribution into a clinical decision.
 * "Eligible" means the current *existing* validity gate permits the sample;
 * it is NOT proof that biometric identity has been verified.
 */
import { hasDeliveredCue, isScoredClinicalEvidence, type ScoredEvidence } from './scoredEvidence';

export interface PresentationTrial extends ScoredEvidence {
  is_correct: boolean | null;
  exercise_slug?: string | null;
  cue_type_given?: string | null;
}

export interface PresentationEvent extends ScoredEvidence {
  score: number | null;
  exercise_slug?: string | null;
}

const NON_COMPARABLE_SLUGS = new Set([
  'conversation_partner', 'conversation_coach', 'conversation_turn', 'voice_practice',
]);

export function isComparableScoredEvent(event: PresentationEvent): boolean {
  return typeof event.score === 'number'
    && Number.isFinite(event.score)
    && event.score >= 0 && event.score <= 100
    && !NON_COMPARABLE_SLUGS.has(event.exercise_slug ?? '')
    && event.validity_label !== 'manual_confirmed'
    && isScoredClinicalEvidence(event);
}

/** Preserve legacy 0..1 and 0..100 result scales for read-only display. */
function toPercent(score: number): number {
  return score <= 1 ? score * 100 : score;
}

function ratioPercent(part: number, total: number): number | null {
  return total > 0 ? Math.round(part / total * 100) : null;
}

export function summarizePresentationEvents(events: readonly PresentationEvent[]) {
  const eligible = events.filter(isComparableScoredEvent);
  const total = eligible.reduce((sum, event) => sum + toPercent(event.score!), 0);
  return {
    attempted: events.length,
    eligible: eligible.length,
    unscored: events.length - eligible.length,
    averagePct: eligible.length > 0 ? Math.round(total / eligible.length) : null,
  };
}

export function summarizePresentationTrials(trials: readonly PresentationTrial[]) {
  const eligible = trials.filter(
    trial => typeof trial.is_correct === 'boolean' && isScoredClinicalEvidence(trial)
  );
  const eligibleSet = new Set(eligible);
  const correct = eligible.filter(trial => trial.is_correct === true).length;
  const cued = eligible.filter(trial => hasDeliveredCue(trial.cue_type_given)).length;
  const buckets = { valid: eligible.length, filler: 0, silence: 0, noise: 0, flagged: 0 };

  for (const trial of trials) {
    if (eligibleSet.has(trial)) continue;
    const reason = trial.clinician_validity_override ?? trial.validity_label ?? '';
    if (reason === 'filler' || reason === 'filler_only') buckets.filler++;
    else if (reason === 'no_response') buckets.silence++;
    else if (reason === 'noise' || reason === 'background_noise') buckets.noise++;
    else buckets.flagged++;
  }

  return {
    attempted: trials.length,
    eligible: eligible.length,
    excludedOrUnscored: trials.length - eligible.length,
    correct,
    cued,
    accuracyPct: ratioPercent(correct, eligible.length),
    cueDependencyPct: ratioPercent(cued, eligible.length),
    gamesPlayed: new Set(trials.map(trial => trial.exercise_slug).filter(Boolean)).size,
    validityBuckets: buckets,
  };
}

export interface PracticeObservation extends ScoredEvidence {
  created_at: string | null;
  is_correct: boolean | null;
}

export interface DailyPracticeAccuracy {
  date: string;
  correct: number;
  count: number;
  accuracy: number | null;
}

export function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Dates with no eligible, scored speech must be null, never zero accuracy. */
export function buildDailyPracticeAccuracy(
  observations: readonly PracticeObservation[],
  dates: readonly string[],
): DailyPracticeAccuracy[] {
  const grouped = new Map<string, { correct: number; count: number }>();
  for (const row of observations) {
    if (typeof row.is_correct !== 'boolean' || !isScoredClinicalEvidence(row) || !row.created_at) continue;
    const date = new Date(row.created_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = localDateKey(date);
    const counts = grouped.get(key) ?? { correct: 0, count: 0 };
    counts.count++;
    if (row.is_correct) counts.correct++;
    grouped.set(key, counts);
  }

  return dates.map(date => {
    const counts = grouped.get(date) ?? { correct: 0, count: 0 };
    return { date, ...counts, accuracy: ratioPercent(counts.correct, counts.count) };
  });
}

/** Weighted by eligible speech attempts, not by the number of active days. */
export function summarizeRecentPracticeAccuracy(days: readonly DailyPracticeAccuracy[]) {
  const correct = days.reduce((sum, day) => sum + day.correct, 0);
  const eligible = days.reduce((sum, day) => sum + day.count, 0);
  return { accuracyPct: ratioPercent(correct, eligible), eligible, activeDays: days.filter(day => day.count > 0).length };
}

export function formatPracticePercent(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : String(Math.round(value)) + '%';
}
