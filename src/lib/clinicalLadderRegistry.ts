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

function rowsFromSpec<T extends PhotoNamingLevelSpec | FixSentenceLevelSpec | MinimalPairsLevelSpec>(
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

  // ── Tier-A telemetry migrated, ladder pending ────────────────────────────
  'meaning-match': {
    slug: 'meaning-match',
    axis: 'comprehension',
    purpose: 'Matches words to meanings; semantic recognition.',
    status: 'telemetry-only',
    telemetryNote: 'recognition_only (baseline) → semantic_cue (after hint)',
  },
  'two-clues': {
    slug: 'two-clues',
    axis: 'lexical',
    purpose: 'Names a target from two semantic clues.',
    status: 'telemetry-only',
    telemetryNote: 'independent (solved cold) → semantic_cue (after anchor)',
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
    status: 'telemetry-only',
    telemetryNote: 'cueLevel 0–2 mapped to semantic support ladder',
  },

  // ── Generic engine (pre-migration) ───────────────────────────────────────
  'detective-mind': {
    slug: 'detective-mind',
    axis: 'executive',
    purpose: 'Inferential reasoning from contextual clues.',
    status: 'generic',
  },
  'multi-step-plan': {
    slug: 'multi-step-plan',
    axis: 'executive',
    purpose: 'Orders and executes multi-step plans.',
    status: 'generic',
  },
  'pattern-match': {
    slug: 'pattern-match',
    axis: 'executive',
    purpose: 'Detects and extends visual/semantic patterns.',
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
    status: 'generic',
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
    status: 'generic',
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
    status: 'generic',
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
        // Full ladders first, then telemetry, then generic
        const rank = { full: 0, 'telemetry-only': 1, generic: 2 } as const;
        return rank[a.status] - rank[b.status] || a.slug.localeCompare(b.slug);
      }),
    }));
}
