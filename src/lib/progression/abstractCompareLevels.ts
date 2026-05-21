/**
 * Abstract Compare — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the discourse adaptation engine.
 * No progression hook, no difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/abstract-compare.md.
 * TL;DR: Concept-comparison / similarities-and-differences subtests
 * (WAIS Similarities; Boston Diagnostic Aphasia Examination — Auditory
 * Comprehension of Concept Comparisons). Ladder advances on conceptual
 * abstraction (concrete category-mates → cross-category → abstract /
 * superordinate). Per-level enforcement numerics intentionally omitted.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type AbstractCompareLevelSpec = DesignOfRecordLevelSpec;

export const ABSTRACT_COMPARE_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'Same-category concrete pair — one similarity accepted',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'same_cat_concrete_one', description: 'Bank tier 1: apple/orange.', implemented: false },
  },
  2: {
    level: 2,
    description: 'Same-category concrete pair — similarity + difference',
    targetSupport: 'semantic_cue',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'same_cat_concrete_both', description: 'Bank tier 1 with both dimensions.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Cross-category concrete pair — superordinate named',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'cross_cat_super', description: 'Bank tier 2: hammer/screwdriver → tools.', implemented: false },
  },
  4: {
    level: 4,
    description: 'Cross-category pair — functional similarity beyond category',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'cross_cat_functional', description: 'Bank tier 2 with functional-similarity credit.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Mixed concrete/abstract pair — relational similarity',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'mixed_relational', description: 'Bank tier 2–3 boundary.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Abstract pair — single shared dimension surfaced',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'abstract_single', description: 'Bank tier 3: freedom/justice.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Abstract pair — multi-dimensional comparison',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'abstract_multi', description: 'Bank tier 3 sparse; ≥2 dimensions.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Spontaneous comparison on novel abstract pairs — design-of-record',
    targetSupport: 'independent',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'novel_abstract', description: 'No runtime mode for novel-pair bank or dimensionality scoring.', implemented: false },
  },
};
