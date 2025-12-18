/**
 * Adaptive Decision Engine v1 (Shadow Mode)
 * 
 * Computes a unified TodayFocus object that describes:
 * - What to prioritize (domains, exercises)
 * - How to adapt (difficulty, timeouts, cues)
 * - Why (reasoning, rules applied)
 * 
 * Phase A: Conservative rules only, high confidence required
 */

import type { PerformanceSignals } from './dailyLessonEngine';

// ============ Input Schema ============

export interface CapabilityScores {
  vision: number;
  motor: number;
  attention: number;
  confidence?: number;
}

export interface SpeechProfileSummary {
  errorTypeDistribution?: Record<string, number>;
  cueEfficacyByType?: Record<string, { successRate: number; trials: number }>;
  mostChallengingCategories?: string[];
  phonemeDifficultyMap?: Record<string, { accuracy: number; trials: number }>;
}

export interface SignalCounts {
  trialsLast14Days: number;
  utterancesWithAlignmentLast14Days: number;
  assessmentAgeDays: number;
}

export interface AdaptiveEngineInput {
  capabilityScores: CapabilityScores | null;
  performanceSignals: PerformanceSignals | null;
  speechProfile: SpeechProfileSummary | null;
  signalCounts: SignalCounts;
}

// ============ Output Schema ============

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProposedAdaptations {
  startDifficulty?: number;
  timeoutMultiplier?: number;
  preferredCueType?: 'semantic' | 'phonemic' | 'full_word';
  sessionDurationCap?: number;
  slowerTTS?: boolean;
  largeTargets?: boolean;
  focusPhonemes?: string[]; // Phonemes to target in word selection
  focusWords?: string[]; // Words to prioritize in exercises
}

export interface AppliedRule {
  ruleId: string;
  description: string;
  condition: string;
  adaptation: string;
}

export interface TodayFocus {
  // What to prioritize
  primaryDomains: string[];
  suggestedSessionMinutes: number;
  energyLevel: 'light' | 'moderate' | 'challenging';
  
  // How to adapt
  adaptations: ProposedAdaptations;
  
  // Why
  reasoning: string[];
  rulesApplied: AppliedRule[];
  confidence: ConfidenceLevel;
  
  // Metadata
  computedAt: string;
  inputSnapshot: {
    trialCount: number;
    utteranceCount: number;
    assessmentAgeDays: number;
    accuracy?: number;
    timeoutRate?: number;
  };
}

// ============ Confidence Calculator ============

/**
 * Compute confidence level based on data availability
 * Using user's adjusted thresholds (less aggressive than original)
 */
export function computeConfidenceLevel(counts: SignalCounts): ConfidenceLevel {
  const { trialsLast14Days, utterancesWithAlignmentLast14Days, assessmentAgeDays } = counts;
  
  // HIGH: ≥50 trials AND ≥20 aligned utterances AND assessment ≤30 days
  if (
    trialsLast14Days >= 50 &&
    utterancesWithAlignmentLast14Days >= 20 &&
    assessmentAgeDays <= 30
  ) {
    return 'HIGH';
  }
  
  // MEDIUM: ≥20 trials OR ≥10 aligned utterances
  if (trialsLast14Days >= 20 || utterancesWithAlignmentLast14Days >= 10) {
    return 'MEDIUM';
  }
  
  // LOW: below thresholds
  return 'LOW';
}

// ============ Phase A Rules (Conservative) ============

interface DecisionRule {
  id: string;
  description: string;
  minConfidence: ConfidenceLevel;
  phase: 'A' | 'B' | 'C';
  condition: (input: AdaptiveEngineInput) => boolean;
  conditionDescription: (input: AdaptiveEngineInput) => string;
  apply: (focus: TodayFocus, input: AdaptiveEngineInput) => void;
  adaptationDescription: string;
}

const PHASE_A_RULES: DecisionRule[] = [
  {
    id: 'semantic_error_dominant',
    description: 'Semantic errors are dominant error type',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      const dist = input.speechProfile?.errorTypeDistribution;
      if (!dist) return false;
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      if (total < 10) return false;
      const semanticPct = ((dist['semantic_related'] || 0) + (dist['semantic_paraphasia'] || 0)) / total;
      return semanticPct > 0.4;
    },
    conditionDescription: (input) => {
      const dist = input.speechProfile?.errorTypeDistribution;
      const total = dist ? Object.values(dist).reduce((a, b) => a + b, 0) : 0;
      const semantic = dist ? ((dist['semantic_related'] || 0) + (dist['semantic_paraphasia'] || 0)) : 0;
      return `Semantic errors: ${Math.round((semantic / total) * 100)}% of ${total} errors`;
    },
    apply: (focus) => {
      if (!focus.primaryDomains.includes('semantic')) {
        focus.primaryDomains.unshift('semantic');
      }
      focus.adaptations.preferredCueType = 'semantic';
      focus.reasoning.push('Prioritizing semantic exercises due to high semantic error rate');
    },
    adaptationDescription: 'Prioritize semantic domain, prefer semantic cues',
  },
  {
    id: 'high_timeout_low_attention',
    description: 'High timeout rate with low attention score',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      const timeoutRate = input.performanceSignals?.timeoutRate ?? 0;
      const attention = input.capabilityScores?.attention ?? 10;
      return timeoutRate > 0.25 && attention < 5;
    },
    conditionDescription: (input) => {
      const timeoutRate = input.performanceSignals?.timeoutRate ?? 0;
      const attention = input.capabilityScores?.attention ?? 10;
      return `Timeout rate: ${Math.round(timeoutRate * 100)}%, Attention: ${attention}/10`;
    },
    apply: (focus) => {
      focus.adaptations.timeoutMultiplier = 1.5;
      focus.suggestedSessionMinutes = Math.min(focus.suggestedSessionMinutes, 12);
      focus.reasoning.push('Extended timeouts and shorter session due to attention challenges');
    },
    adaptationDescription: 'Extend timeouts 1.5x, cap session at 12 min',
  },
  {
    id: 'fatigue_dropoff',
    description: 'High fatigue signal detected',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      return input.performanceSignals?.fatigueLevel === 'high';
    },
    conditionDescription: () => 'Fatigue level: high',
    apply: (focus) => {
      focus.suggestedSessionMinutes = Math.min(focus.suggestedSessionMinutes, 10);
      focus.energyLevel = 'light';
      focus.reasoning.push('Shorter session recommended due to fatigue signals');
    },
    adaptationDescription: 'Cap session at 10 min, light energy',
  },
  {
    id: 'low_accuracy_start_easier',
    description: 'Low recent accuracy suggests starting easier',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      const accuracy = input.performanceSignals?.avgAccuracy ?? 1;
      const trialCount = input.signalCounts.trialsLast14Days;
      // Only fire if we have enough data and accuracy is genuinely low
      return accuracy < 0.65 && trialCount >= 20;
    },
    conditionDescription: (input) => {
      const accuracy = input.performanceSignals?.avgAccuracy ?? 1;
      return `Accuracy: ${Math.round(accuracy * 100)}% (${input.signalCounts.trialsLast14Days} trials)`;
    },
    apply: (focus) => {
      focus.adaptations.startDifficulty = 1;
      focus.reasoning.push('Starting at easier difficulty to build confidence');
    },
    adaptationDescription: 'Start difficulty at level 1',
  },
  {
    id: 'high_frustration',
    description: 'High frustration signal detected',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      return input.performanceSignals?.frustrationLevel === 'high';
    },
    conditionDescription: () => 'Frustration level: high',
    apply: (focus) => {
      focus.adaptations.startDifficulty = 1;
      focus.adaptations.slowerTTS = true;
      focus.reasoning.push('Gentler approach due to frustration signals');
    },
    adaptationDescription: 'Start easy, slower TTS',
  },
  {
    id: 'motor_challenges',
    description: 'Motor score indicates motor challenges',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      const motor = input.capabilityScores?.motor ?? 10;
      return motor < 5;
    },
    conditionDescription: (input) => {
      return `Motor score: ${input.capabilityScores?.motor ?? 'N/A'}/10`;
    },
    apply: (focus) => {
      focus.adaptations.largeTargets = true;
      focus.adaptations.timeoutMultiplier = Math.max(focus.adaptations.timeoutMultiplier ?? 1, 1.3);
      focus.reasoning.push('Larger targets and extended timeouts for motor challenges');
    },
    adaptationDescription: 'Large touch targets, extended timeouts',
  },
  {
    id: 'phoneme_weakness_targeting',
    description: 'Target struggling phonemes in word selection',
    minConfidence: 'MEDIUM',
    phase: 'A',
    condition: (input) => {
      const phonemeMap = input.speechProfile?.phonemeDifficultyMap;
      if (!phonemeMap) return false;
      
      // Find phonemes with accuracy < 70% and >= 5 trials
      const strugglingPhonemes = Object.entries(phonemeMap)
        .filter(([_, stats]) => stats.accuracy < 70 && stats.trials >= 5);
      
      return strugglingPhonemes.length > 0;
    },
    conditionDescription: (input) => {
      const phonemeMap = input.speechProfile?.phonemeDifficultyMap;
      if (!phonemeMap) return 'No phoneme data';
      
      const struggling = Object.entries(phonemeMap)
        .filter(([_, stats]) => stats.accuracy < 70 && stats.trials >= 5)
        .map(([phoneme, stats]) => `${phoneme} ${stats.accuracy}%`)
        .slice(0, 3);
      
      return `Struggling phonemes: ${struggling.join(', ')}`;
    },
    apply: (focus, input) => {
      const phonemeMap = input.speechProfile?.phonemeDifficultyMap;
      if (!phonemeMap) return;
      
      // Get top 3 struggling phonemes
      const strugglingPhonemes = Object.entries(phonemeMap)
        .filter(([_, stats]) => stats.accuracy < 70 && stats.trials >= 5)
        .sort((a, b) => a[1].accuracy - b[1].accuracy)
        .slice(0, 3)
        .map(([phoneme]) => phoneme);
      
      if (strugglingPhonemes.length > 0) {
        focus.adaptations.focusPhonemes = strugglingPhonemes;
        focus.reasoning.push(
          `Targeting words with struggling phonemes: ${strugglingPhonemes.join(', ')}`
        );
      }
    },
    adaptationDescription: 'Prioritize words containing struggling phonemes',
  },
];

// ============ Engine Core ============

const CONFIDENCE_ALLOWS: Record<ConfidenceLevel, ConfidenceLevel[]> = {
  'HIGH': ['HIGH', 'MEDIUM', 'LOW'],
  'MEDIUM': ['MEDIUM', 'LOW'],
  'LOW': ['LOW'],
};

/**
 * Compute TodayFocus from available signals
 * Returns adaptations + reasoning for shadow mode display
 */
export function computeTodayFocus(input: AdaptiveEngineInput): TodayFocus {
  const confidence = computeConfidenceLevel(input.signalCounts);
  
  // Initialize with defaults
  const focus: TodayFocus = {
    primaryDomains: [],
    suggestedSessionMinutes: 15,
    energyLevel: 'moderate',
    adaptations: {},
    reasoning: [],
    rulesApplied: [],
    confidence,
    computedAt: new Date().toISOString(),
    inputSnapshot: {
      trialCount: input.signalCounts.trialsLast14Days,
      utteranceCount: input.signalCounts.utterancesWithAlignmentLast14Days,
      assessmentAgeDays: input.signalCounts.assessmentAgeDays,
      accuracy: input.performanceSignals?.avgAccuracy,
      timeoutRate: input.performanceSignals?.timeoutRate,
    },
  };
  
  // Low confidence = defaults only, no rules
  if (confidence === 'LOW') {
    focus.reasoning.push('Insufficient data for adaptive recommendations - using defaults');
    return focus;
  }
  
  // Apply Phase A rules that meet confidence threshold
  for (const rule of PHASE_A_RULES) {
    // Check if confidence level allows this rule
    if (!CONFIDENCE_ALLOWS[confidence].includes(rule.minConfidence)) {
      continue;
    }
    
    // Check rule condition
    if (rule.condition(input)) {
      // Apply the rule
      rule.apply(focus, input);
      
      // Record what fired
      focus.rulesApplied.push({
        ruleId: rule.id,
        description: rule.description,
        condition: rule.conditionDescription(input),
        adaptation: rule.adaptationDescription,
      });
    }
  }
  
  // If no rules fired, note that
  if (focus.rulesApplied.length === 0) {
    focus.reasoning.push('No adaptive rules triggered - performance within normal range');
  }
  
  return focus;
}

// ============ Confidence Badge Helpers ============

export function getConfidenceBadgeColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'HIGH': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'MEDIUM': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'LOW': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
}

export function getConfidenceDescription(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'HIGH': return 'Strong data foundation - adaptations reliable';
    case 'MEDIUM': return 'Moderate data - adaptations may be helpful';
    case 'LOW': return 'Limited data - using conservative defaults';
  }
}
