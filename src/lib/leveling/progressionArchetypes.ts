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
 * Granularity of the per-trial mastery signal.
 *
 * The Narrative Retell audit proved that boolean correctness
 * (`eventCoverage >= 0.3 ? correct : incorrect`) destroys clinically
 * meaningful information. A 29% retell is NOT "incorrect" — it's a
 * graded rehabilitation event. Some archetypes (IV, parts of III) MUST
 * report continuous evidence; collapsing to boolean is a category error.
 *
 *   boolean        — trial is correct/incorrect (most Archetype I).
 *   graded         — trial yields a [0..1] score (coverage, partial credit,
 *                    pronunciation accuracy). Mastery writer must consume
 *                    the float, not threshold it.
 *   multi-dimensional — trial yields a vector of independent scores
 *                    (e.g. {coverage, coherence, syntactic_complexity}).
 *                    Each dimension feeds its own mastery axis.
 */
export type MasterySignalGranularity =
  | 'boolean'
  | 'graded'
  | 'multi-dimensional';

/**
 * Which axis dominates progression for a given game. The audit pass
 * proved this is NOT uniformly "content" — Archetype II games are
 * dominated by pressure, Archetype IV by scaffold withdrawal, and mixed
 * Archetype I games (photo_naming) split between content and recognition.
 *
 * Used by the future visible_level_projector to weight axes correctly.
 */
export type DominantProgressionAxis =
  | 'content-complexity'
  | 'pressure-retention'
  | 'scaffold-independence'
  | 'recognition-to-production'
  | 'mixed';

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

  /** Per-trial signal granularity. Archetype IV MUST be 'graded' or higher. */
  masterySignalGranularity: MasterySignalGranularity;

  /** Which axis dominates progression for this game. */
  dominantAxis: DominantProgressionAxis;

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

/**
 * Per-game secondary modifiers and trial mode.
 * Source of truth for "what additional dials does this game embed on top
 * of its primary archetype, and what cognitive mode are its trials in?".
 *
 * Photo Naming is the canonical mixed example: primary content-expanding
 * + secondary recognition modifier (choice-count + phonological foils).
 * Recognition trials must NOT feed production mastery.
 */
export const GAME_MODIFIERS: Record<
  string,
  { modifiers: ArchetypeModifier[]; productionMode: TrialMode }
> = {
  // Archetype I — pure content ladders
  sentence_construction: { modifiers: [], productionMode: 'production' },
  fix_sentence:          { modifiers: [], productionMode: 'production' },
  two_clues:             { modifiers: [], productionMode: 'production' },
  meaning_match:         { modifiers: ['recognition'], productionMode: 'recognition' },
  semantic_features:     { modifiers: [], productionMode: 'production' },
  synonym_generator:     { modifiers: [], productionMode: 'production' },
  abstract_compare:      { modifiers: [], productionMode: 'production' },
  describe_guess:        { modifiers: [], productionMode: 'production' },

  // Archetype I + recognition modifier — canonical mixed-mode game
  photo_naming: { modifiers: ['recognition'], productionMode: 'mixed' },

  // Archetype II — pressure dials over finite content
  minimal_pairs:          { modifiers: ['pressure'], productionMode: 'recognition' },
  phonological_awareness: { modifiers: ['pressure'], productionMode: 'recognition' },

  // Archetype III — content + dual-task
  detective_mind:      { modifiers: ['dual-task'], productionMode: 'production' },
  dual_load_naming:    { modifiers: ['dual-task'], productionMode: 'production' },
  multi_step_planning: { modifiers: ['dual-task'], productionMode: 'production' },

  // Archetype IV — scaffold-fade is the difficulty axis itself
  narrative_retell: { modifiers: ['scaffold-fade'], productionMode: 'production' },
};

export function getGameModifiers(slug: string): ArchetypeModifier[] {
  return GAME_MODIFIERS[slug]?.modifiers ?? [];
}

export function getGameTrialMode(slug: string): TrialMode | null {
  return GAME_MODIFIERS[slug]?.productionMode ?? null;
}

// ---------------------------------------------------------------------------
// Dominant-axis declarations per game
//
// Recorded as a separate map (not inside GAME_MODIFIERS) so the future
// visible-level projector can be unit-tested archetype-by-archetype.
// ---------------------------------------------------------------------------

export const GAME_DOMINANT_AXIS: Record<string, DominantProgressionAxis> = {
  // Archetype I — content is the dominant axis
  sentence_construction: 'content-complexity',
  fix_sentence:          'content-complexity',
  two_clues:             'content-complexity',
  meaning_match:         'content-complexity',
  semantic_features:     'content-complexity',
  synonym_generator:     'content-complexity',
  abstract_compare:      'content-complexity',
  describe_guess:        'content-complexity',

  // Archetype I + recognition modifier
  photo_naming: 'recognition-to-production',

  // Archetype II — pressure dominates over finite content
  minimal_pairs:          'pressure-retention',
  phonological_awareness: 'pressure-retention',

  // Archetype III — mixed weighting per game
  detective_mind:      'mixed',
  dual_load_naming:    'mixed',
  multi_step_planning: 'mixed',

  // Archetype IV — scaffold withdrawal IS the difficulty axis
  narrative_retell: 'scaffold-independence',
};

// ---------------------------------------------------------------------------
// Progression primitives roadmap (spec only)
//
// Renamed from PRESSURE_PRIMITIVES_ROADMAP after the four-archetype audit
// pass: pressure is only one of several first-class progression
// mechanisms. Scaffolding, recognition/production routing, continuous
// mastery, and visible-level projection are equally fundamental.
//
// None exist yet in runtime form. Live archetype rollout is gated on
// these primitives plus per-archetype bank floors.
// ---------------------------------------------------------------------------

export const PROGRESSION_PRIMITIVES_ROADMAP = [
  {
    id: 'response_window_timer',
    family: 'pressure',
    description:
      'Per-trial soft timer that records RT and optionally fails the trial ' +
      'after a window. Must integrate with the existing trial logger.',
    blockers: ['no shared timer abstraction across games'],
  },
  {
    id: 'snr_noise_injector',
    family: 'pressure',
    description:
      'Audio mixer that overlays calibrated noise (white / babble / ' +
      'competing-talker) at target SNR before TTS playback.',
    blockers: ['TTS pipeline currently bypasses any mixer'],
  },
  {
    id: 'dynamic_distractor_count',
    family: 'pressure',
    description:
      'Generic AFC widget that takes a target + distractor pool and a ' +
      'count derived from the pressure dial.',
    blockers: ['each game currently hard-codes choice count'],
  },
  {
    id: 'per_trial_mode_tag',
    family: 'recognition-vs-production',
    description:
      'Replaces the obsolete echoIsProduction binary. Per-trial TrialMode ' +
      '(production / recognition / exposure / scaffolded). Mastery writer ' +
      'routes per mode: production (and discounted scaffolded) feed ' +
      'expressive mastery; recognition feeds receptive mastery; exposure ' +
      'feeds neither. Mixed-mode games (photo_naming) MUST emit it.',
    blockers: [
      'mastery writer currently treats all trials uniformly',
      'trial logger lacks a trial_mode column',
      'photo_naming generateChoices does not tag recognition vs production',
    ],
  },
  {
    id: 'scaffold_state_machine',
    family: 'scaffolding',
    description:
      'Cross-session scaffold ladder for Archetype IV (and scaffold-faded ' +
      'Archetype I) games. Tracks the current scaffold level per ' +
      '(profile, skill) and withdraws support across sessions, not just ' +
      'within a trial. Distinct from cue-level: scaffolds are content ' +
      'support (outline, replay, propositions), not lexical hints.',
    blockers: [
      'no persistent scaffold-level store',
      'narrative_retell currently re-resolves scaffold per session',
      'no cross-session withdrawal policy defined',
    ],
  },
  {
    id: 'continuous_mastery_signal',
    family: 'mastery-semantics',
    description:
      'First-class graded mastery evidence. Trial logger and mastery ' +
      'writer must accept and persist a [0..1] score (and, for ' +
      'multi-dimensional games, a named score vector) WITHOUT thresholding ' +
      'to boolean upstream. The Narrative Retell coverage>=0.3 collapse ' +
      'is the canonical anti-pattern this primitive eliminates.',
    blockers: [
      'mastery writer currently consumes boolean isCorrect only',
      'exercise_events lacks a graded_score / score_vector column',
      'no agreed schema for multi-dimensional discourse scores',
    ],
  },
  {
    id: 'visible_level_projector',
    family: 'projection',
    description:
      'Per-archetype function projecting internal state (tier, dial step, ' +
      'scaffold level, mode mix) onto the universal visible 1–10. The ' +
      'only place the 1–10 facade is allowed to be computed.',
    blockers: ['no projection layer exists'],
  },
] as const;

/** @deprecated Use PROGRESSION_PRIMITIVES_ROADMAP. Kept for one cleanup pass. */
export const PRESSURE_PRIMITIVES_ROADMAP = PROGRESSION_PRIMITIVES_ROADMAP;

// ---------------------------------------------------------------------------
// Locked architectural decisions (recorded here for future PRs)
// ---------------------------------------------------------------------------

export const ARCHITECTURE_DECISIONS = {
  taxonomy: 'four-archetypes-with-modifiers',  // I / II / III / IV + secondaryModifiers
  displayContract: 'universal-1-to-10-facade', // never expose tier × dial
  internalContract: 'archetype-specific',
  trialModeContract: 'per-trial-TrialMode-required-for-mixed-mode-games',
  masterySignalContract: 'graded-required-for-archetype-IV-no-boolean-collapse',
  dominantAxisContract: 'per-game-declared-not-uniformly-content',
  scaffoldContract: 'cross-session-state-machine-not-within-trial-only',
  primitivesScope: 'progression-primitives-not-just-pressure', // family-tagged roadmap
  firstLiveRollout: 'sentence_construction',   // cleanest Archetype I ladder
  rolloutGate: 'shadow-only-until-archetype-infra-and-bank-floors-met',
  /**
   * THEORY-LAYER FREEZE (post Archetype I+II+IV validation pass).
   * Auditing temporarily paused. Spec consolidation is the active phase.
   * No new archetype taxonomy changes without a re-audit trigger.
   */
  theoryLayerStatus: 'frozen-pending-implementation',
} as const;

export const PROGRESSION_ARCHETYPES_VERSION = '0.3.0-spec';

