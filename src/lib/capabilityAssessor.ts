/**
 * Zero-Assumption Capability Assessment System
 * 
 * Progressively tests vision, motor control, and attention without requiring
 * speech, comprehension, or explicit instructions.
 */

export interface TrialResult {
  level: number;
  trialNumber: number;
  timestamp: number;
  response: 'hit' | 'miss' | 'timeout';
  reactionTimeMs?: number;
  position?: { x: number; y: number };
  assisted?: boolean;
}

export interface Level0Result {
  oriented: boolean;
  responseTime?: number;
  attempts: number;
}

export interface Level1Result {
  discoveredCauseEffect: boolean;
  repeatTaps: number;
  consistentInteraction: boolean;
  avgInterTapInterval?: number;
}

export interface Level2Result {
  accuracy: number;
  avgReactionTime: number;
  consistentHand: boolean;
  trials: TrialResult[];
}

export interface CapabilityScores {
  vision: number;
  motor: number;
  attention: number;
  confidence: number;
}

export interface AssessmentResult {
  level0: Level0Result;
  level1: Level1Result;
  level2: Level2Result;
  scores: CapabilityScores;
  behavioralFlags: {
    canOrient: boolean;
    canTap: boolean;
    understandsCauseEffect: boolean;
    canMatchPatterns: boolean;
  };
  completed: boolean;
  needsRetry: boolean;
  retryReason?: 'fatigue_suspected' | 'no_response' | 'distress_observed' | 'technical_issue';
}

/**
 * Calculate vision score based on Level 0 and Level 2 performance
 */
export function calculateVisionScore(level0: Level0Result, level2: Level2Result): number {
  const orientationScore = level0.oriented ? 3 : 0;
  const targetHitRate = level2.trials.filter(t => t.response === 'hit').length / level2.trials.length;
  const targetScore = targetHitRate * 7;
  return Math.round(orientationScore + targetScore);
}

/**
 * Calculate motor score based on reaction time and accuracy
 */
export function calculateMotorScore(level1: Level1Result, level2: Level2Result): number {
  const avgRT = level2.avgReactionTime;
  const normalizedRT = Math.max(0, 10 - (avgRT / 1000)); // Under 1s = 10, over 10s = 0
  
  const accuracy = level2.accuracy;
  const accuracyScore = accuracy * 5;
  
  const consistencyBonus = level1.consistentInteraction ? 1 : 0;
  
  return Math.round(Math.min(10, normalizedRT + accuracyScore + consistencyBonus));
}

/**
 * Calculate attention score based on consistency and completion
 */
export function calculateAttentionScore(level1: Level1Result, level2: Level2Result): number {
  const completionRate = level2.trials.filter(t => t.response !== 'timeout').length / level2.trials.length;
  const completionScore = completionRate * 4;
  
  // Calculate consistency: variance in reaction times
  const reactionTimes = level2.trials
    .filter(t => t.reactionTimeMs)
    .map(t => t.reactionTimeMs!);
  
  const avgRT = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
  const variance = reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - avgRT, 2), 0) / reactionTimes.length;
  const consistencyScore = Math.max(0, 6 - (variance / 100000)); // Lower variance = better
  
  return Math.round(Math.min(10, completionScore + consistencyScore));
}

/**
 * Calculate overall confidence in the assessment
 */
export function calculateConfidence(level0: Level0Result, level1: Level1Result, level2: Level2Result): number {
  const trialCount = level2.trials.length;
  const responseCount = level2.trials.filter(t => t.response !== 'timeout').length;
  
  const completionConfidence = responseCount / trialCount;
  const consistencyConfidence = level1.consistentInteraction ? 1 : 0.5;
  const dataQualityConfidence = level0.attempts <= 3 ? 1 : 0.7;
  
  return Math.round((completionConfidence * 0.5 + consistencyConfidence * 0.3 + dataQualityConfidence * 0.2) * 1000) / 1000;
}

/**
 * Determine if assessment should gracefully exit
 */
export function shouldGracefullyExit(level0: Level0Result, currentTrialCount: number): {
  shouldExit: boolean;
  reason?: AssessmentResult['retryReason'];
} {
  // Level 0: No orientation after 3 attempts with increasing stimulus
  if (!level0.oriented && level0.attempts >= 3) {
    return { shouldExit: true, reason: 'no_response' };
  }
  
  // Too many timeouts suggests fatigue or distress
  if (currentTrialCount > 5) {
    const recentTimeouts = currentTrialCount; // Would track actual timeouts
    if (recentTimeouts > 4) {
      return { shouldExit: true, reason: 'fatigue_suspected' };
    }
  }
  
  return { shouldExit: false };
}
