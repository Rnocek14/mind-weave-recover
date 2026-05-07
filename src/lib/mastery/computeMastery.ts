/**
 * computeMastery — pure scoring function for the Mastery Layer (shadow).
 *
 * Inputs: an array of valid trials for one user × skill, plus the previous
 * mastery row (if any). Output: a new mastery row. No DB access, no side
 * effects — fully unit-testable.
 *
 * Scoring rules (see plan):
 *   raw_accuracy     = correct / total
 *   cue_independence = Σ(correct × (1 - cue_level/3)) / Σ(correct)
 *   mastery_score    = EWMA( accuracy × (0.4 + 0.6 × cue_independence), α=0.3 )
 *   confidence       = none(<5) / low(5–11) / medium(12–29, ≥3 sessions) /
 *                      high(≥30, ≥6 sessions, ≥3 days)
 */

export interface MasteryTrial {
  is_correct: boolean;
  cue_level: number | null;        // 0..3, higher = more support
  created_at: string;              // ISO
  session_id?: string | null;
  fatigue_rating?: number | null;  // 1..5 if available

  // P0-A — visibility + routing only. NOT consumed by the EWMA math.
  // See lib/mastery/masterySignalRouting.ts.
  trialMode?: 'production' | 'recognition' | 'scaffolded' | 'exposure' | 'mixed' | null;
  signalGranularity?: 'binary' | 'graded' | 'vector' | null;
  gradedScore?: number | null;
  scoreVector?: Record<string, number> | null;
}

export interface MasteryRow {
  mastery_score: number;           // 0..1
  confidence: 'none' | 'low' | 'medium' | 'high';
  trials_total: number;
  trials_recent: number;           // last 14d
  accuracy_recent: number | null;
  cue_independence: number | null;
  velocity_per_week: number | null;
  plateau_flag: boolean;
  fatigue_adjusted_score: number | null;
  last_practiced_at: string | null;
  support_dependency_trend: 'improving' | 'stable' | 'worsening' | null;
}

const EMPTY: MasteryRow = {
  mastery_score: 0,
  confidence: 'none',
  trials_total: 0,
  trials_recent: 0,
  accuracy_recent: null,
  cue_independence: null,
  velocity_per_week: null,
  plateau_flag: false,
  fatigue_adjusted_score: null,
  last_practiced_at: null,
  support_dependency_trend: null,
};

function daysAgo(iso: string, ref: number): number {
  return (ref - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

export function computeMastery(
  trials: MasteryTrial[],
  prev: MasteryRow | null = null,
  now: Date = new Date(),
): MasteryRow {
  if (!trials || trials.length === 0) return prev ?? EMPTY;

  const refMs = now.getTime();
  const sorted = [...trials].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const last = sorted[sorted.length - 1];

  const recent = sorted.filter(t => daysAgo(t.created_at, refMs) <= 14);
  const trialsTotal = sorted.length;
  const trialsRecent = recent.length;

  const correctRecent = recent.filter(t => t.is_correct);
  const accuracyRecent = recent.length > 0 ? correctRecent.length / recent.length : null;

  // Cue independence on correct answers only.
  let cueIndependence: number | null = null;
  if (correctRecent.length > 0) {
    const sum = correctRecent.reduce(
      (acc, t) => acc + (1 - Math.min(3, Math.max(0, t.cue_level ?? 0)) / 3),
      0,
    );
    cueIndependence = sum / correctRecent.length;
  }

  // Per-trial weighted score, then EWMA across recent trials (chronological).
  const alpha = 0.3;
  let ewma = prev?.mastery_score ?? 0;
  for (const t of recent) {
    const ci = 1 - Math.min(3, Math.max(0, t.cue_level ?? 0)) / 3;
    const trialScore = (t.is_correct ? 1 : 0) * (0.4 + 0.6 * ci);
    ewma = alpha * trialScore + (1 - alpha) * ewma;
  }
  const masteryScore = Math.max(0, Math.min(1, ewma));

  // Sessions in recent window
  const sessions = new Set(recent.map(t => t.session_id).filter(Boolean));
  const sessionCount = sessions.size;
  const daySpan = recent.length > 1
    ? daysAgo(recent[0].created_at, refMs) - daysAgo(recent[recent.length - 1].created_at, refMs)
    : 0;

  let confidence: MasteryRow['confidence'] = 'none';
  if (trialsTotal >= 30 && sessionCount >= 6 && daySpan >= 3) confidence = 'high';
  else if (trialsTotal >= 12 && sessionCount >= 3) confidence = 'medium';
  else if (trialsTotal >= 5) confidence = 'low';

  // Velocity: Δmastery vs prev / weeks since prev practice (cap 4 weeks)
  let velocity: number | null = null;
  if (prev?.last_practiced_at && prev.mastery_score != null) {
    const weeks = Math.max(
      1 / 7,
      Math.min(4, daysAgo(prev.last_practiced_at, refMs) / 7),
    );
    velocity = (masteryScore - prev.mastery_score) / weeks;
  }

  // Plateau: ≥medium confidence AND |velocity| < 0.05 AND already flagged or stable
  const plateauFlag =
    confidence !== 'none' &&
    confidence !== 'low' &&
    velocity != null &&
    Math.abs(velocity) < 0.05 &&
    ((prev?.plateau_flag ?? false) || trialsRecent >= 12);

  // Fatigue-adjusted score
  const fatigueRatings = recent.map(t => t.fatigue_rating).filter((x): x is number => x != null);
  const avgFatigue =
    fatigueRatings.length > 0
      ? fatigueRatings.reduce((a, b) => a + b, 0) / fatigueRatings.length
      : null;
  const fatigueAdjusted =
    avgFatigue != null ? masteryScore * (1 - 0.1 * (avgFatigue / 5)) : masteryScore;

  // Support dependency trend
  let trend: MasteryRow['support_dependency_trend'] = null;
  if (prev?.cue_independence != null && cueIndependence != null) {
    const delta = cueIndependence - prev.cue_independence;
    trend = delta > 0.05 ? 'improving' : delta < -0.05 ? 'worsening' : 'stable';
  }

  return {
    mastery_score: masteryScore,
    confidence,
    trials_total: trialsTotal,
    trials_recent: trialsRecent,
    accuracy_recent: accuracyRecent,
    cue_independence: cueIndependence,
    velocity_per_week: velocity,
    plateau_flag: plateauFlag,
    fatigue_adjusted_score: fatigueAdjusted,
    last_practiced_at: last.created_at,
    support_dependency_trend: trend,
  };
}

/**
 * Suggested level change (advisory only — never enforced in shadow mode).
 */
export function suggestLevelChange(
  row: MasteryRow,
  trialsAtCurrentLevel: number,
): 'up' | 'down' | 'hold' {
  if (trialsAtCurrentLevel < 8) return 'hold';
  if (
    row.mastery_score >= 0.8 &&
    (row.cue_independence ?? 0) >= 0.7 &&
    (row.confidence === 'medium' || row.confidence === 'high') &&
    (row.velocity_per_week ?? 0) >= 0
  ) return 'up';
  if (
    row.mastery_score < 0.45 &&
    (row.cue_independence ?? 1) < 0.4
  ) return 'down';
  return 'hold';
}
