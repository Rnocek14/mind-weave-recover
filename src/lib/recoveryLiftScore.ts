/**
 * Within-Session Lift — "Did speech metrics improve over THIS session?"
 *
 * Compares baseline speech metrics (first N turns) vs end-of-session
 * metrics (last N turns). Positive = the user's turns got stronger as the
 * session went on.
 *
 * NAMING/HONESTY NOTE: this was previously called "Recovery Lift Score",
 * which overclaimed. A first-3 vs last-3 turn delta measures within-session
 * change — which includes warm-up effects, fatigue, and topic difficulty —
 * NOT durable recovery. A patient can post a positive lift every session
 * with zero long-term change. Any surface that displays this metric must
 * label it as within-session change, and it must never be aggregated or
 * presented as a recovery/outcome measure. The component weights and
 * normalization constants below are calibration defaults, not validated.
 * (The persisted storage key `recovery_lift` is retained for backward
 * compatibility with existing session rows; the payload now carries an
 * explicit `measures` disclaimer field.)
 */

import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface TurnSnapshot {
  wordCount: number;
  fluencyScore: number;
  latencyMs: number | null;
  cueLevel: number;
  wasIndependent: boolean;
}

export interface RecoveryLiftResult {
  /** -100 to +100. Positive = improvement. */
  liftScore: number;
  /** Component lifts */
  fluencyLift: number;      // Change in avg fluency score
  wordCountLift: number;    // Change in avg word count
  latencyLift: number;      // Change in avg latency (negative = faster = better)
  cueDependencyLift: number; // Change in cue independence (positive = less cues = better)
  /** Raw data */
  baselineAvg: { fluency: number; wordCount: number; latencyMs: number; cueLevel: number };
  endAvg: { fluency: number; wordCount: number; latencyMs: number; cueLevel: number };
  /** Confidence */
  confidence: 'high' | 'medium' | 'low';
  turnsAnalyzed: number;
}

// ═══════════════════════════════════════════════════════════════
// Calculator
// ═══════════════════════════════════════════════════════════════

const WINDOW_SIZE = 3; // Compare first 3 vs last 3 turns

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function calculateRecoveryLift(turns: TurnSnapshot[]): RecoveryLiftResult | null {
  // Need at least 6 turns (3 baseline + 3 end) for meaningful comparison
  if (turns.length < WINDOW_SIZE * 2) {
    return null;
  }

  const baseline = turns.slice(0, WINDOW_SIZE);
  const end = turns.slice(-WINDOW_SIZE);

  const baselineAvg = {
    fluency: avg(baseline.map(t => t.fluencyScore)),
    wordCount: avg(baseline.map(t => t.wordCount)),
    latencyMs: avg(baseline.filter(t => t.latencyMs != null).map(t => t.latencyMs!)),
    cueLevel: avg(baseline.map(t => t.cueLevel)),
  };

  const endAvg = {
    fluency: avg(end.map(t => t.fluencyScore)),
    wordCount: avg(end.map(t => t.wordCount)),
    latencyMs: avg(end.filter(t => t.latencyMs != null).map(t => t.latencyMs!)),
    cueLevel: avg(end.map(t => t.cueLevel)),
  };

  // Calculate component lifts (all normalized to -100..+100 range)
  const fluencyLift = endAvg.fluency - baselineAvg.fluency; // Already 0-100 scale
  
  // Word count lift: cap at ±10 words difference, normalize to ±50
  const rawWordLift = endAvg.wordCount - baselineAvg.wordCount;
  const wordCountLift = Math.max(-50, Math.min(50, rawWordLift * 5));
  
  // Latency lift: faster = positive. Normalize: 1000ms improvement = +25
  const rawLatencyDiff = baselineAvg.latencyMs - endAvg.latencyMs; // positive = got faster
  const latencyLift = baselineAvg.latencyMs > 0 
    ? Math.max(-25, Math.min(25, rawLatencyDiff / 40))
    : 0;
  
  // Cue dependency lift: less cues = positive. Scale: 1 level drop = +25
  const cueDependencyLift = Math.max(-25, Math.min(25, (baselineAvg.cueLevel - endAvg.cueLevel) * 25));

  // Composite score (weighted)
  const liftScore = Math.round(
    fluencyLift * 0.35 +
    wordCountLift * 0.25 +
    latencyLift * 0.20 +
    cueDependencyLift * 0.20
  );

  // Confidence based on data density
  const confidence = turns.length >= 10 ? 'high' 
    : turns.length >= 6 ? 'medium' 
    : 'low';

  return {
    liftScore: Math.max(-100, Math.min(100, liftScore)),
    fluencyLift: Math.round(fluencyLift * 10) / 10,
    wordCountLift: Math.round(wordCountLift * 10) / 10,
    latencyLift: Math.round(latencyLift * 10) / 10,
    cueDependencyLift: Math.round(cueDependencyLift * 10) / 10,
    baselineAvg,
    endAvg,
    confidence,
    turnsAnalyzed: turns.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// Persistence — write lift score to session summary
// ═══════════════════════════════════════════════════════════════

export async function persistRecoveryLift(
  sessionId: string,
  lift: RecoveryLiftResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        summary: {
          recovery_lift: {
            // Self-describing so downstream readers (clinician reports,
            // research export) cannot mistake this for an outcome measure.
            measures: 'within_session_change_first3_vs_last3_turns',
            score: lift.liftScore,
            fluency_lift: lift.fluencyLift,
            word_count_lift: lift.wordCountLift,
            latency_lift: lift.latencyLift,
            cue_dependency_lift: lift.cueDependencyLift,
            baseline: lift.baselineAvg,
            end: lift.endAvg,
            confidence: lift.confidence,
            turns_analyzed: lift.turnsAnalyzed,
          },
        },
      })
      .eq('id', sessionId);

    if (error) {
      console.warn('[RecoveryLift] Failed to persist:', error.message);
      return false;
    }

    if (import.meta.env.DEV) {
      console.debug(
        `[RecoveryLift] Session ${sessionId}: score=${lift.liftScore} ` +
        `(fluency: ${lift.fluencyLift > 0 ? '+' : ''}${lift.fluencyLift}, ` +
        `words: ${lift.wordCountLift > 0 ? '+' : ''}${lift.wordCountLift}, ` +
        `latency: ${lift.latencyLift > 0 ? '+' : ''}${lift.latencyLift}, ` +
        `cue: ${lift.cueDependencyLift > 0 ? '+' : ''}${lift.cueDependencyLift})`
      );
    }

    return true;
  } catch (err) {
    console.warn('[RecoveryLift] Unexpected error:', err);
    return false;
  }
}
