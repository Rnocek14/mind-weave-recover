/**
 * sessionAdaptationDigest — PR-B2
 *
 * Pure reader that turns adaptation_trial_logs rows for a single session
 * into a structured DigestSignal[]. NEVER writes, NEVER imports the
 * adaptation engine, NEVER renders UI. The wording layer (insightLanguage)
 * consumes the output.
 *
 * Confidence: PR-B3 will replace `provisionalConfidence` with the
 * centralized helper. Until then we use a strict, conservative stub so the
 * digest stays silent unless evidence is clear.
 */

import {
  composeInsights,
  type ComposedInsight,
  type DigestSignal,
  assertSafePhrase,
  resolveSignalToInsight,
} from './insightLanguage';
import {
  insightConfidence,
  type ConfidenceVerdict,
} from './insightConfidence';
import {
  recordSafetyEvent,
  type SafetyTelemetryCounters,
  snapshotSafetyTelemetry,
  resetSafetyTelemetry,
} from './safetyTelemetry';

// ---------------------------------------------------------------------------
// Row shape — subset of adaptation_trial_logs we read.
// Mirrors live schema (see information_schema query). Optional fields are
// permissive so synthetic fixtures can omit irrelevant columns.
// ---------------------------------------------------------------------------

export interface AdaptationTrialRow {
  exercise_slug: string;
  trial_index: number;
  difficulty?: number | null;
  cue_level?: number | null;
  cue_dependency?: number | null;
  success_rate?: number | null;
  correct?: boolean | null;
  fatigue?: string | null;
  difficulty_change_direction?: 'up' | 'down' | 'hold' | string | null;
  difficulty_change_reason?: string | null;
  escalation_blocked?: boolean | null;
  escalation_block_reason?: string | null;
}

// ---------------------------------------------------------------------------
// Confidence — delegates to the centralized helper (PR-B3).
// We collect verdicts (tier + provenance) per derived signal so the digest
// result can expose internal-only provenance for debugging / audit.
// ---------------------------------------------------------------------------

interface ConfidenceInputs {
  trials: number;
  effectSize: number; // 0..1
  consistency: number; // 0..1
}

const provenanceBuffer: Array<{ kind: DigestSignal['kind']; slug: string; verdict: ConfidenceVerdict }> = [];

function provisionalConfidence(input: ConfidenceInputs): ConfidenceVerdict {
  return insightConfidence({
    trialsAtDimension: input.trials,
    effectSize: input.effectSize,
    consistencyAcrossTrials: input.consistency,
  });
}

// ---------------------------------------------------------------------------
// Per-game signal derivation.
// ---------------------------------------------------------------------------

function bandFromSuccessRate(rate: number): 'warmup' | 'core' | 'stretch' | 'consolidation' {
  if (rate >= 0.8) return 'warmup';
  if (rate >= 0.65) return 'core';
  if (rate >= 0.55) return 'stretch';
  return 'consolidation';
}

function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function splitHalves<T>(arr: T[]): [T[], T[]] {
  if (arr.length < 2) return [arr, []];
  const mid = Math.floor(arr.length / 2);
  return [arr.slice(0, mid), arr.slice(mid)];
}

function deriveCueSupportSignal(
  slug: string,
  rows: AdaptationTrialRow[],
): DigestSignal | null {
  const cueDep = rows.map((r) => r.cue_dependency).filter((v): v is number => v != null);
  if (cueDep.length < 6) return null;

  const [first, second] = splitHalves(cueDep);
  const delta = meanOf(second) - meanOf(first);
  const absDelta = Math.abs(delta);
  if (absDelta < 0.1) return null; // ambiguous → omit

  const direction: 'less' | 'more' = delta < 0 ? 'less' : 'more';
  const consistency =
    second.filter((v) => (direction === 'less' ? v < meanOf(first) : v > meanOf(first))).length /
    second.length;
  const effectSize = Math.min(1, absDelta / 0.5);

  return {
    kind: 'cue_support_changed',
    direction,
    dimension: 'cue_dependency',
    slug,
    trials: rows.length,
    confidence: provisionalConfidence({ trials: rows.length, effectSize, consistency }),
  };
}

function deriveTaskComplexitySignal(
  slug: string,
  rows: AdaptationTrialRow[],
): DigestSignal | null {
  const changes = rows
    .map((r) => r.difficulty_change_direction)
    .filter((d): d is string => d === 'up' || d === 'down');
  if (changes.length < 2) return null;
  const ups = changes.filter((d) => d === 'up').length;
  const downs = changes.filter((d) => d === 'down').length;
  if (ups === downs) return null;
  const direction: 'harder' | 'simpler' = ups > downs ? 'harder' : 'simpler';
  const dominant = Math.max(ups, downs);
  const consistency = dominant / changes.length;
  const effectSize = Math.min(1, dominant / 4);

  return {
    kind: 'task_complexity_changed',
    direction,
    dimension: 'linguistic_complexity',
    slug,
    trials: rows.length,
    confidence: provisionalConfidence({ trials: rows.length, effectSize, consistency }),
  };
}

function deriveSteadinessSignal(
  slug: string,
  rows: AdaptationTrialRow[],
): DigestSignal | null {
  const rates = rows.map((r) => r.success_rate).filter((v): v is number => v != null);
  if (rates.length < 6) return null;
  const mean = meanOf(rates);
  const variance = meanOf(rates.map((r) => (r - mean) ** 2));
  const sd = Math.sqrt(variance);
  if (sd > 0.15) return null; // not steady
  const band = bandFromSuccessRate(mean);

  // Stability is the inverse of variance; consistency proxy = 1 - sd
  const consistency = Math.max(0, 1 - sd / 0.2);
  const effectSize = mean; // higher mean = stronger steadiness signal

  return {
    kind: 'accuracy_held_steady',
    band,
    slug,
    trials: rows.length,
    confidence: provisionalConfidence({ trials: rows.length, effectSize, consistency }),
  };
}

function deriveFatigueSupportSignal(
  slug: string,
  rows: AdaptationTrialRow[],
): DigestSignal | null {
  const fatigueRows = rows.filter(
    (r) => r.fatigue === 'high' || r.fatigue === 'rising',
  );
  if (fatigueRows.length < 3) return null;
  const supportiveResponse = rows.some(
    (r) =>
      r.difficulty_change_direction === 'down' ||
      (r.escalation_blocked === true &&
        (r.escalation_block_reason ?? '').toLowerCase().includes('fatigue')),
  );
  if (!supportiveResponse) return null;
  const consistency = fatigueRows.length / rows.length;
  const effectSize = Math.min(1, fatigueRows.length / 5);

  return {
    kind: 'fatigue_support_activated',
    slug,
    trials: rows.length,
    confidence: provisionalConfidence({ trials: rows.length, effectSize, consistency }),
  };
}

function deriveIndependenceSignal(
  slug: string,
  rows: AdaptationTrialRow[],
): DigestSignal | null {
  const cueDep = rows.map((r) => r.cue_dependency).filter((v): v is number => v != null);
  const diffs = rows.map((r) => r.difficulty).filter((v): v is number => v != null);
  if (cueDep.length < 6 || diffs.length < 2) return null;
  const [firstCue, secondCue] = splitHalves(cueDep);
  const cueDelta = meanOf(secondCue) - meanOf(firstCue);
  if (cueDelta >= -0.1) return null; // not less reliant
  const diffStableOrRose = diffs[diffs.length - 1] >= diffs[0];
  if (!diffStableOrRose) return null;
  const consistency = secondCue.filter((v) => v < meanOf(firstCue)).length / secondCue.length;
  const effectSize = Math.min(1, Math.abs(cueDelta) / 0.5);
  return {
    kind: 'independence_gain',
    dimension: 'independence',
    slug,
    trials: rows.length,
    confidence: provisionalConfidence({ trials: rows.length, effectSize, consistency }),
  };
}

// ---------------------------------------------------------------------------
// Top-level digest.
// ---------------------------------------------------------------------------

export interface SessionDigestResult {
  signals: DigestSignal[];
  insights: ComposedInsight[];
  telemetry: SafetyTelemetryCounters;
}

export interface DigestOptions {
  /** Max user-facing lines. Default 2 (Phase B). */
  maxLines?: number;
  /** Reset telemetry counters before running. Default false (counters accumulate). */
  resetTelemetry?: boolean;
}

const DERIVERS: Array<
  (slug: string, rows: AdaptationTrialRow[]) => DigestSignal | null
> = [
  deriveIndependenceSignal,
  deriveCueSupportSignal,
  deriveTaskComplexitySignal,
  deriveFatigueSupportSignal,
  deriveSteadinessSignal,
];

/**
 * Pure digest. Groups rows by exercise_slug, derives the closed enum of
 * signals per game, then runs them through the safety language layer.
 *
 * Always read-only. Always safe to call with empty input.
 */
export function digestSessionRows(
  rows: AdaptationTrialRow[],
  options: DigestOptions = {},
): SessionDigestResult {
  if (options.resetTelemetry) resetSafetyTelemetry();

  const byGame = new Map<string, AdaptationTrialRow[]>();
  for (const r of rows) {
    if (!r.exercise_slug) continue;
    const list = byGame.get(r.exercise_slug) ?? [];
    list.push(r);
    byGame.set(r.exercise_slug, list);
  }

  const signals: DigestSignal[] = [];
  for (const [slug, gameRows] of byGame) {
    for (const derive of DERIVERS) {
      const sig = derive(slug, gameRows);
      if (!sig) continue;
      signals.push(sig);
      recordSafetyEvent('signalsGenerated', 1, { kind: sig.kind, slug });

      if (sig.confidence === 'low' || sig.confidence === 'insufficient') {
        recordSafetyEvent('signalsBelowConfidenceBar', 1, {
          kind: sig.kind,
          confidence: sig.confidence,
        });
      }

      // Defence-in-depth: probe the would-be phrase for blacklist hits even
      // before composer runs. This catches whitelist regressions early.
      try {
        const probe = resolveSignalToInsight({ ...sig, confidence: 'high' });
        if (probe) assertSafePhrase(probe.text);
      } catch {
        recordSafetyEvent('blacklistTriggerAttempts', 1, { kind: sig.kind });
      }
    }
  }

  const supportSignalsCount = signals.filter((s) => {
    const probe = resolveSignalToInsight({ ...s, confidence: 'high' });
    return probe?.category === 'support';
  }).length;

  const insights = composeInsights(signals, { maxLines: options.maxLines ?? 2 });
  recordSafetyEvent('insightsEmitted', insights.length);

  const supportEmitted = insights.filter((i) => i.category === 'support').length;
  const supportSuppressed = Math.max(0, supportSignalsCount - supportEmitted);
  if (supportSuppressed > 0) {
    recordSafetyEvent('supportLinesSuppressed', supportSuppressed);
  }

  if (insights.length === 0) {
    recordSafetyEvent('emptyOutputs', 1);
  }

  return {
    signals,
    insights,
    telemetry: snapshotSafetyTelemetry(),
  };
}
