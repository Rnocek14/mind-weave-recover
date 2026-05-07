/**
 * Progression Archetype System (v0 — spec only, read-only)
 *
 * This module formalizes the architectural decision that came out of the
 * fix_sentence → sentence_construction → minimal_pairs audit sequence:
 *
 *   "Adaptive rehab game" is not a sufficient model.
 *   The platform is a typed neurorehabilitation progression system.
 *   Different cognitive targets require different progression mathematics.
 *
 * Four archetypes are recognised:
 *
 *   I.   Content-Expanding   — difficulty grows by adding new content tiers
 *                              of greater linguistic / cognitive complexity.
 *                              Example: sentence_construction (reference model).
 *
 *   II.  Performance-Pressure — content is finite; difficulty grows by
 *                               environmental / perceptual / temporal load.
 *                               Example: minimal_pairs.
 *
 *   III. Hybrid              — both axes grow simultaneously
 *                              (content depth + executive load).
 *                              Example: detective_mind, dual_load_naming.
 *
 *   IV.  Open-Ended /        — no discrete correctness; difficulty grows
 *        Discourse             by withdrawing scaffolding; mastery signal is
 *                              qualitative + longitudinal, not trial accuracy.
 *                              Example: narrative_retell.
 *
 * IMPORTANT — DO NOT IMPORT FROM RUNTIME CODE YET.
 * This file exists so the next phase can wire archetype-aware progression
 * one game at a time, behind a flag, with type safety. No game hook,
 * useInGameAdaptation, AdaptiveDifficultyController, mastery writer, or
 * UI surface should depend on this module in this PR.
 *
 * Display contract decision (locked):
 *   The visible level shown to patients is ALWAYS a 1–10 facade.
 *   Internal progression state (content tier, pressure dial, support
 *   level, qualitative band) is archetype-specific and never surfaced
 *   directly. The visible 1–10 is a projection of the internal state.
 */

// ---------------------------------------------------------------------------
// Archetype taxonomy
// ---------------------------------------------------------------------------

export type ProgressionArchetype =
  | 'content-expanding'
  | 'performance-pressure'
  | 'hybrid'
  | 'open-ended';

export interface ArchetypeDefinition {
  id: ProgressionArchetype;
  label: string;
  /** One-paragraph clinical description. */
  description: string;
  /** What "harder" actually means for this archetype. */
  difficultyAxis: string;
  /** What "easier" / soft regression looks like at the same visible level. */
  supportAxis: string;
  /** How mastery is judged longitudinally (the dominant signal). */
  masterySignal:
    | 'accuracy'             // I  — trial accuracy at increasing tier
    | 'pressure-retained'    // II — accuracy maintained as dials harden
    | 'per-dial'             // III — independent progress on each axis
    | 'qualitative';         // IV — discourse / scaffolding withdrawal
  /** Whether the engine uses the visible 1–10 directly or projects to it. */
  visibleScaleProjection: 'direct' | 'projected';
  /** Infrastructure this archetype depends on before it can go live. */
  requires: string[];
}

export const ARCHETYPES: Record<ProgressionArchetype, ArchetypeDefinition> = {
  'content-expanding': {
    id: 'content-expanding',
    label: 'Content-Expanding',
    description:
      'Difficulty grows by introducing new content of greater linguistic ' +
      'or cognitive complexity (longer items, rarer syntax, deeper ' +
      'embedding, more abstract targets). Each visible level corresponds ' +
      'to a real new band of stimuli.',
    difficultyAxis: 'content tier (new stimuli of greater complexity)',
    supportAxis: 'cue level, response time, distractor count',
    masterySignal: 'accuracy',
    visibleScaleProjection: 'direct',
    requires: [
      'tier-tagged content bank with ≥15 items per tier (target ≥20)',
      'recency exclusion adopter (per-slug, tier-aware)',
      'cue-dependency safety gate (already in useInGameAdaptation)',
    ],
  },
  'performance-pressure': {
    id: 'performance-pressure',
    label: 'Performance-Pressure',
    description:
      'Content is intrinsically finite (e.g. phonemic contrasts). ' +
      'Difficulty grows by hardening environmental, perceptual, or ' +
      'temporal demands on the same content: timers, SNR, masking, ' +
      'distractor count, voice variability.',
    difficultyAxis: 'pressure dials (timing, noise/SNR, distractors, masking)',
    supportAxis: 'remove dial, slow audio, repeat playback, show spelling',
    masterySignal: 'pressure-retained',
    visibleScaleProjection: 'projected',
    requires: [
      'performance-pressure primitives (timers, noise/SNR injector, dynamic distractor count)',
      'production-vs-exposure typing (echo ≠ scored production)',
      'cleaned + measured content bank (no false minimal pairs)',
      'visible-level projection rule (tier × dial → 1..10)',
    ],
  },
  hybrid: {
    id: 'hybrid',
    label: 'Hybrid (Content + Executive Load)',
    description:
      'Both content depth and executive / dual-task load grow together. ' +
      'Visible level reflects a weighted combination; mastery is judged ' +
      'per axis to avoid one axis hiding regression on the other.',
    difficultyAxis: 'content tier × executive load (dual-task, inference depth)',
    supportAxis: 'drop secondary load, highlight key clue, narrow inference',
    masterySignal: 'per-dial',
    visibleScaleProjection: 'projected',
    requires: [
      'content-expanding infra (per content axis)',
      'performance-pressure infra (per load axis)',
      'per-axis mastery telemetry',
      'visible-level projection rule (content × load → 1..10)',
    ],
  },
  'open-ended': {
    id: 'open-ended',
    label: 'Open-Ended / Discourse',
    description:
      'No discrete correctness. Difficulty grows by withdrawing ' +
      'scaffolding (chunked replay → outline → unaided) and by raising ' +
      'narrative load. Mastery signal is qualitative discourse scoring + ' +
      'longitudinal trend, not per-trial accuracy.',
    difficultyAxis: 'narrative load + scaffolding withdrawal',
    supportAxis: 'chunked replay, outline, proposition prompts, written model',
    masterySignal: 'qualitative',
    visibleScaleProjection: 'projected',
    requires: [
      'discourse signal scorer (already partially in place)',
      'longitudinal qualitative trend store',
      'scaffold-level state machine (separate from accuracy)',
      'visible-level projection rule (load × scaffold → 1..10)',
    ],
  },
};

// ---------------------------------------------------------------------------
// Contract schema — archetype-aware extension of PerGameLevelingContract
// ---------------------------------------------------------------------------

/**
 * A pressure dial is an environmental modifier (not new content) used by
 * Performance-Pressure and Hybrid archetypes.
 */
export interface PressureDial {
  id: string;                        // e.g. 'response_window_ms', 'snr_db'
  label: string;                     // human-readable
  unit?: string;                     // 'ms' | 'dB' | 'count'
  /** Ordered hardening steps from easiest to hardest. */
  steps: Array<number | string>;
  /** Which visible-level band this dial begins to engage in. */
  engagesAtVisibleLevel: number;
}

/**
 * A scaffold level is an Open-Ended support state withdrawn over time.
 */
export interface ScaffoldLevel {
  id: string;        // e.g. 'chunked_replay', 'written_outline'
  label: string;
  order: number;     // 0 = most support, N = unaided
}

export type MasterySignalKind = ArchetypeDefinition['masterySignal'];

/**
 * Trial-level cognitive mode (refines the obsolete echoIsProduction binary).
 *
 * The Photo Naming audit proved that "did they get it right" is not enough:
 * the SAME game can deliver trials in fundamentally different rehabilitation
 * states, and collapsing them inflates recovery curves.
 *
 *   production  — user retrieved the lexical item with no choice set;
 *                 ASR-scored. The only mode that feeds expressive mastery.
 *   recognition — user picked the target from N alternatives. Clinically
 *                 distinct (anomia patients often recognise but cannot
 *                 produce). Feeds receptive/recognition telemetry only.
 *   exposure    — user heard / repeated / was shown the item but no
 *                 graded retrieval was demanded. Never feeds mastery.
 *   scaffolded  — production attempt under explicit cue/support. Counts
 *                 toward production mastery only with a cue-discount.
 *   mixed       — game routes per trial; per-trial mode tag is mandatory.
 */
export type TrialMode =
  | 'production'
  | 'recognition'
  | 'exposure'
  | 'scaffolded'
  | 'mixed';

/**
 * Secondary modifier systems layered on top of the primary archetype.
 * The Photo Naming audit proved archetypes are not mutually exclusive:
 *   photo_naming = primary content-expanding + secondary recognition
 *                  modifier (choice-count dial, phonological foil dial).
 */
export type ArchetypeModifier =
  | 'pressure'      // timer / SNR / masking on top of content ladder
  | 'recognition'   // choice-count + foil-quality dial
  | 'dual-task'     // executive load layered on production
  | 'scaffold-fade' // scaffold withdrawal layered on content
  | 'noise';        // perceptual interference

export interface ProgressionContract {
  slug: string;
  archetype: ProgressionArchetype;

  /** Optional secondary modifier systems (Photo Naming → ['recognition']). */
  secondaryModifiers: ArchetypeModifier[];

  /** Internal honest content scale (NOT what the user sees). */
  contentScale: { min: number; max: number };

  /** Pressure dials (Performance-Pressure / Hybrid / pressure-modified games). */
  performanceDials: PressureDial[];

  /** Scaffold ladder (Open-Ended / scaffold-modified games). */
  scaffolds: ScaffoldLevel[];

  /**
   * Trial-level mode this game emits. 'mixed' REQUIRES per-trial mode tags
   * in telemetry so the mastery writer can route trials correctly.
   *
   * Replaces the obsolete `echoIsProduction: boolean` binary.
   */
  productionMode: TrialMode;

  /**
   * @deprecated Kept temporarily for migration. Derive from productionMode:
   *   production | scaffolded → true
   *   recognition | exposure | mixed → must be split per trial
   */
  echoIsProduction: boolean;

  masterySignal: MasterySignalKind;

  /**
   * Projection rule from internal state → visible 1–10.
   * Declared as a plain string here; the next phase will replace this
   * with a typed projector function per archetype.
   */
  visibleLevelProjection: string;

  notes?: string;
}

// ---------------------------------------------------------------------------
// Per-game archetype declarations
//
// This is the source of truth for "what kind of progression system is
// this game?" — distinct from the existing per-game leveling contract
// (which captures content readiness and weights).
//
// Read-only. No runtime importer yet.
// ---------------------------------------------------------------------------

export const GAME_ARCHETYPES: Record<string, ProgressionArchetype> = {
  // Archetype I — Content-Expanding (reference model)
  sentence_construction: 'content-expanding',
  fix_sentence: 'content-expanding',          // lexical-semantic repair ladder
  photo_naming: 'content-expanding',
  two_clues: 'content-expanding',
  meaning_match: 'content-expanding',
  semantic_features: 'content-expanding',
  synonym_generator: 'content-expanding',
  abstract_compare: 'content-expanding',
  describe_guess: 'content-expanding',

  // Archetype II — Performance-Pressure
  minimal_pairs: 'performance-pressure',
  phonological_awareness: 'performance-pressure',

  // Archetype III — Hybrid (content + executive load)
  detective_mind: 'hybrid',
  dual_load_naming: 'hybrid',
  multi_step_planning: 'hybrid',

  // Archetype IV — Open-Ended / Discourse
  narrative_retell: 'open-ended',
};

export function getGameArchetype(slug: string): ProgressionArchetype | null {
  return GAME_ARCHETYPES[slug] ?? null;
}

// ---------------------------------------------------------------------------
// Performance-pressure primitives roadmap (spec only)
//
// These are the engine capabilities required before any Archetype II or III
// game can move beyond shadow telemetry into live progression. None exist
// yet in runtime form.
// ---------------------------------------------------------------------------

export const PRESSURE_PRIMITIVES_ROADMAP = [
  {
    id: 'response_window_timer',
    description:
      'Per-trial soft timer that records RT and optionally fails the trial ' +
      'after a window. Must integrate with the existing trial logger.',
    blockers: ['no shared timer abstraction across games'],
  },
  {
    id: 'snr_noise_injector',
    description:
      'Audio mixer that overlays calibrated noise (white / babble / ' +
      'competing-talker) at target SNR before TTS playback.',
    blockers: ['TTS pipeline currently bypasses any mixer'],
  },
  {
    id: 'dynamic_distractor_count',
    description:
      'Generic AFC widget that takes a target + distractor pool and a ' +
      'count derived from the pressure dial.',
    blockers: ['each game currently hard-codes choice count'],
  },
  {
    id: 'echo_vs_production_typing',
    description:
      'Trial type tag distinguishing exposure (echo, repeat) from scored ' +
      'production. Mastery writer must ignore exposure trials.',
    blockers: ['mastery writer currently treats all trials uniformly'],
  },
  {
    id: 'visible_level_projector',
    description:
      'Per-archetype function projecting internal state (tier, dial step, ' +
      'scaffold level) onto the universal visible 1–10.',
    blockers: ['no projection layer exists'],
  },
] as const;

// ---------------------------------------------------------------------------
// Locked architectural decisions (recorded here for future PRs)
// ---------------------------------------------------------------------------

export const ARCHITECTURE_DECISIONS = {
  taxonomy: 'four-archetypes',                // I / II / III / IV
  displayContract: 'universal-1-to-10-facade', // never expose tier × dial
  internalContract: 'archetype-specific',
  firstLiveRollout: 'sentence_construction',  // cleanest Archetype I ladder
  rolloutGate: 'shadow-only-until-archetype-infra-and-bank-floors-met',
} as const;

export const PROGRESSION_ARCHETYPES_VERSION = '0.1.0-spec';
