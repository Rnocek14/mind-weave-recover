/**
 * masteryConfidenceSim — Phase A.1 (Mastery Visibility) validation harness.
 *
 * Goal of Phase A.1: **expose** mastery confidence and prove it behaves
 * sensibly BEFORE it is allowed to influence (A.2) or gate (A.3) promotion.
 *
 * This module is pure + deterministic. It drives the REAL `computeMastery`
 * scorer session-by-session, exactly mirroring how `flushMasteryShadow`
 * calls it in production:
 *   - each session contributes a batch of trials,
 *   - we pass the trailing 14-day window of trials + the previous row,
 *   - the returned row becomes `prev` for the next session.
 *
 * It writes NOTHING. No DB, no gating, no progression. It only produces a
 * per-session confidence/mastery trajectory so we can answer:
 *   1. Does confidence increase when it should?            (steady improver)
 *   2. Does confidence stagnate when it should?            (plateau)
 *   3. Does confidence survive bad days?                   (recovery)
 *   4. Does confidence correlate with independence?        (steady vs cue-dep)
 *   5. Does confidence correlate with cue dependency?      (cue-dependent)
 */

import { computeMastery, type MasteryRow, type MasteryTrial } from './computeMastery';
import { mulberry32 } from '@/lib/simulation/userProfiles';
import {
  explainMasteryConfidence,
  type MasteryConfidenceExplanation,
} from './masteryConfidenceReasons';
import {
  classifyMasteryPromotion,
  tallyMasteryDecisions,
  type MasteryPromotionRecommendation,
  type MasteryDecisionTelemetry,
} from './masteryPromotionDecision';

export type MasteryArchetypeId =
  | 'steady_improver'
  | 'plateau'
  | 'cue_dependent'
  | 'recovery_after_setback';

export interface MasterySessionSnapshot {
  sessionIndex: number;          // 1-based
  dayOffset: number;             // days before "now" this session ran (descending)
  confidence: MasteryRow['confidence'];
  masteryScore: number;          // 0..1
  cueIndependence: number | null;
  accuracyRecent: number | null;
  trialsTotal: number;           // within the 14d window (matches production)
  plateauFlag: boolean;
  velocityPerWeek: number | null;
  supportTrend: MasteryRow['support_dependency_trend'];
  // ---- Phase A.2 additions ----
  /** Distinct sessions in the 14d scoring window. */
  sessionCount: number;
  /** Calendar days spanned by the 14d scoring window. */
  daySpanDays: number;
  /** Clinician-facing explanation of WHY confidence is what it is. */
  confidenceExplanation: MasteryConfidenceExplanation;
  /** Mastery-informed promotion recommendation (A.2 — recommendation only). */
  promotion: MasteryPromotionRecommendation;
}

export interface MasteryTrajectory {
  archetype: MasteryArchetypeId;
  label: string;
  description: string;
  snapshots: MasterySessionSnapshot[];
  /** Convenience: the final session snapshot. */
  final: MasterySessionSnapshot;
  /** Highest confidence ever reached across the run. */
  peakConfidence: MasteryRow['confidence'];
  /** Lowest confidence reached AFTER first reaching medium (bad-day survival). */
  lowestConfidenceAfterMedium: MasteryRow['confidence'] | null;
  /** A.2 telemetry: how often would mastery approve/delay a promotion? */
  promotionTelemetry: MasteryDecisionTelemetry;
}

interface SessionShape {
  /** Probability a given trial is correct. */
  accuracy: number;
  /** Cue level the user leans on (0..3, higher = more support). */
  cueLevel: number;
  /** Trials in this session. */
  trials: number;
}

const CONFIDENCE_RANK: Record<MasteryRow['confidence'], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

interface ArchetypeDef {
  id: MasteryArchetypeId;
  label: string;
  description: string;
  /** Returns the behavioral shape for a given (0-based) session index. */
  shape: (sessionIndex: number, totalSessions: number) => SessionShape;
}

const TRIALS_PER_SESSION = 8;

export const MASTERY_ARCHETYPES: ArchetypeDef[] = [
  {
    id: 'steady_improver',
    label: 'Steady improver',
    description:
      'Accuracy climbs and cue reliance falls over time. Confidence should rise none → low → medium → high, with cue independence trending up.',
    shape: (i, total) => {
      const t = i / Math.max(1, total - 1); // 0..1
      return {
        accuracy: clamp(0.55 + 0.4 * t, 0, 0.98),
        cueLevel: t < 0.33 ? 2 : t < 0.66 ? 1 : 0,
        trials: TRIALS_PER_SESSION,
      };
    },
  },
  {
    id: 'plateau',
    label: 'Plateau',
    description:
      'Reaches a moderate, stable level and stays there. Confidence should settle at medium and stop climbing; plateau flag should eventually appear.',
    shape: () => ({
      accuracy: 0.66,
      cueLevel: 1,
      trials: TRIALS_PER_SESSION,
    }),
  },
  {
    id: 'cue_dependent',
    label: 'Cue dependent',
    description:
      'Frequently correct, but only with heavy cues. Cue independence should stay low and mastery score should stay capped despite high raw accuracy.',
    shape: () => ({
      accuracy: 0.85,
      cueLevel: 3,
      trials: TRIALS_PER_SESSION,
    }),
  },
  {
    id: 'recovery_after_setback',
    label: 'Recovery after setback',
    description:
      'Improves, hits a bad stretch (low accuracy + heavy cues), then recovers. Confidence should survive the dip (not collapse to none) while mastery score dips and rebounds.',
    shape: (i, total) => {
      const setbackStart = Math.floor(total * 0.45);
      const setbackEnd = Math.floor(total * 0.6);
      if (i < setbackStart) {
        const t = i / Math.max(1, setbackStart - 1);
        return { accuracy: clamp(0.6 + 0.3 * t, 0, 0.95), cueLevel: t < 0.5 ? 1 : 0, trials: TRIALS_PER_SESSION };
      }
      if (i <= setbackEnd) {
        return { accuracy: 0.4, cueLevel: 3, trials: TRIALS_PER_SESSION };
      }
      const t = (i - setbackEnd) / Math.max(1, total - 1 - setbackEnd);
      return { accuracy: clamp(0.55 + 0.4 * t, 0, 0.96), cueLevel: t < 0.5 ? 1 : 0, trials: TRIALS_PER_SESSION };
    },
  },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Run one archetype through the real scorer for `sessions` daily sessions.
 *
 * @param archetypeId which behavioral archetype
 * @param sessions    number of daily sessions (default 30)
 * @param seed        deterministic RNG seed
 * @param now         reference "current time" (defaults to a fixed date for
 *                    reproducibility in tests)
 */
export function runMasteryConfidenceSim(
  archetypeId: MasteryArchetypeId,
  sessions = 30,
  seed = 1,
  now: Date = new Date('2026-06-01T12:00:00.000Z'),
): MasteryTrajectory {
  const def = MASTERY_ARCHETYPES.find((a) => a.id === archetypeId);
  if (!def) throw new Error(`Unknown mastery archetype: ${archetypeId}`);

  const rng = mulberry32(seed);
  const nowMs = now.getTime();
  const DAY = 86400_000;

  // All trials accumulated across the run, each tagged with a real timestamp.
  const allTrials: MasteryTrial[] = [];
  const snapshots: MasterySessionSnapshot[] = [];
  let prev: MasteryRow | null = null;

  for (let s = 0; s < sessions; s++) {
    const dayOffset = sessions - 1 - s; // oldest session first
    const sessionTimeMs = nowMs - dayOffset * DAY;
    const sessionId = `sim-${archetypeId}-${s}`;
    const shape = def.shape(s, sessions);

    for (let t = 0; t < shape.trials; t++) {
      const correct = rng() < shape.accuracy;
      // Small intra-session timestamp spread so ordering is stable.
      const createdAt = new Date(sessionTimeMs + t * 1000).toISOString();
      allTrials.push({
        is_correct: correct,
        // Cue is only "leaned on" when correct; wrong answers don't earn
        // independence credit anyway (scorer only counts cues on correct).
        cue_level: correct ? shape.cueLevel : Math.min(3, shape.cueLevel + 1),
        created_at: createdAt,
        session_id: sessionId,
      });
    }

    // Mirror production: pass the trailing 14-day window + prev row.
    const sinceMs = sessionTimeMs - 14 * DAY;
    const windowTrials = allTrials.filter(
      (tr) => new Date(tr.created_at).getTime() >= sinceMs,
    );
    const row = computeMastery(windowTrials, prev, new Date(sessionTimeMs + 60_000));
    prev = row;

    // A.2 — distinct sessions + day span inside the scoring window.
    const sessionCount = new Set(
      windowTrials.map((tr) => tr.session_id).filter(Boolean),
    ).size;
    const times = windowTrials.map((tr) => new Date(tr.created_at).getTime());
    const daySpanDays =
      times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY : 0;

    const confidenceExplanation = explainMasteryConfidence({
      confidence: row.confidence,
      trialsTotal: row.trials_total,
      sessionCount,
      daySpanDays,
      cueIndependence: row.cue_independence,
      accuracyRecent: row.accuracy_recent,
      plateauFlag: row.plateau_flag,
    });

    // Recommendation only (A.2). Single-skill sim → drive from confidence
    // (evidence question) PLUS mastery quality (independence question), so
    // cue-dependent / dipping learners are correctly delayed, not promoted.
    const promotion = classifyMasteryPromotion({
      confidence: row.confidence,
      masteryScore: row.mastery_score,
      cueIndependence: row.cue_independence,
      plateauFlag: row.plateau_flag,
      regressionFlag: row.support_dependency_trend === 'worsening',
    });

    snapshots.push({
      sessionIndex: s + 1,
      dayOffset,
      confidence: row.confidence,
      masteryScore: row.mastery_score,
      cueIndependence: row.cue_independence,
      accuracyRecent: row.accuracy_recent,
      trialsTotal: row.trials_total,
      plateauFlag: row.plateau_flag,
      velocityPerWeek: row.velocity_per_week,
      supportTrend: row.support_dependency_trend,
      sessionCount,
      daySpanDays,
      confidenceExplanation,
      promotion,
    });
  }

  const peakConfidence = snapshots.reduce<MasteryRow['confidence']>(
    (peak, s) => (CONFIDENCE_RANK[s.confidence] > CONFIDENCE_RANK[peak] ? s.confidence : peak),
    'none',
  );

  // Bad-day survival: once medium is first reached, what's the lowest the
  // confidence ever dropped to afterward?
  let lowestConfidenceAfterMedium: MasteryRow['confidence'] | null = null;
  const firstMediumIdx = snapshots.findIndex(
    (s) => CONFIDENCE_RANK[s.confidence] >= CONFIDENCE_RANK.medium,
  );
  if (firstMediumIdx >= 0) {
    lowestConfidenceAfterMedium = snapshots
      .slice(firstMediumIdx)
      .reduce<MasteryRow['confidence']>(
        (lo, s) => (CONFIDENCE_RANK[s.confidence] < CONFIDENCE_RANK[lo] ? s.confidence : lo),
        'high',
      );
  }

  const promotionTelemetry = tallyMasteryDecisions(
    snapshots.map((s) => s.promotion.decision),
  );

  return {
    archetype: def.id,
    label: def.label,
    description: def.description,
    snapshots,
    final: snapshots[snapshots.length - 1],
    peakConfidence,
    lowestConfidenceAfterMedium,
    promotionTelemetry,
  };
}

/** Run every archetype with the same settings. */
export function runAllMasteryConfidenceSims(
  sessions = 30,
  seed = 1,
  now?: Date,
): MasteryTrajectory[] {
  return MASTERY_ARCHETYPES.map((a) =>
    runMasteryConfidenceSim(a.id, sessions, seed, now),
  );
}

export { CONFIDENCE_RANK };
