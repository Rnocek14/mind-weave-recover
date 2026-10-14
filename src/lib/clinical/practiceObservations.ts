/**
 * Read-only descriptions of app measurements, not clinical recommendations.
 * Does not infer speech speed, real-world carryover, or treatment readiness.
 * Existing metric definitions/denominators are intentionally not changed here.
 */
export interface PracticeObservation {
  exercise: string;
  functional: string;
  signal: string;
}

interface PracticeObservationInput {
  averageScorePct: number | null | undefined;
  scoreSlopePerDay: number | null | undefined;
  cueIndexPct: number | null | undefined;
}

function isPercentage(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function buildPracticeObservations(input: PracticeObservationInput): PracticeObservation[] {
  const observations: PracticeObservation[] = [];
  if (isPercentage(input.averageScorePct)) {
    observations.push({
      exercise: 'Recorded practice score',
      functional: 'In-app performance',
      signal: `${Math.round(input.averageScorePct)}% across eligible recorded events. Tasks and support may vary; this is not independent naming accuracy.`,
    });
  }
  if (typeof input.scoreSlopePerDay === 'number' && Number.isFinite(input.scoreSlopePerDay)) {
    const direction = input.scoreSlopePerDay > 0 ? 'increased' : input.scoreSlopePerDay < 0 ? 'decreased' : 'were unchanged';
    observations.push({
      exercise: 'Practice score trend',
      functional: 'Recorded scores over time',
      signal: `Recorded scores ${direction}. This does not measure response speed or everyday communication.`,
    });
  }
  if (isPercentage(input.cueIndexPct)) {
    observations.push({
      exercise: 'Recorded cue summary',
      functional: 'Support during app practice',
      signal: `${Math.round(input.cueIndexPct)}% on the existing app cue index. This is not a measure of support needed in everyday conversation.`,
    });
  }
  return observations;
}
