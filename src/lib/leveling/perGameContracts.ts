/**
 * Per-Game Leveling Contract Registry (v0 — spec only)
 *
 * Machine-readable mirror of `src/docs/PER_GAME_LEVELING_CONTRACT.md`.
 *
 * IMPORTANT: This module is intentionally NOT imported by any runtime
 * code. It exists so that a future PR can wire the mastery shadow layer
 * into live gameplay one game at a time, behind a flag, with type
 * safety. Do not import from game hooks, `useInGameAdaptation`, or any
 * UI surface yet.
 */

export type ContentReadiness =
  | 'ready'
  | 'needs_bank_expansion'
  | 'needs_tier_tagging'
  | 'shadow_only';

export type WiringRisk = 'low' | 'medium' | 'high';

export interface PerGameLevelingContract {
  /** Canonical exercise slug (matches normalizeExerciseSlug output). */
  slug: string;
  /** Game's internal difficulty scale (e.g. {min:1,max:3}). */
  internalScale: { min: number; max: number };
  /** What makes the game harder from L1 → L10. */
  difficultyDrivers: string[];
  /** What softens at the same visible level (soft regression). */
  supportDrivers: string[];
  /**
   * Fast-climb rule: how quickly a fresh user can level up while clearly
   * succeeding. Only applies up to `upToLevel`; beyond that the
   * cue-dependency safety gate in useInGameAdaptation governs.
   */
  fastClimb: {
    upToLevel: number;
    consecutiveStrongTrials: number;
  };
  /** Hard regression rule: when the visible level actually drops. */
  hardRegression: {
    minPoorSessions: number;
    cueIndependenceFloor: number;
  };
  /** How trials add to the longitudinal mastery progress (advisory). */
  progressWeights: {
    correctNoCue: number;
    correctLightCue: number;
    correctHeavyCue: number;
    incorrect: number;
    skip: number;
  };
  contentReadiness: ContentReadiness;
  wiringRisk: WiringRisk;
  /** Free-form note for the next implementer. */
  notes?: string;
}

const DEFAULT_WEIGHTS = {
  correctNoCue: 1.0,
  correctLightCue: 0.6,
  correctHeavyCue: 0.3,
  incorrect: 0,
  skip: 0,
};

export const PER_GAME_CONTRACTS: Record<string, PerGameLevelingContract> = {
  photo_naming: {
    slug: 'photo_naming',
    internalScale: { min: 1, max: 10 },
    difficultyDrivers: ['word frequency', 'word length', 'phonological complexity', 'image abstractness', 'distractor similarity', 'time pressure'],
    supportDrivers: ['semantic cue', 'phonemic cue', 'first-sound cue', 'full word reveal', 'longer response window', 'reduced visual clutter'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 3 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'ready',
    wiringRisk: 'low',
    notes: 'First candidate for live wiring. L8–L10 needs more low-frequency photos.',
  },
  two_clues: {
    slug: 'two_clues',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['target abstractness', 'clue semantic distance', 'word frequency'],
    supportDrivers: ['extra clue', 'first letter', 'narrower category'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'low',
    notes: 'T2 only has 6 puzzles vs FLOOR=15; T3 also thin. Expand mid/hard packs before wiring.',
  },
  describe_guess: {
    slug: 'describe_guess',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['concept abstractness', 'required anchor count', 'time per response'],
    supportDrivers: ['category prompt', 'lower required-concept threshold', 'partial concept credit'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'T3 only has 14 trials vs FLOOR=15. Heuristic scoring also needs review before wiring.',
  },
  meaning_match: {
    slug: 'meaning_match',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['internal tier 1→3', 'distractor semantic distance', 'abstract relations'],
    supportDrivers: ['highlight target', 'fewer distractors', 'hint'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 3 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'Internal tiers cap at 3 — L7+ requires new content.',
  },
  minimal_pairs: {
    slug: 'minimal_pairs',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['acoustic similarity', 'audio pace', 'voice variability'],
    supportDrivers: ['slow audio', 'repeat playback', 'show spelling'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 4 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'shadow_only',
    wiringRisk: 'low',
    notes: 'Playable photo-backed pool tops out at ~17 per tier. Fine for shadow telemetry; expand before live wiring.',
  phonological_awareness: {
    slug: 'phonological_awareness',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['cluster complexity', 'syllable count', 'phoneme position'],
    supportDrivers: ['model production', 'slow rate', 'written cue'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 3 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.5 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'T3 only has 14 trials vs FLOOR=15. Pronunciation scoring noise also needs review.',
  },
  semantic_features: {
    slug: 'semantic_features',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['features required', 'target abstractness', 'fewer feature prompts'],
    supportDrivers: ['feature category prompts', 'partial credit'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'Internal scale caps at 3 — L7+ requires more feature-rich items.',
  },
  synonym_generator: {
    slug: 'synonym_generator',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['word frequency', 'abstractness', 'synonyms required'],
    supportDrivers: ['first letter', 'model synonym'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_tier_tagging',
    wiringRisk: 'high',
    notes: 'Bank essentially untagged — shadow-only until tier tagging lands.',
  },
  fix_sentence: {
    slug: 'fix_sentence',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['sentence length', 'error subtlety', 'multiple errors'],
    supportDrivers: ['highlight error region', 'error-type hint'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 3 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'ready',
    wiringRisk: 'low',
  },
  sentence_construction: {
    slug: 'sentence_construction',
    internalScale: { min: 1, max: 10 },
    difficultyDrivers: ['word count', 'syntactic rarity', 'embedded clauses'],
    supportDrivers: ['target frame', 'role grouping'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 3 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'ready',
    wiringRisk: 'low',
  },
  narrative_retell: {
    slug: 'narrative_retell',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['narrative length', 'proposition count', 'vocab load', 'theme abstractness'],
    supportDrivers: ['chunked replay', 'written outline', 'proposition prompts'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'T1=10 and T3=12 stories — both below FLOOR=15. Discourse scorer also still under review.',
  },
  multi_step_planning: {
    slug: 'multi_step_planning',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['step count', 'order ambiguity', 'scenario novelty'],
    supportDrivers: ['show first step', 'phase grouping'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'ready',
    wiringRisk: 'low',
  },
  abstract_compare: {
    slug: 'abstract_compare',
    internalScale: { min: 1, max: 3 },
    difficultyDrivers: ['concept abstractness', 'semantic distance', 'dimensions required'],
    supportDrivers: ['one-dimension prompt'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'Cap at L4 in shadow until bank grows.',
  },
  dual_load_naming: {
    slug: 'dual_load_naming',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['naming difficulty', 'concurrent load intensity', 'pace'],
    supportDrivers: ['drop secondary load', 'longer response window'],
    fastClimb: { upToLevel: 3, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'needs_bank_expansion',
    wiringRisk: 'medium',
    notes: 'All tiers (~8–9 sets) are below FLOOR=15. Load calibration also sensitive — pilot carefully once bank grows.',
  },
  detective_mind: {
    slug: 'detective_mind',
    internalScale: { min: 1, max: 5 },
    difficultyDrivers: ['clue count', 'inferential distance', 'red herrings'],
    supportDrivers: ['highlight key clue', 'eliminate one suspect'],
    fastClimb: { upToLevel: 4, consecutiveStrongTrials: 2 },
    hardRegression: { minPoorSessions: 2, cueIndependenceFloor: 0.4 },
    progressWeights: DEFAULT_WEIGHTS,
    contentReadiness: 'ready',
    wiringRisk: 'medium',
    notes: 'Long trials → low data density per session.',
  },
};

export function getPerGameContract(slug: string): PerGameLevelingContract | null {
  return PER_GAME_CONTRACTS[slug] ?? null;
}

export const PER_GAME_CONTRACTS_VERSION = '0.1.0-spec';
