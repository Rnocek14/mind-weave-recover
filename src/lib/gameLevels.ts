/**
 * Universal Game Level (1–10)
 *
 * Single canonical scale exposed to patients, clinicians, and telemetry.
 * Internally games may still use 1–3, 1–5, or other scales; this module
 * maps between them so every game can present a consistent "Level X / 10".
 *
 * Layer 1 of the adaptation system. Layer 2 (deficit-targeted content)
 * is intentionally NOT included here.
 */

export type GameLevel = number; // 1..10

export interface LevelScale {
  /** The game's internal minimum tier (e.g. 1 for tier-based games). */
  min: number;
  /** The game's internal maximum tier (e.g. 3 for tier-based games). */
  max: number;
}

export interface LevelDescriptor {
  /** 1..10 */
  level: GameLevel;
  /** Short patient-facing label. */
  label: string;
  /** Band the level falls into, used for visual styling. */
  band: 'easy' | 'building' | 'core' | 'stretch' | 'mastery';
  /** What changes at this level vs. the level below. Plain language. */
  levers: string[];
}

/** Patient-facing band labels per level. */
export const LEVEL_LABELS: Record<number, { label: string; band: LevelDescriptor['band'] }> = {
  1: { label: 'Warm-up', band: 'easy' },
  2: { label: 'Easy', band: 'easy' },
  3: { label: 'Easy+', band: 'building' },
  4: { label: 'Building', band: 'building' },
  5: { label: 'Core', band: 'core' },
  6: { label: 'Core+', band: 'core' },
  7: { label: 'Stretch', band: 'stretch' },
  8: { label: 'Stretch+', band: 'stretch' },
  9: { label: 'Challenge', band: 'mastery' },
  10: { label: 'Mastery', band: 'mastery' },
};

/** What gets harder at each level. Generic — games can override per-game. */
export const LEVEL_LEVERS: Record<number, string[]> = {
  1: ['Maximum cues', 'Long time', 'Few choices', 'Familiar items'],
  2: ['Strong cues', 'Long time', 'Few choices'],
  3: ['Moderate cues', 'Comfortable time'],
  4: ['Light cues on demand', 'Comfortable time'],
  5: ['Cues only when needed', 'Standard time'],
  6: ['Fewer cues', 'Standard time', 'More choices'],
  7: ['Rare cues', 'Tighter time', 'More distractors'],
  8: ['Minimal cues', 'Tighter time', 'Abstract items'],
  9: ['No cues', 'Quick pace', 'Complex items'],
  10: ['No cues', 'Fast pace', 'Most complex items'],
};

/** Clamp any number to a valid 1..10 game level. */
export function clampLevel(n: number): GameLevel {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

/**
 * Map a game's internal tier (e.g. 2 of 3) to the canonical 1–10 scale.
 *
 * Examples:
 *   tierToLevel(1, {min:1,max:3}) → 1
 *   tierToLevel(2, {min:1,max:3}) → 5
 *   tierToLevel(3, {min:1,max:3}) → 10
 *   tierToLevel(5, {min:1,max:10}) → 5  (passthrough)
 */
export function tierToLevel(tier: number, scale: LevelScale): GameLevel {
  const { min, max } = scale;
  if (max <= min) return clampLevel(tier);
  // If the game already speaks 1–10, passthrough.
  if (min === 1 && max === 10) return clampLevel(tier);
  const t = Math.max(min, Math.min(max, tier));
  // Linear interpolation onto 1..10.
  const ratio = (t - min) / (max - min);
  return clampLevel(1 + ratio * 9);
}

/**
 * Inverse of tierToLevel: convert a canonical 1–10 level back to the game's
 * internal tier scale. Used when a controller wants to step in level-space
 * but the game still selects content by tier.
 */
export function levelToTier(level: GameLevel, scale: LevelScale): number {
  const { min, max } = scale;
  if (max <= min) return min;
  if (min === 1 && max === 10) return clampLevel(level);
  const lvl = clampLevel(level);
  const ratio = (lvl - 1) / 9;
  return Math.round(min + ratio * (max - min));
}

/** Build a descriptor for the given level. */
export function describeLevel(level: GameLevel): LevelDescriptor {
  const lvl = clampLevel(level);
  const { label, band } = LEVEL_LABELS[lvl];
  return {
    level: lvl,
    label,
    band,
    levers: LEVEL_LEVERS[lvl] ?? [],
  };
}
