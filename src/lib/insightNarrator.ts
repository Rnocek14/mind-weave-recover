/**
 * Insight Narrator - Translates raw metrics into plain English narratives
 * 
 * This module transforms data-driven insights into human-readable sentences
 * that answer the 5 key user questions:
 * 1. Am I improving?
 * 2. What's hard for me right now?
 * 3. What's helping?
 * 4. What should I focus on next?
 * 5. Is anything wrong?
 */

import { LearningRate, findSpeechLearningRate } from '@/hooks/useLearningRate';
import { DailyTrend } from '@/hooks/useWeeklyTrends';
import { getCueLabel } from '@/lib/insightLanguageMap';

export type TrendVerdict = 'improving' | 'steady' | 'declining' | 'insufficient_data';

export interface RecoveryNarrative {
  verdict: TrendVerdict;
  headline: string;
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ChallengeNarrative {
  challenge: string;
  severity: 'high' | 'medium' | 'low';
  context?: string;
}

export interface StrategyNarrative {
  strategy: string;
  effectiveness: number; // 0-1
  context: string;
  cueType: 'semantic' | 'phonemic' | 'full_word' | 'none';
  totalGiven: number;
}

export interface FocusNarrative {
  recommendation: string;
  reason: string;
  priority: 'primary' | 'secondary';
}

/**
 * Determines overall recovery trend from learning rates and weekly trends
 */
export function narrateRecoveryTrend(
  learningRates: LearningRate[],
  weeklyTrends: DailyTrend[]
): RecoveryNarrative {
  // Check if we have enough data
  const totalTrials = weeklyTrends.reduce((sum, t) => sum + t.totalTrials, 0);
  if (totalTrials < 10) {
    return {
      verdict: 'insufficient_data',
      headline: 'Building your baseline',
      detail: 'Complete a few more sessions to see your progress trends.',
      confidence: 'low'
    };
  }

  // Calculate week-over-week change
  const recentDays = weeklyTrends.slice(-3);
  const earlierDays = weeklyTrends.slice(0, 4);
  
  const recentAccuracy = recentDays.length > 0 
    ? recentDays.reduce((sum, d) => sum + d.accuracy, 0) / recentDays.length 
    : 0;
  const earlierAccuracy = earlierDays.length > 0
    ? earlierDays.reduce((sum, d) => sum + d.accuracy, 0) / earlierDays.length
    : 0;
  
  const accuracyChange = recentAccuracy - earlierAccuracy;

  // Check learning rates for speech domain specifically
  const speechRate = findSpeechLearningRate(learningRates);
  const speechTrend = speechRate?.trend || 'plateau';

  // Determine verdict
  let verdict: TrendVerdict;
  let headline: string;
  let detail: string;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  if (accuracyChange > 5 || speechTrend === 'improving') {
    verdict = 'improving';
    headline = 'You\'re making progress!';
    if (accuracyChange > 10) {
      detail = `Your accuracy improved ${Math.round(accuracyChange)}% this week. Keep it up!`;
      confidence = 'high';
    } else if (speechTrend === 'improving') {
      detail = 'Your word retrieval is getting stronger with practice.';
    } else {
      detail = 'Steady improvement across your sessions.';
    }
  } else if (accuracyChange < -10 || speechTrend === 'declining') {
    verdict = 'declining';
    headline = 'A challenging week';
    detail = 'Some sessions were harder than usual. This is normal—recovery isn\'t linear.';
    confidence = accuracyChange < -15 ? 'high' : 'medium';
  } else {
    verdict = 'steady';
    headline = 'Holding steady';
    detail = 'Your performance is consistent. Consistency builds lasting progress.';
    confidence = 'medium';
  }

  return { verdict, headline, detail, confidence };
}

/**
 * Identifies top challenges from error patterns and fluency metrics
 */
export function narrateChallenges(
  challengingTargets: { target: string; errorRate: number; attempts: number }[],
  fluencyMetrics: { avgSpeechRateWpm: number | null; effortfulSpeechRate: number } | null,
  errorBreakdown: { timeout: number; no_response: number; semantic_paraphasia: number; phonemic_paraphasia: number } | null
): ChallengeNarrative[] {
  const challenges: ChallengeNarrative[] = [];

  // Check for word finding difficulty
  if (challengingTargets.length > 0) {
    const hardestWord = challengingTargets[0];
    if (hardestWord.errorRate > 0.5) {
      challenges.push({
        challenge: 'Word finding under pressure',
        severity: 'high',
        context: `Words like "${hardestWord.target}" are challenging`
      });
    }
  }

  // Check for effortful speech
  if (fluencyMetrics?.effortfulSpeechRate && fluencyMetrics.effortfulSpeechRate > 0.3) {
    challenges.push({
      challenge: 'Speech feels effortful',
      severity: fluencyMetrics.effortfulSpeechRate > 0.5 ? 'high' : 'medium',
      context: 'Pauses and hesitations are common—this is part of recovery'
    });
  }

  // Check for timeouts
  if (errorBreakdown) {
    const totalErrors = Object.values(errorBreakdown).reduce((a, b) => a + b, 0);
    const timeoutRate = totalErrors > 0 ? errorBreakdown.timeout / totalErrors : 0;
    
    if (timeoutRate > 0.25) {
      challenges.push({
        challenge: 'Need more time to respond',
        severity: 'medium',
        context: 'Rushing can increase stress—take your time'
      });
    }
  }

  // Check for semantic vs phonemic pattern
  if (errorBreakdown) {
    const semanticErrors = errorBreakdown.semantic_paraphasia;
    const phonemicErrors = errorBreakdown.phonemic_paraphasia;
    
    if (semanticErrors > phonemicErrors * 2 && semanticErrors > 3) {
      challenges.push({
        challenge: 'Accessing word meanings',
        severity: 'medium',
        context: 'You know what you want to say but finding the right word is hard'
      });
    } else if (phonemicErrors > semanticErrors * 2 && phonemicErrors > 3) {
      challenges.push({
        challenge: 'Sound patterns',
        severity: 'medium',
        context: 'The meaning is clear but sounds get mixed up'
      });
    }
  }

  return challenges.slice(0, 3); // Return top 3 challenges
}

/**
 * Identifies what strategies are working best
 */
export function narrateStrategies(
  cueEfficacy: { cueType: string; efficacyRate: number; totalGiven: number }[] | null,
  bestCueType: string | null
): StrategyNarrative | null {
  if (!cueEfficacy || cueEfficacy.length === 0) {
    return null;
  }

  // Find the most effective cue with enough data
  const effectiveCues = cueEfficacy
    .filter(c => c.totalGiven >= 3)
    .sort((a, b) => b.efficacyRate - a.efficacyRate);

  if (effectiveCues.length === 0) {
    return null;
  }

  const best = effectiveCues[0];
  
  // Use centralized language mapping for cue type names
  const friendlyName = getCueLabel(best.cueType);
  
  let context: string;
  if (best.efficacyRate > 0.7) {
    context = `Works ${Math.round(best.efficacyRate * 100)}% of the time—this is your best strategy`;
  } else if (best.efficacyRate > 0.5) {
    context = `Helps more than half the time`;
  } else {
    context = `Provides some support when you\'re stuck`;
  }

  return {
    strategy: friendlyName,
    effectiveness: best.efficacyRate,
    context,
    cueType: best.cueType as 'semantic' | 'phonemic' | 'full_word' | 'none',
    totalGiven: best.totalGiven
  };
}

/**
 * Generates today's recommended focus
 */
export function narrateFocus(
  recommendations: string[],
  challenges: ChallengeNarrative[],
  learningRates: LearningRate[]
): FocusNarrative[] {
  const focuses: FocusNarrative[] = [];

  // Primary focus from recommendations
  if (recommendations.length > 0) {
    focuses.push({
      recommendation: recommendations[0],
      reason: 'Based on your recent performance patterns',
      priority: 'primary'
    });
  }

  // Secondary focus from challenges
  if (challenges.length > 0 && challenges[0].severity === 'high') {
    focuses.push({
      recommendation: `Work on ${challenges[0].challenge.toLowerCase()}`,
      reason: challenges[0].context || 'This is your biggest opportunity for growth',
      priority: 'secondary'
    });
  }

  // If improving in a domain, suggest stretching
  const improvingDomain = learningRates.find(r => r.trend === 'improving');
  if (improvingDomain && focuses.length < 2) {
    focuses.push({
      recommendation: `You're ready for more challenge in ${improvingDomain.domain}`,
      reason: 'Your progress here is strong',
      priority: 'secondary'
    });
  }

  return focuses.slice(0, 2);
}

/**
 * Formats fluency metrics into readable text
 */
export function narrateFluency(
  avgSpeechRateWpm: number | null,
  effortfulSpeechRate: number | null
): string | null {
  if (avgSpeechRateWpm === null) return null;

  if (avgSpeechRateWpm < 30) {
    return 'Speaking is effortful right now—take your time';
  } else if (avgSpeechRateWpm < 60) {
    return 'Your pace is steady and deliberate';
  } else if (effortfulSpeechRate && effortfulSpeechRate < 0.2) {
    return 'Speech is flowing more naturally';
  } else {
    return 'Good rhythm in your responses';
  }
}

/**
 * Returns appropriate emoji for trend verdict
 */
export function getVerdictEmoji(verdict: TrendVerdict): string {
  switch (verdict) {
    case 'improving': return '📈';
    case 'steady': return '➡️';
    case 'declining': return '📊';
    case 'insufficient_data': return '🌱';
    default: return '📊';
  }
}

/**
 * Returns appropriate color class for trend verdict
 */
export function getVerdictColor(verdict: TrendVerdict): string {
  switch (verdict) {
    case 'improving': return 'text-success';
    case 'steady': return 'text-primary';
    case 'declining': return 'text-warning';
    case 'insufficient_data': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
}

/**
 * Returns severity badge variant
 */
export function getSeverityVariant(severity: 'high' | 'medium' | 'low'): 'destructive' | 'secondary' | 'outline' {
  switch (severity) {
    case 'high': return 'destructive';
    case 'medium': return 'secondary';
    case 'low': return 'outline';
    default: return 'outline';
  }
}
