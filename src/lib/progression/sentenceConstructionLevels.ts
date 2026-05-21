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
 * Note: "open_response" is the aspirational L7+ target but is not directly
 * observable from the current game UI (tiles are always present); rungs
 * targeting it stay aspirational until a tile-suppressed mode ships.
 *
 * Phase 1 readiness (matches `clinicalRungs.ts` discipline):
 *   L1–L5 → ready (bank covers SVO through compound across difficulty 1–6)
 *   L6–L7 → thin  (relative clauses + passive bank present but sparse)
 *   L8    → aspirational (open spontaneous production has no tile-suppressed
 *           runtime mode; ceiling clamp blocks promotion)
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
      | 'articles_tense'
      | 'pronouns_prepositions'
      | 'conjunctions'
      | 'compound'
      | 'relative_clauses'
      | 'passive_voice'
      | 'open_complex';
    description: string;
    implemented: boolean;
  };
}

/**
 * Level ladder (sentence-production independence):
 *   L1 — Basic SVO with model + tiles (highlight_plus_choice OK)
 *   L2 — SVO + articles, model support still acceptable
 *   L3 — Tense + pronouns, tile-based production without model
 *   L4 — Prepositions + simple conjunctions, tiles only
 *   L5 — Compound sentences (and/but/because), tiles only
 *   L6 — Relative clauses (thin bank)
 *   L7 — Passive voice / complex embedding (thin bank)
 *   L8 — Open spontaneous complex production (aspirational; no tile-
 *        suppressed runtime mode yet)
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
    description: 'SVO + articles — model still OK',
    targetSupport: 'highlight_plus_choice',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 0.55,
    contentSelector: { tierKey: 'articles_tense', description: 'SVO with articles + simple tense; bank difficulty 2.', implemented: true },
  },
  3: {
    level: 3,
    description: 'Tense + pronouns — tiles, no model',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.7,
    readiness: 'ready',
    trialWeight: 0.75,
    contentSelector: { tierKey: 'articles_tense', description: 'Tense + pronoun substitutions; bank difficulty 3.', implemented: true },
  },
  4: {
    level: 4,
    description: 'Prepositions + simple conjunctions — tiles only',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.0,
    contentSelector: { tierKey: 'pronouns_prepositions', description: 'Prepositions + simple conjunctions; bank difficulty 4.', implemented: true },
  },
  5: {
    level: 5,
    description: 'Compound sentences — independent tile production',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 5,
    minOnTargetAccuracy: 0.75,
    readiness: 'ready',
    trialWeight: 1.25,
    contentSelector: { tierKey: 'compound', description: 'And/but/because joins; bank difficulty 5–6.', implemented: true },
  },
  6: {
    level: 6,
    description: 'Relative clauses — extended embedding',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 1.7,
    contentSelector: {
      tierKey: 'relative_clauses',
      description: 'Relative clauses (who/which/that) at bank difficulty 7; bank is thin — rotation only.',
      implemented: true,
    },
  },
  7: {
    level: 7,
    description: 'Passive voice / complex embedding',
    targetSupport: 'choice_based',
    minOnTargetAttempts: 6,
    minOnTargetAccuracy: 0.8,
    readiness: 'thin',
    trialWeight: 2.0,
    contentSelector: {
      tierKey: 'passive_voice',
      description: 'Passive / complex embedded clauses at bank difficulty 8; thin bank.',
      implemented: true,
    },
  },
  8: {
    level: 8,
    description: 'Open spontaneous complex production — design-of-record',
    targetSupport: 'open_response',
    minOnTargetAttempts: 8,
    minOnTargetAccuracy: 0.85,
    readiness: 'aspirational',
    trialWeight: 2.5,
    contentSelector: {
      tierKey: 'open_complex',
      description: 'No tile-suppressed runtime mode exists — ceiling clamp blocks live promotion until open production UI ships.',
      implemented: false,
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
