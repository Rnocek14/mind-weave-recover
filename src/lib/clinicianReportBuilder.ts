/**
 * Clinician Report Builder
 * 
 * Generates a structured, medical-grade report from analytics data.
 * Single source of truth for clinical export.
 */

import { DailyTrend } from '@/hooks/useWeeklyTrends';
import { LearningRate } from '@/hooks/useLearningRate';

// Report types
export interface ClinicianReport {
  window: { label: string; start: string; end: string; days: number };
  sample: { trials: number; practiceDays: number };
  confidence: { level: 'low' | 'medium' | 'high'; reasons: string[] };
  recovery: { 
    verdict: string; 
    headline: string; 
    detail: string; 
    evidence: string[];
    accuracyChange: number | null;
  };
  errors: { 
    distribution: { type: string; count: number; rate: number }[]; 
    topChallenges: { target: string; errorRate: number; attempts: number }[];
    notes: string[] 
  };
  cues: { 
    byType: { cueType: string; efficacy: number; n: number }[]; 
    recommendation: string;
    bestType: string | null;
  };
  fluency: { 
    avgWpm: number | null;
    effortfulRate: number;
    /**
     * Fraction of trials that carried fluency telemetry, or null when the
     * pipeline does not report it. Never fabricate this: a report row that
     * looks measured but is a constant is worse than an honest null.
     */
    availableRate: number | null;
    unavailableReasons: { reason: string; n: number }[]; 
    notes: string[] 
  };
  plan: { items: { title: string; rationale: string; priority: 'primary' | 'secondary' }[] };
  alerts: { items: string[] };
  generatedAt: string;
}

interface ErrorBreakdown {
  correct: number;
  attempted: number;
  semantic_paraphasia: number;
  phonemic_paraphasia: number;
  circumlocution: number;
  neologism: number;
  no_response: number;
  timeout: number;
}

interface CueEfficacy {
  cueType: string;
  totalGiven: number;
  effectiveCount: number;
  efficacyRate: number;
  avgTimeToSuccessMs: number | null;
}

interface FluencyMetrics {
  avgSpeechRateWpm: number | null;
  avgPauseCount: number | null;
  avgPauseDurationMs: number | null;
  effortfulSpeechRate: number;
}

interface ErrorAnalytics {
  errorBreakdown: ErrorBreakdown;
  cueEfficacy: CueEfficacy[];
  fluencyMetrics: FluencyMetrics;
  totalTrials: number;
  overallAccuracy: number;
  challengingTargets: { target: string; errorRate: number; attempts: number }[];
  categoryPerformance: { category: string; accuracy: number; attempts: number }[];
}

interface CorrelationData {
  recommendations?: string[];
  optimalConditions?: {
    bestCueType?: string;
  };
}

interface RedFlag {
  type: string;
  message: string;
  severity: 'red' | 'yellow' | 'green';
}

/**
 * Calculate confidence level from sample size
 */
function calculateConfidence(n: number, thresholds = { low: 10, medium: 30 }): 'low' | 'medium' | 'high' {
  if (n >= thresholds.medium) return 'high';
  if (n >= thresholds.low) return 'medium';
  return 'low';
}

/**
 * Build a clinician-grade report from analytics data
 */
export function buildClinicianReport(
  trends: DailyTrend[],
  learningRates: LearningRate[],
  errorAnalytics: ErrorAnalytics | null,
  correlations: CorrelationData | null,
  redFlags: RedFlag[],
  windowDays: number = 7
): ClinicianReport {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  
  // Filter trends to window
  const windowTrends = trends.filter(t => new Date(t.date) >= windowStart);
  const totalTrials = windowTrends.reduce((sum, t) => sum + t.totalTrials, 0);
  const practiceDays = windowTrends.filter(t => t.totalTrials > 0).length;
  
  // Calculate confidence
  const confidenceLevel = calculateConfidence(totalTrials);
  const confidenceReasons: string[] = [];
  if (totalTrials < 10) confidenceReasons.push('Limited sample size (<10 trials)');
  if (practiceDays < 3) confidenceReasons.push('Few practice days (<3 days)');
  if (confidenceLevel === 'high') confidenceReasons.push('Sufficient data for reliable trends');
  
  // Recovery analysis
  const recentDays = windowTrends.slice(-3);
  const earlierDays = windowTrends.slice(0, Math.max(0, windowTrends.length - 3));
  
  const recentAccuracy = recentDays.length > 0 
    ? recentDays.reduce((sum, d) => sum + d.accuracy, 0) / recentDays.length 
    : 0;
  const earlierAccuracy = earlierDays.length > 0
    ? earlierDays.reduce((sum, d) => sum + d.accuracy, 0) / earlierDays.length
    : 0;
  const accuracyChange = recentAccuracy - earlierAccuracy;
  
  let recoveryVerdict: string;
  let recoveryHeadline: string;
  let recoveryDetail: string;
  
  if (totalTrials < 10) {
    recoveryVerdict = 'insufficient_data';
    recoveryHeadline = 'Building baseline';
    recoveryDetail = 'More sessions needed for reliable trend analysis.';
  } else if (accuracyChange > 5) {
    recoveryVerdict = 'improving';
    recoveryHeadline = 'Positive trajectory';
    recoveryDetail = `Accuracy improved ${Math.round(accuracyChange)}% over the window.`;
  } else if (accuracyChange < -10) {
    recoveryVerdict = 'declining';
    recoveryHeadline = 'Challenging period';
    recoveryDetail = 'Recent performance below earlier levels. Consider session adjustments.';
  } else {
    recoveryVerdict = 'steady';
    recoveryHeadline = 'Stable performance';
    recoveryDetail = 'Consistent accuracy maintained.';
  }
  
  const recoveryEvidence: string[] = [
    `${totalTrials} trials across ${practiceDays} practice days`,
  ];
  
  const namingRate = learningRates.find(r => r.domain === 'naming');
  if (namingRate?.accuracySlope) {
    recoveryEvidence.push(
      `Learning rate: ${namingRate.accuracySlope > 0 ? '+' : ''}${(namingRate.accuracySlope * 100).toFixed(1)}%/week (n=${namingRate.trialCount})`
    );
  }
  
  // Error distribution
  const errorDistribution: { type: string; count: number; rate: number }[] = [];
  if (errorAnalytics) {
    const breakdown = errorAnalytics.errorBreakdown;
    const total = errorAnalytics.totalTrials || 1;
    
    const types = [
      { type: 'Correct', count: breakdown.correct },
      { type: 'Attempted', count: breakdown.attempted },
      { type: 'Semantic paraphasia', count: breakdown.semantic_paraphasia },
      { type: 'Phonemic paraphasia', count: breakdown.phonemic_paraphasia },
      { type: 'Circumlocution', count: breakdown.circumlocution },
      { type: 'Neologism', count: breakdown.neologism },
      { type: 'No response', count: breakdown.no_response },
      { type: 'Timeout', count: breakdown.timeout },
    ];
    
    types.forEach(t => {
      if (t.count > 0) {
        errorDistribution.push({
          type: t.type,
          count: t.count,
          rate: t.count / total,
        });
      }
    });
    
    errorDistribution.sort((a, b) => b.count - a.count);
  }
  
  const errorNotes: string[] = [];
  if (errorAnalytics) {
    if (errorAnalytics.errorBreakdown.timeout > errorAnalytics.totalTrials * 0.2) {
      errorNotes.push('High timeout rate suggests need for extended response windows.');
    }
    if (errorAnalytics.errorBreakdown.circumlocution > errorAnalytics.errorBreakdown.semantic_paraphasia) {
      errorNotes.push('Circumlocution frequency indicates intact semantic knowledge with retrieval difficulty.');
    }
  }
  
  // Cue efficacy
  const cuesByType = (errorAnalytics?.cueEfficacy || [])
    .filter(c => c.totalGiven >= 3)
    .map(c => ({
      cueType: c.cueType,
      efficacy: c.efficacyRate,
      n: c.totalGiven,
    }))
    .sort((a, b) => b.efficacy - a.efficacy);
  
  const bestCue = cuesByType[0];
  let cueRecommendation = 'Insufficient cue data for recommendations.';
  if (bestCue) {
    if (bestCue.efficacy > 0.7) {
      cueRecommendation = `${bestCue.cueType} cues highly effective (${Math.round(bestCue.efficacy * 100)}%). Continue current cueing strategy.`;
    } else if (bestCue.efficacy > 0.4) {
      cueRecommendation = `${bestCue.cueType} cues moderately effective. Consider escalation protocol.`;
    } else {
      cueRecommendation = 'Current cueing shows limited efficacy. Review cueing hierarchy.';
    }
  }
  
  // Fluency
  const fluency = errorAnalytics?.fluencyMetrics;
  const fluencyNotes: string[] = [];
  if (fluency) {
    if (fluency.avgSpeechRateWpm && fluency.avgSpeechRateWpm < 40) {
      fluencyNotes.push('Speech rate below typical conversational pace.');
    }
    if (fluency.effortfulSpeechRate > 0.3) {
      fluencyNotes.push(`Effortful speech detected in ${Math.round(fluency.effortfulSpeechRate * 100)}% of trials.`);
    }
  }
  
  // Plan
  const planItems: { title: string; rationale: string; priority: 'primary' | 'secondary' }[] = [];
  const recommendations = correlations?.recommendations || [];
  
  if (recommendations.length > 0) {
    planItems.push({
      title: recommendations[0],
      rationale: 'Based on performance pattern analysis',
      priority: 'primary',
    });
  }
  
  if (recommendations.length > 1) {
    planItems.push({
      title: recommendations[1],
      rationale: 'Secondary focus area',
      priority: 'secondary',
    });
  }
  
  // Alerts
  const alertItems = redFlags
    .filter(f => f.severity === 'red' || f.severity === 'yellow')
    .map(f => f.message);
  
  return {
    window: {
      label: `Last ${windowDays} days`,
      start: windowStart.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      days: windowDays,
    },
    sample: {
      trials: totalTrials,
      practiceDays,
    },
    confidence: {
      level: confidenceLevel,
      reasons: confidenceReasons,
    },
    recovery: {
      verdict: recoveryVerdict,
      headline: recoveryHeadline,
      detail: recoveryDetail,
      evidence: recoveryEvidence,
      accuracyChange,
    },
    errors: {
      distribution: errorDistribution.slice(0, 8),
      topChallenges: errorAnalytics?.challengingTargets.slice(0, 5) || [],
      notes: errorNotes,
    },
    cues: {
      byType: cuesByType,
      recommendation: cueRecommendation,
      bestType: bestCue?.cueType || null,
    },
    fluency: {
      avgWpm: fluency?.avgSpeechRateWpm || null,
      effortfulRate: fluency?.effortfulSpeechRate || 0,
      // Honest null — the analytics input does not report how many trials
      // carried fluency data, and shipping a hardcoded 0.8 in a clinical
      // report fabricates a measurement. Compute from real per-trial
      // telemetry counts before ever setting a number here.
      availableRate: null,
      unavailableReasons: [],
      notes: fluencyNotes,
    },
    plan: { items: planItems },
    alerts: { items: alertItems },
    generatedAt: now.toISOString(),
  };
}
