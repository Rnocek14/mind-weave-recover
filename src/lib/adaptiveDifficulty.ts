import type { DifficultyBounds } from './difficultyBounds';
import { clampToBounds } from './difficultyBounds';

/**
 * Adaptive Difficulty Controller
 * 
 * PID-style controller that maintains 75-85% success rate
 * by adjusting difficulty level based on rolling performance window.
 * Respects capability-based floor/ceiling bounds to ensure safety.
 */

export class AdaptiveDifficultyController {
  private recentTrials: boolean[] = [];
  private windowSize: number;
  private targetSuccessRate: number;
  private adjustmentThreshold: number;
  private bounds: DifficultyBounds;

  constructor(
    windowSize: number = 5,
    targetSuccessRate: number = 0.80,
    adjustmentThreshold: number = 0.15, // ±15% from target
    initialBounds?: DifficultyBounds
  ) {
    this.bounds = initialBounds ?? { floor: 1, ceiling: 10, suggestedStart: 1 };
    this.windowSize = windowSize;
    this.targetSuccessRate = targetSuccessRate;
    this.adjustmentThreshold = adjustmentThreshold;
  }

  /**
   * Add a trial result to the rolling window
   */
  update(wasCorrect: boolean): void {
    this.recentTrials.push(wasCorrect);
    if (this.recentTrials.length > this.windowSize) {
      this.recentTrials.shift();
    }
  }

  /**
   * Calculate current success rate from recent trials
   */
  getSuccessRate(): number {
    if (this.recentTrials.length === 0) return 0;
    const correctCount = this.recentTrials.filter((t) => t).length;
    return correctCount / this.recentTrials.length;
  }

  /**
   * Determine if difficulty should be adjusted
   * Returns new level (clamped to capability bounds) or current level if no change needed
   */
  adjustLevel(currentLevel: number): number {
    // Need enough trials to make a decision
    if (this.recentTrials.length < this.windowSize) {
      return currentLevel;
    }

    const successRate = this.getSuccessRate();
    const lowerBound = this.targetSuccessRate - this.adjustmentThreshold;
    const upperBound = this.targetSuccessRate + this.adjustmentThreshold;

    let newLevel = currentLevel;

    // Too easy - increase difficulty (but respect ceiling)
    if (successRate > upperBound && currentLevel < this.bounds.ceiling) {
      newLevel = currentLevel + 1;
    }
    // Too hard - decrease difficulty (but respect floor)
    else if (successRate < lowerBound && currentLevel > this.bounds.floor) {
      newLevel = currentLevel - 1;
    }

    // Always clamp to bounds (in case bounds changed)
    return clampToBounds(newLevel, this.bounds);
  }

  /**
   * Emergency difficulty reduction for frustration intervention
   * Steps down 2 levels instead of 1, respecting floor
   */
  handleFrustration(currentLevel: number): number {
    return Math.max(this.bounds.floor, currentLevel - 2);
  }

  /**
   * Update bounds (e.g., after new capability assessment)
   * Re-clamps current level if needed
   */
  setBounds(bounds: DifficultyBounds): void {
    this.bounds = bounds;
  }

  /**
   * Get current bounds for display/logging
   */
  getBounds(): DifficultyBounds {
    return { ...this.bounds };
  }

  /**
   * Get cue level based on recent error count
   * More errors = more cues needed
   */
  getCueLevel(recentErrorCount: number): number {
    if (recentErrorCount >= 3) return 3; // Full word reveal
    if (recentErrorCount === 2) return 2; // Phonemic cue
    if (recentErrorCount === 1) return 1; // Semantic cue
    return 0; // No cue
  }

  /**
   * Reset controller for new session
   */
  reset(): void {
    this.recentTrials = [];
  }

  /**
   * Get diagnostic info for logging
   */
  getState() {
    return {
      successRate: this.getSuccessRate(),
      trialCount: this.recentTrials.length,
      recentTrials: [...this.recentTrials],
    };
  }
}
