/**
 * Clinical Ladder Registry — single source of truth for the /games index page.
 *
 * Maps each canonical exercise slug to its per-level clinical ladder spec
 * (when one exists). When you ship a new `xxxLevels.ts` module, add ONE
 * entry here and the Clinical Library page automatically upgrades that
 * game's card from "generic engine" → "full L1–L8 ladder".
 *
 * Honesty discipline (matches Decision-Based Design + Clinical Safety):
 *   - status: 'full'           — real L1–L8 spec module, shows full table
 *   - status: 'telemetry-only' — Tier-A useTrialSubmission migrated, no ladder yet
 *   - status: 'generic'        — rides generic 1–10 adaptation engine, no ladder
 *
 * Pure module — no I/O, no React. Safe to import anywhere.
 */

import {
  PHOTO_NAMING_LEVELS,
  type PhotoNamingLevelSpec,
} from './progression/photoNamingLevels';
import {
  FIX_SENTENCE_LEVELS,
  type FixSentenceLevelSpec,
} from './progression/fixSentenceLevels';
import {
  MINIMAL_PAIRS_LEVELS,
  type MinimalPairsLevelSpec,
} from './progression/minimalPairsLevels';
import {
  SEMANTIC_FEATURES_LEVELS,
  type SemanticFeaturesLevelSpec,
} from './progression/semanticFeaturesLevels';
import {
  MEANING_MATCH_LEVELS,
  type MeaningMatchLevelSpec,
} from './progression/meaningMatchLevels';
import {
  TWO_CLUES_LEVELS,
  type TwoCluesLevelSpec,
} from './progression/twoCluesLevels';
import {
  CATEGORY_FLUENCY_LEVELS,
  type CategoryFluencyLevelSpec,
} from './progression/categoryFluencyLevels';
import {
  SENTENCE_CONSTRUCTION_LEVELS,
  type SentenceConstructionLevelSpec,
} from './progression/sentenceConstructionLevels';
import {
  MULTI_STEP_PLANNING_LEVELS,
  type MultiStepPlanningLevelSpec,
} from './progression/multiStepPlanningLevels';
import {
  DETECTIVE_MIND_LEVELS,
  type DetectiveMindLevelSpec,
} from './progression/detectiveMindLevels';
import {
  SYNONYM_GENERATOR_LEVELS,
  type SynonymGeneratorLevelSpec,
} from './progression/synonymGeneratorLevels';
import {
  DUAL_LOAD_NAMING_LEVELS,
  type DualLoadNamingLevelSpec,
} from './progression/dualLoadNamingLevels';
import {
  PHONOLOGICAL_AWARENESS_LEVELS,
  type PhonologicalAwarenessLevelSpec,
} from './progression/phonologicalAwarenessLevels';
import type { SupportLevel } from './progression/clinicalProgression';
import { deriveTierStatusFromSpec, type TierStatus } from './clinicalIntegrity';

/**
 * Ladder shipping status — honest contract surfaced in /games and on each
 * game's About page.
 *
 *   - full           — real L1–L8 spec + selector + bridge. Engine adapts.
 *   - structural     — same 5-artifact pattern as `full`, but L6–L8 banks
 *                      are thin/aspirational. Each row's `readiness` carries
 *                      the honesty.
 *   - design-only    — clinical design-of-record published; runtime still
 *                      uses the generic 1–10 engine. Rows describe the
 *                      *intended* ladder; attempts/accuracy not yet
 *                      enforced per level.
 *   - telemetry-only — Tier-A useTrialSubmission migrated, no ladder yet.
 *   - generic        — legacy state; should disappear once every game has
 *                      at least a design-only entry.
 */
export type LadderStatus =
  | 'full'
  | 'structural'
  | 'design-only'
  | 'telemetry-only'
  | 'generic';

export type ClinicalAxis =
  | 'lexical'
  | 'comprehension'
  | 'discourse'
  | 'executive'
  | 'acoustic'
  | 'motor';

export interface LadderRow {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  /** Omitted for design-only rows (no runtime mastery enforcement yet). */
  minOnTargetAttempts?: number;
  /** Omitted for design-only rows. */
  minOnTargetAccuracy?: number;
  /** Phase 1 readiness flag (only some games provide this). */
  readiness?: 'ready' | 'thin' | 'aspirational';
  /** PR7: per-tier integrity status surfaced in /games. */
  tierStatus: TierStatus;
  tierStatusDetail: string;
  /** PR7: clinician-readable content label from the level spec, when present. */
  contentTierLabel?: string;
}

export interface EvidenceBasis {
  docPath: string;
  tldr: string;
}

export interface ClinicalLadderEntry {
  slug: string;
  axis: ClinicalAxis;
  /** One-line clinical purpose. */
  purpose: string;
  status: LadderStatus;
  /** For telemetry-only games: which SupportLevel ladder they emit. */
  telemetryNote?: string;
  /** L1–L8 rows. Only present when status === 'full'. */
  rows?: LadderRow[];
  /** PR7: pointer to the clinical-evidence write-up, when one exists. */
  evidenceBasis?: EvidenceBasis;
}

function rowsFromSpec<T extends PhotoNamingLevelSpec | FixSentenceLevelSpec | MinimalPairsLevelSpec | SemanticFeaturesLevelSpec | MeaningMatchLevelSpec | TwoCluesLevelSpec | CategoryFluencyLevelSpec | SentenceConstructionLevelSpec | MultiStepPlanningLevelSpec | DetectiveMindLevelSpec | SynonymGeneratorLevelSpec>(
  slug: string,
  table: Record<number, T>,
): LadderRow[] {
  return Object.values(table)
    .sort((a, b) => a.level - b.level)
    .map((spec) => {
      const status = deriveTierStatusFromSpec(slug, spec.level, spec as { contentSelector?: { implemented?: boolean; description?: string } });
      return {
        level: spec.level,
        description: spec.description,
        targetSupport: spec.targetSupport,
        minOnTargetAttempts: spec.minOnTargetAttempts,
        minOnTargetAccuracy: spec.minOnTargetAccuracy,
        readiness: 'readiness' in spec ? spec.readiness : undefined,
        tierStatus: status.tierStatus,
        tierStatusDetail: status.tierStatusDetail,
        contentTierLabel: (spec as { contentSelector?: { description?: string } }).contentSelector?.description,
      };
    });
}

/**
 * The registry. Keyed by canonical slug.
 *
 * TO ADD A NEW LADDER:
 *   1. Create src/lib/progression/<slug>Levels.ts exporting LEVELS table.
 *   2. Import it above and flip the entry below to status: 'full' with
 *      rows: rowsFromSpec(MY_LEVELS).
 */
export const CLINICAL_LADDER_REGISTRY: Record<string, ClinicalLadderEntry> = {
  // ── Full ladders (real L1–L8 specs) ──────────────────────────────────────
  'photo-naming': {
    slug: 'photo-naming',
    axis: 'lexical',
    purpose: 'Names objects from photos with fading support.',
    status: 'full',
    rows: rowsFromSpec('photo-naming', PHOTO_NAMING_LEVELS),
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/photo-naming.md',
      tldr: 'Cueing hierarchy + frequency banding are clinically motivated calibration defaults; not a literature-proven cue order.',
    },
  },
  'fix-sentence': {
    slug: 'fix-sentence',
    axis: 'executive',
    purpose: 'Detects and repairs errors in structured sentences.',
    status: 'full',
    rows: rowsFromSpec('fix-sentence', FIX_SENTENCE_LEVELS),
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/fix-sentence.md',
      tldr: 'Staged scaffold-fading rationale (Mapping Therapy / TUF / VNeST); specific scaffold order is a design choice, not a head-to-head proven hierarchy.',
    },
  },
  'minimal-pairs': {
    slug: 'minimal-pairs',
    axis: 'acoustic',
    purpose: 'Discriminates similar-sounding word pairs by ear.',
    status: 'full',
    rows: rowsFromSpec('minimal-pairs', MINIMAL_PAIRS_LEVELS),
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/minimal-pairs.md',
      tldr: 'Place→manner→voicing ordering reflects clinical practice patterns; L7–L8 conditions (degraded signal / triplet RT) are not yet implemented.',
    },
  },

  // ── Tier-A structural ladders (Wave 1) ───────────────────────────────────
  'meaning-match': {
    slug: 'meaning-match',
    axis: 'comprehension',
    purpose: 'Matches words to meanings; semantic recognition.',
    status: 'structural',
    rows: rowsFromSpec('meaning-match', MEANING_MATCH_LEVELS),
    telemetryNote: 'recognition_only (baseline) → semantic_cue (after hint). Receptive task — NOT routed into expressive mastery; receptive mastery track deferred.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/meaning-match.md',
      tldr: 'Comprehension hierarchy (concrete→abstract, distant→close distractors) is grounded; per-level thresholds and tier mapping are clinically motivated calibration defaults. L6–L7 thin; L8 aspirational. Receptive-safe routing.',
    },
  },
  'two-clues': {
    slug: 'two-clues',
    axis: 'lexical',
    purpose: 'Names a target from two semantic clues.',
    status: 'structural',
    rows: rowsFromSpec('two-clues', TWO_CLUES_LEVELS),
    telemetryNote: 'independent (solved cold) → semantic_cue (after anchor)',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/two-clues.md',
      tldr: 'SFA-style converging-features retrieval (Boyle & Coelho; Maddy meta-analysis); per-level thresholds + bank mapping are clinically motivated calibration defaults. L6–L7 thin; L8 aspirational.',
    },
  },
  'describe-guess': {
    slug: 'describe-guess',
    axis: 'lexical',
    purpose: 'Produces features so the system guesses the word.',
    status: 'telemetry-only',
    telemetryNote: 'cueLevel 0–3 mapped to semantic support ladder',
  },
  'semantic-features': {
    slug: 'semantic-features',
    axis: 'lexical',
    purpose: 'Generates semantic features for a target word (SFA).',
    status: 'structural',
    rows: rowsFromSpec('semantic-features', SEMANTIC_FEATURES_LEVELS),
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/semantic-features.md',
      tldr: 'SFA direction (scaffolded perceptual → independent functional → associative) is well-supported; per-level thresholds + bank-difficulty mapping are clinically motivated calibration defaults. L6–L7 banks are thin; L8 is aspirational.',
    },
  },

  // ── Generic engine (pre-migration) ───────────────────────────────────────
  // ── Tier-A structural ladders (Wave 2) ───────────────────────────────────
  'detective-mind': {
    slug: 'detective-mind',
    axis: 'comprehension',
    purpose: 'Inferential reasoning from contextual clues.',
    status: 'structural',
    rows: rowsFromSpec('detective-mind', DETECTIVE_MIND_LEVELS),
    telemetryNote: 'recognition_only (baseline) → semantic_cue (after highlight hint). Receptive task — NOT routed into expressive mastery; receptive mastery track deferred. Same precedent as MeaningMatch / MinimalPairs.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/detective-mind.md',
      tldr: 'Inferential discourse-comprehension hierarchy (factual → bridging → multi-step inference) grounded in Sohlberg/Mateer APT-II and clinical practice patterns. Per-level thresholds + tier mapping are clinically motivated calibration defaults. L6–L7 thin; L8 aspirational. Receptive-safe routing.',
    },
  },
  'multi-step-plan': {
    slug: 'multi-step-plan',
    axis: 'executive',
    purpose: 'Orders and executes multi-step plans.',
    status: 'structural',
    rows: rowsFromSpec('multi-step-plan', MULTI_STEP_PLANNING_LEVELS),
    telemetryNote: 'open_response on every trial — game UI has no in-trial scaffold; ladder advances on accuracy + sequence-coverage growth at progressively harder content tiers. Expressive discourse — routed into expressive mastery.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/multi-step-planning.md',
      tldr: 'Procedural-discourse training (Sohlberg/Mateer APT; script training; Ulatowska macrostructure). 3-tier complexity collapse is a clinically motivated calibration default against the existing bank. L7 thin; L8 aspirational (no constrained-output runtime mode).',
    },
  },
  'pattern-match': {
    slug: 'pattern-match',
    axis: 'executive',
    purpose: 'Detects and extends visual/semantic patterns.',
    // INTENTIONALLY left `generic`: Pattern Match is a non-linguistic
    // visual / working-memory task (shapes × colors, zero linguistic
    // content). It is NOT aphasia therapy in the strict sense. Per the
    // research doc's Exploratory rating, we leave it on the universal
    // 1–10 adaptation engine without a clinical ladder and exclude it
    // from ADOPTED_TRIAL_MODE_SLUGS so its trials never contaminate the
    // expressive mastery track. Promoting it would require either a
    // working-memory mastery track or a linguistic content overlay —
    // both deferred.
    status: 'generic',
  },
  'abstract-compare': {
    slug: 'abstract-compare',
    axis: 'executive',
    purpose: 'Compares abstract concepts (similarities/differences).',
    status: 'generic',
  },
  'sentence-construction': {
    slug: 'sentence-construction',
    axis: 'executive',
    purpose: 'Builds grammatically valid sentences from constraints.',
    status: 'structural',
    rows: rowsFromSpec('sentence-construction', SENTENCE_CONSTRUCTION_LEVELS),
    telemetryNote: 'highlight_plus_choice (model heard) → choice_based (tiles only). Expressive production — routed into expressive mastery.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/sentence-construction.md',
      tldr: 'Mapping Therapy / TUF / VNeST support structured grammar-production training with scaffold fading; specific tier ordering and per-level thresholds are clinically motivated calibration defaults. L6–L7 thin; L8 (open production) aspirational — no tile-suppressed runtime mode yet.',
    },
  },
  'phonological-awareness': {
    slug: 'phonological-awareness',
    axis: 'acoustic',
    purpose: 'Manipulates phonemes within words.',
    status: 'generic',
  },
  'dual-load-naming': {
    slug: 'dual-load-naming',
    axis: 'acoustic',
    purpose: 'Names targets while holding a secondary auditory load.',
    status: 'generic',
  },
  'narrative-retell': {
    slug: 'narrative-retell',
    axis: 'discourse',
    purpose: 'Retells a heard narrative with key elements intact.',
    status: 'generic',
  },
  'category-fluency': {
    slug: 'category-fluency',
    axis: 'discourse',
    purpose: 'Generates category exemplars under time pressure.',
    status: 'structural',
    rows: rowsFromSpec('category-fluency', CATEGORY_FLUENCY_LEVELS),
    telemetryNote: 'independent (no sub-prompt) → semantic_cue (sub-prompt shown). One round = one progression trial.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/category-fluency.md',
      tldr: 'Semantic-category verbal fluency is a long-standing aphasia metric (Henry meta-analysis; Troyer cluster/switch); per-rung minUniqueWords + tier mapping are clinically motivated calibration defaults. L6–L7 thin; L8 aspirational.',
    },
  },
  'thought-continuation': {
    slug: 'thought-continuation',
    axis: 'discourse',
    purpose: 'Continues an open-ended thought spontaneously.',
    status: 'generic',
  },
  'synonym-generator': {
    slug: 'synonym-generator',
    axis: 'lexical',
    purpose: 'Generates synonyms for a target word.',
    status: 'structural',
    rows: rowsFromSpec('synonym-generator', SYNONYM_GENERATOR_LEVELS),
    telemetryNote: 'open_response on every trial — game UI has no in-trial scaffold; ladder advances on match-count growth at progressively harder content tiers. Expressive divergent retrieval — routed into expressive mastery.',
    evidenceBasis: {
      docPath: 'docs/clinical-evidence/synonym-generator.md',
      tldr: 'Divergent lexical-semantic production (SFA, VNeST, verbal-fluency intervention). 3-tier word-abstractness collapse is a clinically motivated calibration default against the existing SYNONYM_PROMPTS bank. L6–L7 thin; L8 aspirational (no constrained-output runtime mode).',
    },
  },
};

export const AXIS_LABEL: Record<ClinicalAxis, string> = {
  lexical: 'Lexical retrieval',
  comprehension: 'Comprehension',
  discourse: 'Discourse',
  executive: 'Executive function',
  acoustic: 'Auditory / acoustic',
  motor: 'Motor',
};

export function entriesByAxis(): Array<{ axis: ClinicalAxis; entries: ClinicalLadderEntry[] }> {
  const order: ClinicalAxis[] = ['lexical', 'comprehension', 'executive', 'acoustic', 'discourse', 'motor'];
  const grouped = new Map<ClinicalAxis, ClinicalLadderEntry[]>();
  for (const entry of Object.values(CLINICAL_LADDER_REGISTRY)) {
    if (!grouped.has(entry.axis)) grouped.set(entry.axis, []);
    grouped.get(entry.axis)!.push(entry);
  }
  return order
    .filter((a) => grouped.has(a))
    .map((axis) => ({
      axis,
      entries: grouped.get(axis)!.sort((a, b) => {
        // Most-shipped first, then design-only / telemetry-only, then generic.
        const rank: Record<LadderStatus, number> = {
          full: 0,
          structural: 1,
          'telemetry-only': 2,
          'design-only': 3,
          generic: 4,
        };
        return rank[a.status] - rank[b.status] || a.slug.localeCompare(b.slug);
      }),
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Design-only helper — build LadderRow[] from a plain L1–L8 spec table that
// has no runtime mastery thresholds. Used by Phase-3 Tier-C entries.
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignRowInput {
  level: number;
  description: string;
  targetSupport: SupportLevel;
  readiness: 'ready' | 'thin' | 'aspirational';
}

export function designOnlyRows(slug: string, rows: DesignRowInput[]): LadderRow[] {
  return rows
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((r) => ({
      level: r.level,
      description: r.description,
      targetSupport: r.targetSupport,
      readiness: r.readiness,
      // No minOnTargetAttempts/Accuracy — design-only rows don't enforce mastery.
      tierStatus: 'planned' as TierStatus,
      tierStatusDetail: `${slug} L${r.level} — clinical design published; runtime uses generic engine.`,
    }));
}
