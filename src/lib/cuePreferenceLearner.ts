/**
 * Cue Preference Learner
 * 
 * Tracks which cue types (semantic, phonemic, sentence, visual) work best
 * for each user and recommends the most effective cue type.
 * 
 * Uses an epsilon-greedy bandit approach:
 * - 80% of the time: use the best-performing cue type
 * - 20% of the time: explore other cue types to keep learning
 * 
 * Persists stats in localStorage per user+profile for cross-session learning.
 */

export type CueType = 'semantic' | 'phonemic' | 'sentence' | 'visual' | 'none';

export interface CueStats {
  successes: number;
  attempts: number;
}

export interface CuePreferenceState {
  stats: Record<CueType, CueStats>;
  bestCueType: CueType;
  bestSuccessRate: number;
  totalAttempts: number;
  isExploring: boolean;
}

const CUE_TYPES: CueType[] = ['semantic', 'phonemic', 'sentence', 'visual'];
const EXPLORE_RATE = 0.20; // 20% exploration
const MIN_ATTEMPTS_FOR_PREFERENCE = 5; // Need at least 5 attempts before trusting stats

function getStorageKey(userId: string, profileId?: string): string {
  return `cue_preference_${userId}_${profileId ?? 'default'}`;
}

function defaultStats(): Record<CueType, CueStats> {
  return {
    semantic: { successes: 0, attempts: 0 },
    phonemic: { successes: 0, attempts: 0 },
    sentence: { successes: 0, attempts: 0 },
    visual: { successes: 0, attempts: 0 },
    none: { successes: 0, attempts: 0 },
  };
}

export class CuePreferenceLearner {
  private stats: Record<CueType, CueStats>;
  private userId: string;
  private profileId?: string;

  constructor(userId: string, profileId?: string) {
    this.userId = userId;
    this.profileId = profileId;
    this.stats = this.loadStats();
  }

  /** Record whether a cue was effective */
  recordCueOutcome(cueType: CueType, wasEffective: boolean): void {
    if (!this.stats[cueType]) {
      this.stats[cueType] = { successes: 0, attempts: 0 };
    }
    this.stats[cueType].attempts += 1;
    if (wasEffective) {
      this.stats[cueType].successes += 1;
    }
    this.saveStats();
  }

  /** Get the recommended cue type using epsilon-greedy */
  getRecommendedCue(excludeTypes?: CueType[]): { cueType: CueType; isExploring: boolean } {
    const available = CUE_TYPES.filter(t => !excludeTypes?.includes(t));
    if (available.length === 0) return { cueType: 'semantic', isExploring: false };

    const totalAttempts = available.reduce((sum, t) => sum + (this.stats[t]?.attempts ?? 0), 0);

    // Not enough data yet — explore uniformly
    if (totalAttempts < MIN_ATTEMPTS_FOR_PREFERENCE) {
      const randomType = available[Math.floor(Math.random() * available.length)];
      return { cueType: randomType, isExploring: true };
    }

    // Epsilon-greedy: explore 20% of the time
    if (Math.random() < EXPLORE_RATE) {
      const randomType = available[Math.floor(Math.random() * available.length)];
      return { cueType: randomType, isExploring: true };
    }

    // Exploit: pick the cue type with highest success rate
    let bestType = available[0];
    let bestRate = -1;

    for (const cueType of available) {
      const s = this.stats[cueType];
      if (!s || s.attempts === 0) continue;
      const rate = s.successes / s.attempts;
      if (rate > bestRate) {
        bestRate = rate;
        bestType = cueType;
      }
    }

    return { cueType: bestType, isExploring: false };
  }

  /** Get success rate for a specific cue type */
  getSuccessRate(cueType: CueType): number {
    const s = this.stats[cueType];
    if (!s || s.attempts === 0) return 0;
    return s.successes / s.attempts;
  }

  /** Get the best-performing cue type */
  getBestCueType(): CueType {
    let bestType: CueType = 'semantic';
    let bestRate = -1;

    for (const cueType of CUE_TYPES) {
      const rate = this.getSuccessRate(cueType);
      if (rate > bestRate && (this.stats[cueType]?.attempts ?? 0) >= MIN_ATTEMPTS_FOR_PREFERENCE) {
        bestRate = rate;
        bestType = cueType;
      }
    }

    return bestType;
  }

  /** Get full state for display/logging */
  getState(): CuePreferenceState {
    const bestType = this.getBestCueType();
    const totalAttempts = Object.values(this.stats).reduce((sum, s) => sum + s.attempts, 0);

    return {
      stats: { ...this.stats },
      bestCueType: bestType,
      bestSuccessRate: this.getSuccessRate(bestType),
      totalAttempts,
      isExploring: totalAttempts < MIN_ATTEMPTS_FOR_PREFERENCE,
    };
  }

  /** Generate a clinical insight string */
  generateInsight(): string | null {
    const state = this.getState();
    if (state.totalAttempts < MIN_ATTEMPTS_FOR_PREFERENCE * 2) return null;

    const best = state.bestCueType;
    const bestRate = Math.round(state.bestSuccessRate * 100);

    // Find worst for comparison
    let worstType: CueType = best;
    let worstRate = 100;
    for (const t of CUE_TYPES) {
      const s = this.stats[t];
      if (s && s.attempts >= MIN_ATTEMPTS_FOR_PREFERENCE) {
        const rate = Math.round(this.getSuccessRate(t) * 100);
        if (rate < worstRate) {
          worstRate = rate;
          worstType = t;
        }
      }
    }

    if (best === worstType) return null;

    return `User responds best to ${best} cues (${bestRate}% effective) vs ${worstType} cues (${worstRate}% effective)`;
  }

  /** Reset all stats */
  reset(): void {
    this.stats = defaultStats();
    this.saveStats();
  }

  private loadStats(): Record<CueType, CueStats> {
    try {
      const key = getStorageKey(this.userId, this.profileId);
      const stored = localStorage.getItem(key);
      if (stored) {
        return { ...defaultStats(), ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return defaultStats();
  }

  private saveStats(): void {
    try {
      const key = getStorageKey(this.userId, this.profileId);
      localStorage.setItem(key, JSON.stringify(this.stats));
    } catch {
      // ignore
    }
  }
}
