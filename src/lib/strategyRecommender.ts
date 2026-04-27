/**
 * strategyRecommender — deterministic clinical recommendation engine.
 *
 * Pure function. Takes the per-profile adaptation summary and returns a single
 * therapy focus string + supporting reasoning. No LLM, no randomness — the
 * clinician can audit exactly why each recommendation was made.
 *
 * Order of evaluation matters: safety/fatigue rules win over progression rules.
 */

import type { UserAdaptationProfile } from '@/hooks/useUserAdaptationProfile';

export type StrategyKey =
  | 'reduce_load_and_rest'
  | 'cue_fading'
  | 'phonological_production_support'
  | 'semantic_enrichment'
  | 'memory_and_sequencing_scaffold'
  | 'increase_challenge'
  | 'introduce_novelty'
  | 'continue_current_plan'
  | 'insufficient_data';

export interface StrategyRecommendation {
  key: StrategyKey;
  /** Short clinician-facing label */
  label: string;
  /** One-sentence rationale grounded in the profile data */
  rationale: string;
  /** Confidence (low/medium/high) — mirrors profile.data_confidence with safety overrides */
  confidence: 'low' | 'medium' | 'high';
}

const LABELS: Record<StrategyKey, string> = {
  reduce_load_and_rest: 'Reduce load + rest',
  cue_fading: 'Cue fading',
  phonological_production_support: 'Phonological production support',
  semantic_enrichment: 'Semantic enrichment',
  memory_and_sequencing_scaffold: 'Memory + sequencing scaffold',
  increase_challenge: 'Increase challenge',
  introduce_novelty: 'Introduce novelty',
  continue_current_plan: 'Continue current plan',
  insufficient_data: 'Collect more data',
};

export function recommendStrategy(
  profile: UserAdaptationProfile | null
): StrategyRecommendation {
  if (!profile || profile.data_confidence === 'low') {
    return {
      key: 'insufficient_data',
      label: LABELS.insufficient_data,
      rationale: 'Not enough recent trials to make a confident recommendation.',
      confidence: 'low',
    };
  }

  // Rule 1 — fatigue / repeated frustration wins above everything
  const baseline = profile.engagement_baseline as {
    typical_error_rate?: number;
    sessions_in_window?: number;
  };
  if ((baseline?.typical_error_rate ?? 0) > 0.55) {
    return {
      key: 'reduce_load_and_rest',
      label: LABELS.reduce_load_and_rest,
      rationale: `Error rate is ${Math.round((baseline.typical_error_rate ?? 0) * 100)}% across recent sessions — reduce session length and difficulty before pushing further.`,
      confidence: profile.data_confidence,
    };
  }

  // Rule 2 — high accuracy but heavy cueing → fade cues, don't escalate
  if (
    (profile.cue_dependency_score ?? 0) >= 0.5 &&
    (baseline?.typical_error_rate ?? 1) < 0.3
  ) {
    return {
      key: 'cue_fading',
      label: LABELS.cue_fading,
      rationale: `Accuracy is good but cue dependency is ${Math.round((profile.cue_dependency_score ?? 0) * 100)}%. Hold difficulty and gradually reduce cue level to build independent retrieval.`,
      confidence: profile.data_confidence,
    };
  }

  // Rule 3 — dominant error type drives the focus
  if (profile.dominant_error_type === 'phonemic') {
    return {
      key: 'phonological_production_support',
      label: LABELS.phonological_production_support,
      rationale: `Phonemic errors dominate (${Math.round((profile.error_type_distribution.phonemic ?? 0) * 100)}% of errors). Bias toward phonological cues, minimal pairs, and articulation scaffolds.`,
      confidence: profile.data_confidence,
    };
  }
  if (profile.dominant_error_type === 'semantic') {
    return {
      key: 'semantic_enrichment',
      label: LABELS.semantic_enrichment,
      rationale: `Semantic errors dominate (${Math.round((profile.error_type_distribution.semantic ?? 0) * 100)}% of errors). Bias toward semantic feature analysis and category-based work.`,
      confidence: profile.data_confidence,
    };
  }
  if (profile.dominant_error_type === 'no_response') {
    return {
      key: 'memory_and_sequencing_scaffold',
      label: LABELS.memory_and_sequencing_scaffold,
      rationale: `Retrieval failures dominate. Add structured prompts (Who? What? Then?), shorten task length, and build delayed recall gradually.`,
      confidence: profile.data_confidence,
    };
  }

  // Rule 4 — plateau without dominant error → novelty
  if (profile.plateau_flag && profile.plateau_domains.length > 0) {
    return {
      key: 'introduce_novelty',
      label: LABELS.introduce_novelty,
      rationale: `Plateau detected in ${profile.plateau_domains.join(', ')}. Rotate to less-played exercises in this domain to break the loop.`,
      confidence: profile.data_confidence,
    };
  }

  // Rule 5 — fast accuracy, low cue use → push
  if (
    (profile.cue_dependency_score ?? 1) < 0.25 &&
    (baseline?.typical_error_rate ?? 1) < 0.25 &&
    (profile.latency_trend_pct ?? 100) < 10
  ) {
    return {
      key: 'increase_challenge',
      label: LABELS.increase_challenge,
      rationale: `High accuracy with minimal cueing and stable response time. Safe to step up difficulty.`,
      confidence: profile.data_confidence,
    };
  }

  return {
    key: 'continue_current_plan',
    label: LABELS.continue_current_plan,
    rationale: `Performance is mixed but stable. Continue current plan and re-evaluate after the next session.`,
    confidence: profile.data_confidence,
  };
}
