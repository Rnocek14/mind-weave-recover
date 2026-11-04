/**
 * Sentence Construction — structural ladder (Phase 2, Wave 2).
 *
 * Expressive grammar-production task: patient assembles or speaks a
 * grammatically valid sentence from word tiles / spoken response.
 * `submitTrial` emits `trialMode: 'production'`. The slug IS added to
 * ADOPTED_TRIAL_MODE_SLUGS — trials route into expressive mastery.
 *
 * Clinical basis & honest scope: see docs/clinical-evidence/sentence-construction.md.
 * TL;DR: Sentence-level production training is supported by Mapping Therapy,
 * TUF (Thompson et al.), and VNeST (Edmonds et al. 2009) — structured
 * complexity progression with scaffold fading. The specific grammar-tier
 * ordering shipped here (SVO → morphology → conjunctions → embeddings →
 * complex) is a CLINICALLY MOTIVATED CALIBRATION DEFAULT, not a literature-
 * proven head-to-head hierarchy. Per-level accuracy bars + bank mapping
 * are tunable.
 *
 * Support ladder (executive/grammar axis, shared with Fix Sentence):
 *   highlight_plus_choice (model heard + tiles)
 *     → choice_based (tiles only, no model)
 *     → open_response (spontaneous spoken production)
 *
 * In-game mapping:
 *   hintUsed = true  → highlight_plus_choice (clinician played model audio)
 *   hintUsed = false → choice_based          (default tile/speech production)
 * All eight shipped stages target accurate CONSTRAINED sentence building.
 * The voice mode still shows the choice words, so it is NOT coded as
 * spontaneous open production. That separate clinical skill is deferred.
 *
 * Phase 1 readiness (matches `clinicalRungs.ts` discipline):
 *   L1–L5 → ready (bank covers SVO through compound across difficulty 1–6)
 *   L6–L8 → thin (subordination, relatives and multi-clause/passive items).
 * No clinical level claims independent spontaneous sentence formulation.
 *
 * Pure module — no I/O, no React.
 */

import type { SupportLevel } from './clinicalProgression';
import { SUPPORT_CREDIT, trialCredit } from './clinicalProgression';
import { computeImplementedCeiling } from './_shared/implementedCeiling';

const SUPPORT_RANK: Record<string, number> = {
  highlight_plus_choice: 0,
  choice_based: 1,
  open_response: 2,
};

function rank(s: SupportLevel): number {
  return SUPPORT_RANK[s] ?? -1;
}

export interface SentenceConstructionLevelSpec {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  minOnTargetAttempts: number;
  minOnTargetAccuracy: number;
  readiness: 'ready' | 'thin' | 'aspirational';
  trialWeight: number;
  contentSelector?: {
    tierKey:
      | 'svo_basic'
      | 'expanded_svo'
      | 'agreement'
      | 'tense_word_order'
      | 'coordinating'
      | 'subordinating'
      | 'relative_clauses'
      | 'multi_clause_passive';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (sentence-production independence):
 *   L1 — Basic SVO with model + tiles (highlight_plus_choice OK)
 *   L2 — Expanded SVO with articles/prepositions, model allowed
 *   L3 — Subject-verb agreement, no model
 *   L4 — Complex word order and tense, tiles only
 *   L5 — Coordinating conjunctions (and/but/or), tiles only
 *   L6 — Subordinating conjunctions (because/when/although), tiles only
 *   L7 — Relative clauses (who/that/which), tiles only
 *   L8 — Multi-clause, conditional and passive sentences, tiles only
 */
export const SENTENCE_CONSTRUCTION_LEVELS: Record<number, SentenceConstructionLevelSpec> = {
  1: {
    level: 1,
    description: 'Basic SVO — model + tiles acceptable',
    targetSupport: 'highlight_plus_choice',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.4,
    contentSelector: { tierKey: 'svo_basic', description: 'Basic Subject-Verb-Object; bank difficulty 1.', implemented: true },
  },
  2: {
    level: 2,
    description: 'Expanded SVO: articles and prepositions — model allowed',
    targetSupport: 'highlight_plus_choice',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'expanded_svo', description: 'Expanded SVO, prepositions and articles; bank difficulty 2.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Subject-verb agreement — tiles, no model',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'agreement', description: 'Agreement morphology; bank difficulty 3.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Complex word order and verb tense — tiles only',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'tense_word_order', description: 'Complex word order and tense; bank difficulties 4–5.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Compound sentences with coordinating conjunctions — tiles only',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'coordinating', description: 'And/but/or joins; bank difficulty 6.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Subordinating clauses — because/when/although',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: {
      tierKey: 'subordinating',
      description: 'Subordinating conjunctions at bank difficulty 7.',
      implemented: true,
    },
  },
  7: {
    level: 7,
    description: 'Relative clauses — embedded who/that/which',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'relative_clauses',
      description: 'Relative clauses at bank difficulty 8.',
      implemented: true,
    },
  },
  8: {
    level: 8,
    description: 'Multi-clause and passive constructions — supported tiles',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'thin',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'multi_clause_passive',
      description: 'Multi-clause, conditional and passive bank difficulties 9–10. Constrained word choices, NOT spontaneous production.',
      implemented: true,
    },
  },
};

export function getSentenceConstructionLevelSpec(level: number): SentenceConstructionLevelSpec {
  return SENTENCE_CONSTRUCTION_LEVELS[level] ?? SENTENCE_CONSTRUCTION_LEVELS[1];
}

export function isOnTargetSentenceConstructionTrial(
  trial: { support: SupportLevel },
  level: number,
): boolean {
  const spec = getSentenceConstructionLevelSpec(level);
  return rank(trial.support) >= rank(spec.targetSupport);
}

export function evidenceMetForSentenceConstructionLevel(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
): boolean {
  const spec = getSentenceConstructionLevelSpec(level);
  const onTarget = trials.filter((t) => isOnTargetSentenceConstructionTrial(t, level));
  if (onTarget.length < spec.minOnTargetAttempts) return false;
  const correct = onTarget.filter((t) => t.correct).length;
  return correct / onTarget.length >= spec.minOnTargetAccuracy;
}

export function calculateSentenceConstructionProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  level: number,
  options: { trialWeight?: number } = {},
): number {
  const spec = getSentenceConstructionLevelSpec(level);
  const weight = options.trialWeight ?? spec.trialWeight;
  let total = 0;
  for (const t of trials) {
    const base = trialCredit(t);
    if (base <= 0) continue;
    if (isOnTargetSentenceConstructionTrial(t, level)) total += base * 1.25;
    else total += base * 0.4;
  }
  return total / weight;
}

export { SUPPORT_CREDIT };

export function highestImplementedSentenceConstructionLevel(): number {
  return computeImplementedCeiling(SENTENCE_CONSTRUCTION_LEVELS);
}
