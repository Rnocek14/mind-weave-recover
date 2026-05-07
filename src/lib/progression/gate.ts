/**
 * Shadow Progression Gate — pure governance simulation.
 *
 * Phase: S1 (per docs/shadow-gate-spec.md §11).
 *
 * This module is a PURE FUNCTION ONLY.
 *   - No I/O, no clocks, no Supabase, no React.
 *   - No side effects.
 *   - Not wired into mastery, level_up, scaffold_withdraw, or any UI.
 *   - Not exported from any runtime barrel that touches enforcement.
 *
 * Policy source: docs/progression-gating-spec.md §4 (rule → verdict table)
 *                docs/progression-gating-spec.md §4a (D1/D2/D3 timing)
 *                docs/shadow-gate-spec.md            (output shape, non-goals)
 *
 * Discipline:
 *   - Adopted-slug gating: only photo-naming participates in v0.1. All
 *     other slugs return { decision: 'pass', reasons: ['slug_not_adopted'] }.
 *   - Strictest-wins ordering: drop > delay > annotate > pass.
 *   - Deterministic tie-break: lexicographic by rule_id.
 *   - `delay` semantics in v0.1 mean "next session only". Trial-count
 *     deferral is represented but not yet consumed by any caller.
 *   - `annotate` is preserved as an explicit verdict so we can later
 *     measure whether it ever differs from `pass` in practice.
 *
 * What this is NOT:
 *   - Not a rule engine. It only consults pre-computed anomalies.
 *   - Not an enforcement surface.
 *   - Not aware of receptive / assisted / weighted mastery.
 *   - Not aware of real-time in-session D1/D2 synthetic gating.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GateSurface =
  | 'mastery_write'
  | 'level_up'
  | 'scaffold_withdraw'
  | 'visible_progress';

export type GateDecision = 'pass' | 'drop' | 'delay' | 'annotate';

/** Minimal anomaly shape consumed by the gate. */
export interface GateAnomaly {
  rule_id: string;
  severity?: 'info' | 'warn' | 'error';
  /** Optional structural scope hint; not required. */
  scope?: 'trial' | 'session' | 'user_slug_window';
}

/** Minimal trial shape consumed by the gate. */
export interface GateTrial {
  exercise_slug: string;
  trial_mode?:
    | 'production'
    | 'recognition'
    | 'scaffolded'
    | 'exposure'
    | 'mixed'
    | null;
}

export interface GateInput {
  surface: GateSurface;
  trial: GateTrial;
  /** Anomalies pinned to the specific trial under consideration. */
  trialAnomalies?: GateAnomaly[];
  /** Anomalies for the trial's session (post-hoc, next-session impact). */
  sessionAnomalies?: GateAnomaly[];
  /** Cross-session window anomalies (D7 delay, D8/D9 scaffold). */
  windowAnomalies?: GateAnomaly[];
  /** For `delay` verdicts that need to know how much clean evidence exists. */
  recentCleanTrials?: number;
  /** Stamped onto the decision so consumers can attribute behavior. */
  checklistVersion?: string;
}

export interface ShadowGateDecision {
  surface: GateSurface;
  decision: GateDecision;
  rule_ids: string[];
  reasons: string[];
  /** Frozen minimal view of inputs that drove this decision. */
  inputs_snapshot: {
    exercise_slug: string;
    trial_mode: GateTrial['trial_mode'] | undefined;
    trial_anomaly_ids: string[];
    session_anomaly_ids: string[];
    window_anomaly_ids: string[];
    recent_clean_trials?: number;
  };
  would_change: boolean;
  checklist_version: string;
}

// ---------------------------------------------------------------------------
// Adopted-slug gating
// ---------------------------------------------------------------------------

/**
 * v0.1 adopted slug set. Mirrors mastery routing's adoption set on purpose:
 * the shadow gate only learns from slugs whose telemetry contracts are
 * verified end-to-end. Expanding this set is a separate decision after S2/S3
 * dev review (see docs/shadow-gate-spec.md §9).
 */
/**
 * Exported solely so the version-discipline test can fingerprint the set.
 * Not for runtime mutation. Treat as frozen.
 */
export const __INTERNAL_ADOPTED_GATE_SLUGS: ReadonlySet<string> = new Set<string>([
  'photo-naming',
]);
const ADOPTED_GATE_SLUGS = __INTERNAL_ADOPTED_GATE_SLUGS;

export function isAdoptedForGate(exerciseSlug: string): boolean {
  return ADOPTED_GATE_SLUGS.has((exerciseSlug || '').toLowerCase());
}

// ---------------------------------------------------------------------------
// Policy table (rule × surface → verdict)
// ---------------------------------------------------------------------------

type PerSurfacePolicy = Partial<
  Record<
    GateSurface,
    | { decision: 'drop'; reason: string }
    | { decision: 'delay'; reason: string; trials_required?: number }
    | { decision: 'annotate'; reason: string }
  >
>;

/**
 * Authoritative policy from docs/progression-gating-spec.md §4.
 *
 * Rules absent from a given surface contribute `pass` for that surface.
 * Rules absent from this table entirely contribute `pass` everywhere
 * (so unknown future rules cannot silently start gating).
 */
export const __INTERNAL_POLICY: Record<string, PerSurfacePolicy> = {
  // Schema invariants — corrupt trials cannot be trusted for any purpose.
  S1: { mastery_write: { decision: 'drop', reason: 'schema_invariant' } },
  S2: { mastery_write: { decision: 'drop', reason: 'schema_invariant' } },
  S3: { mastery_write: { decision: 'drop', reason: 'schema_invariant' } },
  S4: { mastery_write: { decision: 'drop', reason: 'schema_invariant' } },
  S5: { mastery_write: { decision: 'drop', reason: 'schema_invariant' } },
  S6: {
    mastery_write: {
      decision: 'drop',
      reason: 'boolean_granularity_carries_graded_fields',
    },
  },
  S7: {
    mastery_write: {
      decision: 'drop',
      reason: 'graded_granularity_missing_graded_score',
    },
  },
  S8: {
    mastery_write: {
      decision: 'drop',
      reason: 'multi_dim_missing_score_vector',
    },
  },

  // Granular fields without archetype/axis — usable but un-routable.
  S10: {
    mastery_write: {
      decision: 'annotate',
      reason: 'granular_without_archetype_or_axis',
    },
  },

  // production+correct with empty response_text — likely ASR misroute.
  C1: {
    mastery_write: {
      decision: 'delay',
      reason: 'production_correct_empty_response',
      trials_required: 1,
    },
  },

  // Scaffolded trial with no scaffold signal — count toward mastery
  // but NOT toward scaffold withdrawal evidence.
  C3: {
    mastery_write: {
      decision: 'annotate',
      reason: 'scaffolded_without_scaffold_signal',
    },
    scaffold_withdraw: {
      decision: 'drop',
      reason: 'scaffolded_without_scaffold_signal',
    },
  },

  // Exposure trials must never be judged.
  C4: { mastery_write: { decision: 'drop', reason: 'exposure_judged' } },

  // Archetype/axis mismatches — usable but route only via declared axis.
  C6: {
    mastery_write: {
      decision: 'annotate',
      reason: 'archetype_axis_mismatch',
    },
  },
  C7: {
    mastery_write: {
      decision: 'annotate',
      reason: 'archetype_axis_mismatch_pressure',
    },
  },
  C8: {
    mastery_write: {
      decision: 'annotate',
      reason: 'open_ended_with_boolean_granularity',
    },
  },

  // Session-scope production share too low — block next-session UP.
  D1: {
    level_up: {
      decision: 'drop',
      reason: 'production_share_too_low_next_session',
    },
  },

  // Recognition inflation — block next-session UP and withdrawal.
  D2: {
    level_up: {
      decision: 'drop',
      reason: 'recognition_inflation_next_session',
    },
    scaffold_withdraw: {
      decision: 'drop',
      reason: 'recognition_inflation_next_session',
    },
  },

  // Scaffold inflation — block next-session withdrawal only.
  D3: {
    scaffold_withdraw: {
      decision: 'drop',
      reason: 'scaffold_inflation_next_session',
    },
  },

  // Logger gap — entire session is interpretively suspect.
  D4: {
    mastery_write: {
      decision: 'drop',
      reason: 'session_logger_gap',
    },
  },

  // Reversed signals — surface to clinician, no automatic action.
  D5: {
    mastery_write: {
      decision: 'annotate',
      reason: 'recognition_vs_production_reversed',
    },
  },
  D6: {
    mastery_write: {
      decision: 'annotate',
      reason: 'scaffold_vs_production_reversed',
    },
  },

  // 100% production over ≥10 trials — likely mislabel; require confirmation.
  D7: {
    level_up: {
      decision: 'delay',
      reason: 'suspicious_perfect_production',
      trials_required: 0, // trial-count not used; semantics = next session
    },
  },

  // Cross-session scaffold creep / withdrawal regression — block withdrawal.
  D8: {
    scaffold_withdraw: { decision: 'drop', reason: 'scaffold_creep_window' },
  },
  D9: {
    scaffold_withdraw: {
      decision: 'drop',
      reason: 'withdrawal_regression_window',
    },
  },
};

// ---------------------------------------------------------------------------
// Strictest-wins ordering
// ---------------------------------------------------------------------------

const RANK: Record<GateDecision, number> = {
  pass: 0,
  annotate: 1,
  delay: 2,
  drop: 3,
};

interface RuleHit {
  rule_id: string;
  decision: GateDecision;
  reason: string;
}

function applyPolicyForRule(
  ruleId: string,
  surface: GateSurface,
): RuleHit | null {
  const policy = POLICY[ruleId];
  if (!policy) return null;
  const entry = policy[surface];
  if (!entry) return null;
  return { rule_id: ruleId, decision: entry.decision, reason: entry.reason };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Pure governance simulation. Returns what the platform WOULD decide at the
 * given surface for the given trial + anomaly context, without performing
 * any side effect.
 */
export function evaluateGate(input: GateInput): ShadowGateDecision {
  const surface = input.surface;
  const slug = input.trial.exercise_slug || '';
  const checklistVersion = input.checklistVersion ?? 'unset';

  const trialAnoms = input.trialAnomalies ?? [];
  const sessionAnoms = input.sessionAnomalies ?? [];
  const windowAnoms = input.windowAnomalies ?? [];

  const snapshot = {
    exercise_slug: slug,
    trial_mode: input.trial.trial_mode,
    trial_anomaly_ids: trialAnoms.map((a) => a.rule_id),
    session_anomaly_ids: sessionAnoms.map((a) => a.rule_id),
    window_anomaly_ids: windowAnoms.map((a) => a.rule_id),
    recent_clean_trials: input.recentCleanTrials,
  };

  // Adopted-slug gating: pass with explicit reason.
  if (!isAdoptedForGate(slug)) {
    return {
      surface,
      decision: 'pass',
      rule_ids: [],
      reasons: ['slug_not_adopted'],
      inputs_snapshot: snapshot,
      would_change: false,
      checklist_version: checklistVersion,
    };
  }

  // Collect every rule hit for this surface across all anomaly buckets.
  const allAnoms: GateAnomaly[] = [...trialAnoms, ...sessionAnoms, ...windowAnoms];
  const hits: RuleHit[] = [];
  for (const a of allAnoms) {
    const hit = applyPolicyForRule(a.rule_id, surface);
    if (hit) hits.push(hit);
  }

  if (hits.length === 0) {
    return {
      surface,
      decision: 'pass',
      rule_ids: [],
      reasons: [],
      inputs_snapshot: snapshot,
      would_change: false,
      checklist_version: checklistVersion,
    };
  }

  // Strictest-wins, lexicographic tie-break by rule_id.
  hits.sort((a, b) => {
    const dr = RANK[b.decision] - RANK[a.decision];
    if (dr !== 0) return dr;
    return a.rule_id.localeCompare(b.rule_id);
  });
  const top = hits[0];

  // Carry every contributing rule that matched the top decision tier so
  // downstream analysis can see all co-contributors. Lower-tier hits are
  // dropped from rule_ids/reasons (they did not affect the verdict) but
  // remain in `inputs_snapshot` for full traceability.
  const topTier = hits.filter((h) => h.decision === top.decision);
  const dedupRuleIds = Array.from(new Set(topTier.map((h) => h.rule_id))).sort();
  const reasons = topTier.map((h) => h.reason);

  return {
    surface,
    decision: top.decision,
    rule_ids: dedupRuleIds,
    reasons,
    inputs_snapshot: snapshot,
    would_change: top.decision !== 'pass',
    checklist_version: checklistVersion,
  };
}
