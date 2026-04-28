/**
 * Simulated user profiles for the adaptive-system harness.
 *
 * Each profile is a deterministic generator: given a current difficulty level
 * and the current cue level, it returns the next trial outcome
 * (correct, reactionTimeMs, timeout, cueLevel actually used).
 *
 * These are NOT real patients — they're behavioral archetypes used to
 * pressure-test the closed-loop adaptation engine.
 */

export type ProfileId =
  | 'high_acc_low_cue'
  | 'high_acc_high_cue'
  | 'low_acc_high_frustration'
  | 'slow_fatigued'
  | 'mixed_errors';

export interface SimulatedTrial {
  correct: boolean;
  reactionTimeMs: number;
  timeout: boolean;
  cueLevel: number;          // 0..3, what the user actually leaned on
  errorType?: 'semantic' | 'phonological' | 'omission';
}

export interface SimContext {
  trialIndex: number;        // 0-based
  difficulty: number;        // current level
  /** Cue ladder offered by the game (0..3). The profile may "use" up to this. */
  offeredCueLevel: number;
  rng: () => number;
}

export interface UserProfile {
  id: ProfileId;
  label: string;
  description: string;
  generate: (ctx: SimContext) => SimulatedTrial;
}

/** Tiny seeded PRNG so simulations are reproducible. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Difficulty-aware base success: higher level = lower base accuracy.
function baseAccuracyForLevel(level: number, peak: number): number {
  // peak applied at level ~3; falls off above that.
  const drop = Math.max(0, level - 3) * 0.07;
  return Math.max(0.15, Math.min(0.99, peak - drop));
}

export const USER_PROFILES: UserProfile[] = [
  {
    id: 'high_acc_low_cue',
    label: 'High accuracy, low cue use',
    description: 'Confident user. Should drive escalations without tripping the cue gate.',
    generate: ({ difficulty, rng }) => {
      const p = baseAccuracyForLevel(difficulty, 0.92);
      const correct = rng() < p;
      const rt = 1500 + Math.floor(rng() * 800);
      return { correct, reactionTimeMs: rt, timeout: false, cueLevel: 0 };
    },
  },
  {
    id: 'high_acc_high_cue',
    label: 'High accuracy, high cue use',
    description:
      'Gets answers right, but only with maximum hints. Should trigger cue-dependency gate.',
    generate: ({ difficulty, offeredCueLevel, rng }) => {
      const used = Math.max(2, offeredCueLevel); // always leans on heavy cues
      const p = baseAccuracyForLevel(difficulty, 0.88);
      const correct = rng() < p;
      const rt = 2200 + Math.floor(rng() * 1000);
      return {
        correct,
        reactionTimeMs: rt,
        timeout: false,
        cueLevel: Math.min(3, used),
      };
    },
  },
  {
    id: 'low_acc_high_frustration',
    label: 'Low accuracy, high frustration',
    description: 'Many wrong answers, error streaks, latency spikes. Should trigger step-downs.',
    generate: ({ difficulty, trialIndex, rng }) => {
      const p = baseAccuracyForLevel(difficulty, 0.45);
      const correct = rng() < p;
      // Latency spikes every ~5 trials.
      const spike = trialIndex % 5 === 4 ? 3500 : 0;
      const rt = 2800 + Math.floor(rng() * 1200) + spike;
      return {
        correct,
        reactionTimeMs: rt,
        timeout: rng() < 0.15,
        cueLevel: 1,
        errorType: correct ? undefined : 'semantic',
      };
    },
  },
  {
    id: 'slow_fatigued',
    label: 'Slow responses / fatigue',
    description:
      'Starts okay then RT drifts up and timeouts increase. Should trigger fatigue narration.',
    generate: ({ difficulty, trialIndex, rng }) => {
      const fatigueFactor = 1 + trialIndex * 0.03; // RT grows with trials
      const p = Math.max(0.35, baseAccuracyForLevel(difficulty, 0.78) - trialIndex * 0.01);
      const correct = rng() < p;
      const rt = Math.floor((2000 + rng() * 800) * fatigueFactor);
      const timeout = trialIndex > 12 && rng() < 0.25;
      return {
        correct: timeout ? false : correct,
        reactionTimeMs: rt,
        timeout,
        cueLevel: trialIndex > 8 ? 1 : 0,
      };
    },
  },
  {
    id: 'mixed_errors',
    label: 'Mixed error types',
    description: 'Alternates semantic and phonological errors. Tests narration neutrality.',
    generate: ({ difficulty, trialIndex, rng }) => {
      const p = baseAccuracyForLevel(difficulty, 0.7);
      const correct = rng() < p;
      const errorType: SimulatedTrial['errorType'] = correct
        ? undefined
        : trialIndex % 2 === 0
          ? 'semantic'
          : 'phonological';
      const rt = 2000 + Math.floor(rng() * 1500);
      return {
        correct,
        reactionTimeMs: rt,
        timeout: false,
        cueLevel: errorType ? 2 : 0,
        errorType,
      };
    },
  },
];

export function getProfile(id: ProfileId): UserProfile {
  const p = USER_PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown profile: ${id}`);
  return p;
}
