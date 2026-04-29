/**
 * Engagement Monitor
 * 
 * Detects user frustration and fatigue based on performance signals
 * and behavioral patterns during exercise sessions.
 * 
 * Research-backed thresholds:
 * - Frustration: 3+ consecutive errors OR 2 errors + timeout
 * - Fatigue: RT increase >30% OR timeout rate >20%
 */

export type FrustrationLevel = 'none' | 'low' | 'medium' | 'high';
export type FatigueLevel = 'none' | 'low' | 'medium' | 'high';

export interface TrialResult {
  correct: boolean;
  reactionTimeMs: number;
  timeout?: boolean;
  cueLevel: number;
  timestamp: number;
}

export interface UserStateSignals {
  errorStreak: number;           // Consecutive errors
  latencySpike: boolean;         // RT > 2x median
  quitAttempts: number;          // Pause/end button clicks
  timeoutRate: number;           // % timeouts in recent trials
  cueDependency: number;         // Average cues needed per trial
  rtTrend: number;               // % change in RT over session
  hesitationCount: number;       // Long pauses between trials
}

export interface EngagementState {
  frustration: FrustrationLevel;
  fatigue: FatigueLevel;
  signals: UserStateSignals;
  recommendedAction: RecommendedAction;
  confidence: number; // 0-1 confidence in assessment
}

export type RecommendedAction = 
  | 'continue'
  | 'difficulty_down'
  | 'break_prompt'
  | 'confidence_boost'
  | 'session_end';

export class EngagementMonitor {
  private recentTrials: TrialResult[] = [];
  private behavioralSignals = {
    pauseClicks: 0,
    endSessionAttempts: 0,
    hesitations: 0,
    lastTrialTime: Date.now()
  };
  private readonly windowSize: number;

  constructor(windowSize: number = 10) {
    this.windowSize = windowSize;
  }

  /**
   * Add a new trial result to the monitoring window
   */
  addTrial(trial: TrialResult): void {
    this.recentTrials.push(trial);
    
    // Keep only the most recent trials
    if (this.recentTrials.length > this.windowSize) {
      this.recentTrials.shift();
    }

    // Detect hesitation (>5 seconds since last trial)
    const timeSinceLastTrial = Date.now() - this.behavioralSignals.lastTrialTime;
    if (timeSinceLastTrial > 5000) {
      this.behavioralSignals.hesitations++;
    }
    this.behavioralSignals.lastTrialTime = Date.now();
  }

  /**
   * Track behavioral signals (pause clicks, quit attempts)
   */
  trackBehavior(event: 'pause' | 'end_attempt' | 'cue_request'): void {
    switch (event) {
      case 'pause':
        this.behavioralSignals.pauseClicks++;
        break;
      case 'end_attempt':
        this.behavioralSignals.endSessionAttempts++;
        break;
    }
  }

  /**
   * Calculate current user state signals
   */
  private calculateSignals(): UserStateSignals {
    if (this.recentTrials.length === 0) {
      return {
        errorStreak: 0,
        latencySpike: false,
        quitAttempts: this.behavioralSignals.endSessionAttempts,
        timeoutRate: 0,
        cueDependency: 0,
        rtTrend: 0,
        hesitationCount: this.behavioralSignals.hesitations
      };
    }

    // Calculate error streak (consecutive errors from end)
    let errorStreak = 0;
    for (let i = this.recentTrials.length - 1; i >= 0; i--) {
      if (!this.recentTrials[i].correct) {
        errorStreak++;
      } else {
        break;
      }
    }

    // Calculate median RT for baseline
    const reactionTimes = this.recentTrials.map(t => t.reactionTimeMs).sort((a, b) => a - b);
    const medianRT = reactionTimes[Math.floor(reactionTimes.length / 2)] || 0;
    
    // Check for latency spike (current RT > 2x median)
    const latestRT = this.recentTrials[this.recentTrials.length - 1]?.reactionTimeMs || 0;
    const latencySpike = medianRT > 0 && latestRT > medianRT * 2;

    // Calculate timeout rate
    const timeouts = this.recentTrials.filter(t => t.timeout).length;
    const timeoutRate = timeouts / this.recentTrials.length;

    // Calculate cue dependency, normalized to 0..1.
    // cueLevel ranges 0..3 (0=no cue, 3=full reveal). Normalize so safety
    // gates (threshold ~0.5) operate on a fraction, not a raw average.
    const MAX_CUE_LEVEL = 3;
    const totalCues = this.recentTrials.reduce((sum, t) => sum + (t.cueLevel || 0), 0);
    const rawAvg = totalCues / this.recentTrials.length;
    const cueDependency = Math.min(1, rawAvg / MAX_CUE_LEVEL);

    // Calculate RT trend (first half vs second half)
    let rtTrend = 0;
    if (this.recentTrials.length >= 6) {
      const midpoint = Math.floor(this.recentTrials.length / 2);
      const firstHalfRT = this.recentTrials.slice(0, midpoint)
        .reduce((sum, t) => sum + t.reactionTimeMs, 0) / midpoint;
      const secondHalfRT = this.recentTrials.slice(midpoint)
        .reduce((sum, t) => sum + t.reactionTimeMs, 0) / (this.recentTrials.length - midpoint);
      rtTrend = firstHalfRT > 0 ? (secondHalfRT - firstHalfRT) / firstHalfRT : 0;
    }

    return {
      errorStreak,
      latencySpike,
      quitAttempts: this.behavioralSignals.endSessionAttempts,
      timeoutRate,
      cueDependency,
      rtTrend,
      hesitationCount: this.behavioralSignals.hesitations
    };
  }

  /**
   * Detect frustration level based on error patterns and behavioral signals
   */
  private detectFrustration(signals: UserStateSignals): FrustrationLevel {
    // High frustration: 3+ consecutive errors + latency spike
    if (signals.errorStreak >= 3 && signals.latencySpike) {
      return 'high';
    }

    // High frustration: 2+ errors + timeout + quit attempts
    if (signals.errorStreak >= 2 && signals.timeoutRate > 0.3 && signals.quitAttempts > 0) {
      return 'high';
    }

    // Medium frustration: 3+ consecutive errors OR 2 errors + timeout
    if (signals.errorStreak >= 3 || (signals.errorStreak >= 2 && signals.timeoutRate > 0.2)) {
      return 'medium';
    }

    // Low frustration: 2 consecutive errors OR high timeout rate
    if (signals.errorStreak >= 2 || signals.timeoutRate > 0.3) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Detect fatigue level based on performance degradation over time
   */
  private detectFatigue(signals: UserStateSignals): FatigueLevel {
    // High fatigue: RT increasing significantly + high timeouts + hesitations
    if (signals.rtTrend > 0.3 && signals.timeoutRate > 0.2 && signals.hesitationCount > 2) {
      return 'high';
    }

    // Medium fatigue: RT increasing + either timeouts or hesitations
    if (signals.rtTrend > 0.2 && (signals.timeoutRate > 0.15 || signals.hesitationCount > 1)) {
      return 'medium';
    }

    // Low fatigue: RT increasing OR timeout rate elevated
    if (signals.rtTrend > 0.15 || signals.timeoutRate > 0.2) {
      return 'low';
    }

    return 'none';
  }

  /**
   * Determine recommended action based on current state
   */
  private recommendAction(
    frustration: FrustrationLevel,
    fatigue: FatigueLevel,
    signals: UserStateSignals
  ): RecommendedAction {
    // Critical state: suggest ending session
    if (frustration === 'high' && fatigue === 'high') {
      return 'session_end';
    }

    // High frustration: reduce difficulty + boost confidence
    if (frustration === 'high') {
      return 'confidence_boost';
    }

    // High fatigue: prompt break
    if (fatigue === 'high') {
      return 'break_prompt';
    }

    // Medium frustration: reduce difficulty
    if (frustration === 'medium' && signals.errorStreak >= 2) {
      return 'difficulty_down';
    }

    // Medium fatigue: prompt break
    if (fatigue === 'medium') {
      return 'break_prompt';
    }

    return 'continue';
  }

  /**
   * Calculate confidence in the assessment (0-1)
   * Based on how much data we have and signal clarity
   */
  private calculateConfidence(signals: UserStateSignals): number {
    // Need at least 5 trials for meaningful assessment
    if (this.recentTrials.length < 5) {
      return this.recentTrials.length / 5;
    }

    // Strong signals = high confidence
    const strongSignals = [
      signals.errorStreak >= 3,
      signals.latencySpike,
      signals.timeoutRate > 0.2,
      signals.rtTrend > 0.2,
      signals.quitAttempts > 0
    ].filter(Boolean).length;

    // More strong signals = higher confidence
    return Math.min(1, 0.6 + (strongSignals * 0.1));
  }

  /**
   * Get current engagement state assessment
   */
  assessState(): EngagementState {
    const signals = this.calculateSignals();
    const frustration = this.detectFrustration(signals);
    const fatigue = this.detectFatigue(signals);
    const recommendedAction = this.recommendAction(frustration, fatigue, signals);
    const confidence = this.calculateConfidence(signals);

    return {
      frustration,
      fatigue,
      signals,
      recommendedAction,
      confidence
    };
  }

  /**
   * Get serializable state for logging to database
   */
  getEngagementFlags(): Record<string, any> {
    const state = this.assessState();
    return {
      frustration_level: state.frustration,
      fatigue_level: state.fatigue,
      recommended_action: state.recommendedAction,
      confidence: state.confidence,
      signals: state.signals,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset monitor for new session
   */
  reset(): void {
    this.recentTrials = [];
    this.behavioralSignals = {
      pauseClicks: 0,
      endSessionAttempts: 0,
      hesitations: 0,
      lastTrialTime: Date.now()
    };
  }

  /**
   * Get diagnostic info for testing/debugging
   */
  getDiagnostics() {
    const state = this.assessState();
    return {
      trialCount: this.recentTrials.length,
      state,
      recentTrials: this.recentTrials.slice(-5),
      behavioral: this.behavioralSignals
    };
  }
}
