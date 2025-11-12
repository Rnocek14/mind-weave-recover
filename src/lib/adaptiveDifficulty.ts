/**
 * Adaptive Difficulty Controller
 * 
 * PID-style controller that maintains 75-85% success rate
 * by adjusting difficulty level based on rolling performance window
 */

export class AdaptiveDifficultyController {
  private recentTrials: boolean[] = [];
  private windowSize: number;
  private targetSuccessRate: number;
  private adjustmentThreshold: number;

  constructor(
    windowSize: number = 5,
    targetSuccessRate: number = 0.80,
    adjustmentThreshold: number = 0.15 // ±15% from target
  ) {
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
   * Returns new level (clamped 1-10) or current level if no change needed
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

    // Too easy - increase difficulty
    if (successRate > upperBound && currentLevel < 10) {
      newLevel = currentLevel + 1;
    }
    // Too hard - decrease difficulty
    else if (successRate < lowerBound && currentLevel > 1) {
      newLevel = currentLevel - 1;
    }

    return newLevel;
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
