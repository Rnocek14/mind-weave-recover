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
import type { DomainScore } from './cognitiveStateEngine';

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

export interface DomainExposure7d {
  domainSlug: string;
  sessionCount: number;
  trialCount: number;
}

export interface AdaptiveEngineInput {
  capabilityScores: CapabilityScores | null;
  performanceSignals: PerformanceSignals | null;
  speechProfile: SpeechProfileSummary | null;
  signalCounts: SignalCounts;
  cognitiveDomainScores?: DomainScore[]; // Phase B: cognitive state engine scores
  domainExposure7d?: DomainExposure7d[]; // Phase B: real 7-day session exposure
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
    id: 'clinical_profile_naming_deficit',
    description: 'Clinical profile indicates naming/word-retrieval deficit (e.g. anomic aphasia)',
    minConfidence: 'LOW', // Fire even with minimal data — this is clinical ground truth
    phase: 'A',
    condition: (input) => {
      // This rule fires based on clinical profile, not performance data.
      // The clinical profile is embedded in capabilityScores via the hook chain.
      // We check for it via a flag set by the lesson engine.
      return !!(input as any)._clinicalAphasiaType && 
        ['anomic', 'broca', 'conduction'].includes((input as any)._clinicalAphasiaType);
    },
    conditionDescription: (input) => {
      return `Aphasia type: ${(input as any)._clinicalAphasiaType || 'unknown'}`;
    },
    apply: (focus, input) => {
      const type = (input as any)._clinicalAphasiaType;
      if (type === 'anomic') {
        if (!focus.primaryDomains.includes('language_production')) {
          focus.primaryDomains.unshift('language_production');
        }
        if (!focus.primaryDomains.includes('semantic')) {
          focus.primaryDomains.push('semantic');
        }
        focus.reasoning.push('Anomic aphasia — prioritizing naming and word retrieval exercises');
      } else if (type === 'broca') {
        if (!focus.primaryDomains.includes('language_production')) {
          focus.primaryDomains.unshift('language_production');
        }
        if (!focus.primaryDomains.includes('phonological')) {
          focus.primaryDomains.push('phonological');
        }
        focus.reasoning.push('Broca\'s aphasia — prioritizing expressive language and phonological exercises');
      } else if (type === 'conduction') {
        if (!focus.primaryDomains.includes('phonological')) {
          focus.primaryDomains.unshift('phonological');
        }
        focus.reasoning.push('Conduction aphasia — prioritizing phonological exercises');
      }
    },
    adaptationDescription: 'Prioritize domains matching aphasia type from clinical profile',
  },
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

// ============ Phase B Rules (Cognitive State Engine) ============

const PHASE_B_RULES: DecisionRule[] = [
  {
    id: 'executive_weakness',
    description: 'Executive function domain score is low',
    minConfidence: 'MEDIUM',
    phase: 'B',
    condition: (input) => {
      const ef = input.cognitiveDomainScores?.find(d => d.domainSlug === 'executive_function');
      return ef != null && ef.confidence !== 'low' && ef.score < 0.4;
    },
    conditionDescription: (input) => {
      const ef = input.cognitiveDomainScores?.find(d => d.domainSlug === 'executive_function');
      return `Executive Function: ${ef ? Math.round(ef.score * 100) : 'N/A'}%`;
    },
    apply: (focus) => {
      if (!focus.primaryDomains.includes('executive')) {
        focus.primaryDomains.push('executive');
      }
      focus.reasoning.push('Prioritizing reasoning exercises due to low executive function score');
    },
    adaptationDescription: 'Prioritize detective-mind and explanation-heavy exercises',
  },
  {
    id: 'endurance_decline',
    description: 'High fatigue sensitivity from cognitive endurance domain',
    minConfidence: 'MEDIUM',
    phase: 'B',
    condition: (input) => {
      const endurance = input.cognitiveDomainScores?.find(d => d.domainSlug === 'cognitive_endurance');
      return endurance != null && endurance.fatigueSensitivity != null && endurance.fatigueSensitivity > 0.3;
    },
    conditionDescription: (input) => {
      const endurance = input.cognitiveDomainScores?.find(d => d.domainSlug === 'cognitive_endurance');
      return `Fatigue sensitivity: ${endurance?.fatigueSensitivity != null ? Math.round(endurance.fatigueSensitivity * 100) : 'N/A'}%`;
    },
    apply: (focus) => {
      focus.suggestedSessionMinutes = Math.min(focus.suggestedSessionMinutes, 10);
      focus.energyLevel = 'light';
      focus.reasoning.push('Shorter sessions due to measured cognitive endurance decline');
    },
    adaptationDescription: 'Cap session at 10 min, light energy level',
  },
  {
    id: 'semantic_depth_gap',
    description: 'Semantic depth domain score significantly below other domains',
    minConfidence: 'MEDIUM',
    phase: 'B',
    condition: (input) => {
      const scores = input.cognitiveDomainScores?.filter(d => d.confidence !== 'low' && d.trialCount >= 10);
      if (!scores || scores.length < 3) return false;
      const semantic = scores.find(d => d.domainSlug === 'semantic_depth');
      if (!semantic) return false;
      const avgOthers = scores.filter(d => d.domainSlug !== 'semantic_depth')
        .reduce((sum, d) => sum + d.score, 0) / (scores.length - 1);
      return semantic.score < avgOthers - 0.15;
    },
    conditionDescription: (input) => {
      const semantic = input.cognitiveDomainScores?.find(d => d.domainSlug === 'semantic_depth');
      return `Semantic Depth: ${semantic ? Math.round(semantic.score * 100) : 'N/A'}% (gap vs other domains)`;
    },
    apply: (focus) => {
      if (!focus.primaryDomains.includes('semantic')) {
        focus.primaryDomains.push('semantic');
      }
      focus.reasoning.push('Semantic depth lags behind other domains — adding meaning-focused exercises');
    },
    adaptationDescription: 'Prioritize semantic depth exercises',
  },
  {
    id: 'low_transfer_index',
    description: 'Transfer index indicates gains are not generalizing',
    minConfidence: 'MEDIUM',
    phase: 'B',
    condition: (input) => {
      const scores = input.cognitiveDomainScores?.filter(
        d => d.transferIndex !== null && d.trialCount >= 15
      );
      if (!scores || scores.length < 2) return false;
      const avgTransfer = scores.reduce((sum, d) => sum + (d.transferIndex ?? 0), 0) / scores.length;
      return avgTransfer < 0.4;
    },
    conditionDescription: (input) => {
      const scores = input.cognitiveDomainScores?.filter(d => d.transferIndex !== null);
      if (!scores || scores.length === 0) return 'No transfer data';
      const avgTransfer = scores.reduce((sum, d) => sum + (d.transferIndex ?? 0), 0) / scores.length;
      return `Avg Transfer Index: ${Math.round(avgTransfer * 100)}% across ${scores.length} domains`;
    },
    apply: (focus) => {
      // Increase conversational/generative tasks, reduce drills
      if (!focus.primaryDomains.includes('discourse')) {
        focus.primaryDomains.push('discourse');
      }
      focus.reasoning.push(
        'Low transfer index (<40%) — increasing conversational tasks to improve generalization'
      );
    },
    adaptationDescription: 'Prioritize conversational and generative exercises over drills',
  },
  {
    id: 'domain_rotation_guardrail',
    description: 'Ensure all domains get minimum weekly exposure',
    minConfidence: 'MEDIUM',
    phase: 'B',
    condition: (input) => {
      // Use real 7-day session exposure data when available
      const exposure = input.domainExposure7d;
      if (exposure && exposure.length > 0) {
        const totalTrials = exposure.reduce((sum, d) => sum + d.trialCount, 0);
        if (totalTrials < 30) return false;
        return exposure.some(
          d => d.domainSlug !== 'cognitive_endurance' && d.sessionCount < 2
        );
      }
      // Fallback: use cognitiveDomainScores trialCount as rough proxy
      const scores = input.cognitiveDomainScores;
      if (!scores) return false;
      const totalTrials = scores.reduce((sum, d) => sum + d.trialCount, 0);
      if (totalTrials < 30) return false;
      return scores.some(
        d => d.domainSlug !== 'cognitive_endurance' && d.trialCount < 3
      );
    },
    conditionDescription: (input) => {
      const exposure = input.domainExposure7d;
      if (exposure && exposure.length > 0) {
        const underexposed = exposure
          .filter(d => d.domainSlug !== 'cognitive_endurance' && d.sessionCount < 2)
          .map(d => `${d.domainSlug} (${d.sessionCount} sessions)`);
        return `Underexposed (7d sessions): ${underexposed.join(', ') || 'none'}`;
      }
      const underexposed = input.cognitiveDomainScores
        ?.filter(d => d.domainSlug !== 'cognitive_endurance' && d.trialCount < 3)
        ?.map(d => d.domainSlug) || [];
      return `Underexposed (trial proxy): ${underexposed.join(', ') || 'none'}`;
    },
    apply: (focus, input) => {
      let underexposedSlugs: string[] = [];
      
      const exposure = input.domainExposure7d;
      if (exposure && exposure.length > 0) {
        // Use real session exposure — but don't override severe weakness domains
        const domainScores = input.cognitiveDomainScores;
        underexposedSlugs = exposure
          .filter(d => {
            if (d.domainSlug === 'cognitive_endurance') return false;
            if (d.sessionCount >= 2) return false;
            // Don't flag if severe weakness rules are already handling it
            const score = domainScores?.find(s => s.domainSlug === d.domainSlug);
            const isSeverelyWeak = score && score.confidence !== 'low' && score.score < 0.35;
            return !isSeverelyWeak;
          })
          .map(d => d.domainSlug);
      } else {
        underexposedSlugs = input.cognitiveDomainScores
          ?.filter(d => d.domainSlug !== 'cognitive_endurance' && d.trialCount < 3)
          ?.map(d => d.domainSlug) || [];
      }
      
      for (const domain of underexposedSlugs.slice(0, 2)) {
        if (!focus.primaryDomains.includes(domain)) {
          focus.primaryDomains.push(domain);
        }
      }
      if (underexposedSlugs.length > 0) {
        focus.reasoning.push(
          `Ensuring balanced recovery: adding underexposed domains (${underexposedSlugs.join(', ')})`
        );
      }
    },
    adaptationDescription: 'Add underexposed domains to session plan for balanced coverage',
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
  
  // Low confidence: still allow clinical-ground-truth rules (minConfidence: 'LOW')
  // but skip performance-dependent rules that need data to be meaningful
  if (confidence === 'LOW') {
    focus.reasoning.push('Limited performance data — using clinical profile for initial personalization');
    // Don't return early — let rules with minConfidence: 'LOW' still fire
  }
  
  // Apply Phase A + Phase B rules that meet confidence threshold
  const allRules = [...PHASE_A_RULES, ...PHASE_B_RULES];
  for (const rule of allRules) {
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
