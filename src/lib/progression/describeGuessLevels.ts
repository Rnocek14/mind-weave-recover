/**
 * Describe & Guess — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the discourse adaptation engine
 * with the existing cueLevel 0–3 telemetry mapping. No progression hook,
 * no difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/describe-guess.md.
 * TL;DR: SFA-style feature production (Boyle & Coelho; Maddy meta-analysis)
 * with the patient as describer and the system as guesser. The 3-tier
 * complexity progression (concrete/high-frequency → mixed → abstract /
 * low-imageability) is a clinically motivated design default. Per-level
 * enforcement numerics are intentionally omitted — runtime does not yet
 * enforce them.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type DescribeGuessLevelSpec = DesignOfRecordLevelSpec;

export const DESCRIBE_GUESS_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'High-frequency concrete target — accept partial feature set',
    targetSupport: 'carrier_or_full_model',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'concrete_hf_partial', description: 'Bank tier 1: everyday objects. Cue ladder still surfaced.', implemented: false },
  },
  2: {
    level: 2,
    description: 'High-frequency concrete target — full SFA feature set expected',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'concrete_hf_full', description: 'Bank tier 1, fuller feature coverage.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Mid-frequency concrete — system guesses without category prime',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'concrete_mf', description: 'Bank tier 1–2 boundary.', implemented: false },
  },
  4: {
    level: 4,
    description: 'Mixed concrete / mid-abstract — patient leads with function',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'mixed_function_led', description: 'Bank tier 2: function-led describes preferred over perceptual.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Mid-abstract — associative features count',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'mid_abstract', description: 'Bank tier 2 with associative-feature credit.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Low-frequency / abstract — full SFA without cue prompts',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'low_freq_abstract', description: 'Bank tier 3, sparse.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Abstract / low-imageability — patient resists cue temptation',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'abstract_no_cue', description: 'Bank tier 3 with cue suppression intent.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Spontaneous SFA on novel targets — design-of-record',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'novel_spontaneous', description: 'No runtime mode that draws from a novel-target bank.', implemented: false },
  },
};
