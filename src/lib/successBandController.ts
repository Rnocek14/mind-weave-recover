/**
 * Success-Band Controller — maintains the 70–85% optimal challenge zone.
 *
 * Monitors a rolling window of trial outcomes. When the success rate drifts
 * outside the target band for a sustained number of checks, it recommends
 * a difficulty adjustment.
 *
 * This is the "upper-bound" companion to the mid-session pivot system,
 * which handles crash detection (lower bound). Together they form the
 * full closed-loop difficulty controller.
 */

export interface SuccessBandConfig {
  /** Lower bound of the optimal challenge zone (default 0.70) */
  lowerBound: number;
  /** Upper bound of the optimal challenge zone (default 0.85) */
  upperBound: number;
  /** Rolling window size for success rate calculation (default 10) */
  windowSize: number;
  /** Number of consecutive out-of-band checks before recommending adjustment (default 3) */
  persistenceThreshold: number;
}

export interface SuccessBandState {
  successRate: number;
  inBand: boolean;
  consecutiveAbove: number;
  consecutiveBelow: number;
  totalTrials: number;
  recommendation: 'increase' | 'decrease' | 'hold';
}

const DEFAULT_CONFIG: SuccessBandConfig = {
  lowerBound: 0.70,
  upperBound: 0.85,
  windowSize: 10,
  persistenceThreshold: 3,
};

export class SuccessBandController {
  private config: SuccessBandConfig;
  private outcomes: boolean[] = [];
  private consecutiveAbove = 0;
  private consecutiveBelow = 0;

  constructor(config: Partial<SuccessBandConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Record a trial outcome and return current state with recommendation */
  recordTrial(wasCorrect: boolean): SuccessBandState {
    this.outcomes.push(wasCorrect);
    if (this.outcomes.length > this.config.windowSize) {
      this.outcomes.shift();
    }

    const successRate = this.getSuccessRate();
    const { lowerBound, upperBound, persistenceThreshold } = this.config;

    if (successRate > upperBound) {
      this.consecutiveAbove++;
      this.consecutiveBelow = 0;
    } else if (successRate < lowerBound) {
      this.consecutiveBelow++;
      this.consecutiveAbove = 0;
    } else {
      this.consecutiveAbove = 0;
      this.consecutiveBelow = 0;
    }

    let recommendation: 'increase' | 'decrease' | 'hold' = 'hold';
    if (this.consecutiveAbove >= persistenceThreshold && this.outcomes.length >= Math.floor(this.config.windowSize / 2)) {
      recommendation = 'increase';
    } else if (this.consecutiveBelow >= persistenceThreshold && this.outcomes.length >= Math.floor(this.config.windowSize / 2)) {
      recommendation = 'decrease';
    }

    return {
      successRate,
      inBand: successRate >= lowerBound && successRate <= upperBound,
      consecutiveAbove: this.consecutiveAbove,
      consecutiveBelow: this.consecutiveBelow,
      totalTrials: this.outcomes.length,
      recommendation,
    };
  }

  /** Acknowledge that a recommendation was acted upon — resets persistence counters */
  acknowledge(): void {
    this.consecutiveAbove = 0;
    this.consecutiveBelow = 0;
  }

  /** Get current success rate without recording */
  getSuccessRate(): number {
    if (this.outcomes.length === 0) return 0;
    return this.outcomes.filter(Boolean).length / this.outcomes.length;
  }

  /** Get current state without recording */
  getState(): SuccessBandState {
    const successRate = this.getSuccessRate();
    const { lowerBound, upperBound, persistenceThreshold } = this.config;
    let recommendation: 'increase' | 'decrease' | 'hold' = 'hold';
    if (this.consecutiveAbove >= persistenceThreshold) recommendation = 'increase';
    else if (this.consecutiveBelow >= persistenceThreshold) recommendation = 'decrease';

    return {
      successRate,
      inBand: successRate >= lowerBound && successRate <= upperBound,
      consecutiveAbove: this.consecutiveAbove,
      consecutiveBelow: this.consecutiveBelow,
      totalTrials: this.outcomes.length,
      recommendation,
    };
  }

  /** Reset for new session */
  reset(): void {
    this.outcomes = [];
    this.consecutiveAbove = 0;
    this.consecutiveBelow = 0;
  }
}
