/**
 * Thought Continuation — design-of-record ladder (Phase 2, Wave 4).
 *
 * DESIGN-ONLY. Runtime continues to ride the discourse adaptation engine.
 * No progression hook, no difficulty bridge, no mastery routing.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/thought-continuation.md.
 * TL;DR: Discourse cohesion / propositional density work (Wright & Capilouto;
 * MacWhinney CHAT discourse analysis). Ladder advances on cohesion class
 * (single proposition → multi-proposition coherent → multi-proposition with
 * causal/temporal linking → abstract reflection). Per-level enforcement
 * numerics intentionally omitted.
 *
 * Pure module — no I/O, no React.
 */

import type {
  DesignOfRecordLevelSpec,
  DesignOfRecordLevelTable,
} from './_shared/designOfRecord';

export type ThoughtContinuationLevelSpec = DesignOfRecordLevelSpec;

export const THOUGHT_CONTINUATION_LEVELS: DesignOfRecordLevelTable = {
  1: {
    level: 1,
    description: 'Concrete prompt — single on-topic proposition',
    targetSupport: 'choice_based',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'concrete_single_prop', description: 'Bank tier 1 prompts; one coherent proposition.', implemented: false },
  },
  2: {
    level: 2,
    description: 'Concrete prompt — two linked propositions',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'concrete_two_props', description: 'Bank tier 1 with multi-proposition expectation.', implemented: false },
  },
  3: {
    level: 3,
    description: 'Everyday prompt — multi-proposition coherent extension',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'everyday_coherent', description: 'Bank tier 2 with coherence credit.', implemented: false },
  },
  4: {
    level: 4,
    description: 'Everyday prompt — explicit causal or temporal linking',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'everyday_causal_temporal', description: 'Bank tier 2 with connective-use expectation.', implemented: false },
  },
  5: {
    level: 5,
    description: 'Reflective prompt — opinion or evaluation expressed',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'reflective_opinion', description: 'Bank tier 2–3 boundary; stance taking.', implemented: false },
  },
  6: {
    level: 6,
    description: 'Reflective prompt — opinion + supporting reason',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'reflective_supported', description: 'Bank tier 3 with reason-giving expected.', implemented: false },
  },
  7: {
    level: 7,
    description: 'Abstract prompt — hypothetical or counterfactual extension',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'abstract_hypothetical', description: 'Bank tier 3 sparse; hypothetical framing.', implemented: false },
  },
  8: {
    level: 8,
    description: 'Sustained spontaneous reflection on novel prompts — design-of-record',
    targetSupport: 'open_response',
    readiness: 'aspirational',
    contentSelector: { tierKey: 'novel_sustained', description: 'No runtime mode for novel-prompt bank or sustained-turn scoring.', implemented: false },
  },
};
