/**
 * Cognitive State Engine v1
 * 
 * Computes recovery scores across 7 clinically meaningful domains
 * from exercise_events telemetry. Each domain produces a 0-1 normalized
 * score with confidence level and optional fatigue sensitivity.
 * 
 * Domain scoring version: 1
 */

// ============ Domain Definitions ============

export const COGNITIVE_DOMAINS = [
  {
    slug: 'lexical_retrieval',
    label: 'Lexical Retrieval',
    description: 'Word finding and naming ability',
    exerciseSlugs: ['photo-naming', 'word-finding', 'describe-guess'],
    icon: 'MessageSquare',
  },
  {
    slug: 'phonology',
    label: 'Phonology',
    description: 'Sound accuracy and phonological processing',
    exerciseSlugs: ['phonological-awareness', 'minimal-pairs', 'syllable-stress'],
    icon: 'Volume2',
  },
  {
    slug: 'syntax',
    label: 'Syntax',
    description: 'Sentence construction and grammar',
    exerciseSlugs: ['fix-sentence', 'sentence-game', 'sentence-building'],
    icon: 'AlignLeft',
  },
  {
    slug: 'semantic_depth',
    label: 'Semantic Depth',
    description: 'Meaning, categorization, and conceptual reasoning',
    exerciseSlugs: ['meaning-match', 'semantic-features', 'category-sorting', 'odd-one-out'],
    icon: 'Layers',
  },
  {
    slug: 'executive_function',
    label: 'Executive Function',
    description: 'Reasoning, planning, and cognitive flexibility',
    exerciseSlugs: ['detective-mind', 'sequencing'],
    icon: 'Brain',
  },
  {
    slug: 'discourse_organization',
    label: 'Discourse Organization',
    description: 'Staying on topic, narrative structure, conversational flow',
    exerciseSlugs: ['conversation-partner', 'describe-guess', 'thought-organization'],
    icon: 'MessageCircle',
  },
  {
    slug: 'cognitive_endurance',
    label: 'Cognitive Endurance',
    description: 'Ability to sustain performance over time',
    exerciseSlugs: [], // Computed across ALL exercises via fatigue slope
    icon: 'Battery',
  },
] as const;

export type DomainSlug = typeof COGNITIVE_DOMAINS[number]['slug'];

export const DOMAIN_VERSION = 1;

// ============ Types ============

export interface DomainScore {
  domainSlug: DomainSlug;
  score: number; // 0-1
  trialCount: number;
  confidence: 'high' | 'medium' | 'low';
  fatigueSensitivity: number | null;
  scoreComponents: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
}

export interface CognitiveStateSnapshot {
  domains: DomainScore[];
  computedAt: string;
  windowStart: string;
  windowEnd: string;
  granularity: 'day' | 'week' | 'month';
  domainVersion: number;
}

export interface ExerciseTrialRow {
  exercise_slug: string;
  score: number | null;
  reaction_time_ms: number | null;
  created_at: string;
  session_id: string;
  round: number;
  // Explanation telemetry (from inputs/outputs jsonb)
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

// ============ Scoring Functions ============

/**
 * Compute accuracy from trial rows (score > 0 = correct)
 */
function computeAccuracy(trials: ExerciseTrialRow[]): number {
  if (trials.length === 0) return 0;
  const correct = trials.filter(t => (t.score ?? 0) > 0).length;
  return correct / trials.length;
}

/**
 * Compute confidence based on trial count
 */
function computeConfidence(trialCount: number): 'high' | 'medium' | 'low' {
  if (trialCount >= 30) return 'high';
  if (trialCount >= 10) return 'medium';
  return 'low';
}

/**
 * Compute fatigue sensitivity using quartile comparison
 * Only computed if trial_count >= 20 within a single session
 * Returns average across sessions
 */
function computeFatigueSensitivity(
  trials: ExerciseTrialRow[]
): number | null {
  // Group trials by session
  const bySession = new Map<string, ExerciseTrialRow[]>();
  for (const t of trials) {
    const existing = bySession.get(t.session_id) || [];
    existing.push(t);
    bySession.set(t.session_id, existing);
  }

  const sessionDrops: number[] = [];

  for (const [, sessionTrials] of bySession) {
    if (sessionTrials.length < 20) continue;

    // Sort by round/created_at
    sessionTrials.sort((a, b) => a.round - b.round);

    const q1End = Math.floor(sessionTrials.length * 0.25);
    const q4Start = Math.floor(sessionTrials.length * 0.75);

    const q1Accuracy = computeAccuracy(sessionTrials.slice(0, q1End));
    const q4Accuracy = computeAccuracy(sessionTrials.slice(q4Start));

    if (q1Accuracy > 0) {
      const drop = (q1Accuracy - q4Accuracy) / q1Accuracy;
      sessionDrops.push(Math.max(0, drop)); // Only positive drops
    }
  }

  if (sessionDrops.length === 0) return null;
  return sessionDrops.reduce((a, b) => a + b, 0) / sessionDrops.length;
}

/**
 * Extract explanation-based metrics from trial outputs
 * Used for semantic_depth and executive_function scoring
 */
function extractExplanationMetrics(trials: ExerciseTrialRow[]): {
  avgCoverageRatio: number | null;
  avgOnTopicScore: number | null;
  explanationCount: number;
} {
  let coverageSum = 0, topicSum = 0, count = 0;

  for (const t of trials) {
    const explanation = t.outputs?.explanation || t.inputs?.explanation;
    if (!explanation) continue;

    if (typeof explanation.coverageRatio === 'number') {
      coverageSum += explanation.coverageRatio;
      count++;
    }
    if (typeof explanation.onTopicScore === 'number') {
      topicSum += explanation.onTopicScore;
    }
  }

  return {
    avgCoverageRatio: count > 0 ? coverageSum / count : null,
    avgOnTopicScore: count > 0 ? topicSum / count : null,
    explanationCount: count,
  };
}

// ============ Per-Domain Scorers ============

function scoreDomain(
  domainSlug: DomainSlug,
  domainTrials: ExerciseTrialRow[],
  allTrials: ExerciseTrialRow[]
): DomainScore {
  // Special case: cognitive_endurance uses ALL trials
  if (domainSlug === 'cognitive_endurance') {
    return scoreCognitiveEndurance(allTrials);
  }

  const trialCount = domainTrials.length;
  const confidence = computeConfidence(trialCount);

  if (trialCount < 3) {
    return {
      domainSlug,
      score: 0,
      trialCount,
      confidence: 'low',
      fatigueSensitivity: null,
      scoreComponents: {},
      trend: 'insufficient',
    };
  }

  const accuracy = computeAccuracy(domainTrials);
  const fatigueSensitivity = computeFatigueSensitivity(domainTrials);

  // Base score is accuracy
  let score = accuracy;
  const components: Record<string, number> = { accuracy };

  // For semantic_depth and executive_function, blend in explanation metrics
  if (domainSlug === 'semantic_depth' || domainSlug === 'executive_function') {
    const explanationMetrics = extractExplanationMetrics(domainTrials);
    
    if (explanationMetrics.avgCoverageRatio !== null) {
      components.coverageRatio = explanationMetrics.avgCoverageRatio;
      // Blend: 60% accuracy + 40% explanation depth
      score = accuracy * 0.6 + explanationMetrics.avgCoverageRatio * 0.4;
    }
    
    if (explanationMetrics.avgOnTopicScore !== null) {
      components.onTopicScore = explanationMetrics.avgOnTopicScore;
      // For executive function, on-topic score is more important
      if (domainSlug === 'executive_function' && explanationMetrics.avgCoverageRatio !== null) {
        score = accuracy * 0.4 + explanationMetrics.avgOnTopicScore * 0.3 + explanationMetrics.avgCoverageRatio * 0.3;
      }
    }
    
    components.explanationCount = explanationMetrics.explanationCount;
  }

  // For discourse_organization, factor in reaction time as proxy for fluency
  if (domainSlug === 'discourse_organization') {
    const rts = domainTrials
      .map(t => t.reaction_time_ms)
      .filter((rt): rt is number => rt !== null && rt > 0);
    
    if (rts.length >= 5) {
      const medianRt = rts.sort((a, b) => a - b)[Math.floor(rts.length / 2)];
      // Normalize: <3s = 1.0, >15s = 0.0
      const rtScore = Math.max(0, Math.min(1, 1 - (medianRt - 3000) / 12000));
      components.rtScore = rtScore;
      score = accuracy * 0.7 + rtScore * 0.3;
    }
  }

  return {
    domainSlug,
    score: Math.max(0, Math.min(1, score)),
    trialCount,
    confidence,
    fatigueSensitivity,
    scoreComponents: components,
    trend: 'insufficient', // Computed later from historical data
  };
}

function scoreCognitiveEndurance(allTrials: ExerciseTrialRow[]): DomainScore {
  const fatigueSensitivity = computeFatigueSensitivity(allTrials);
  const trialCount = allTrials.length;
  const confidence = computeConfidence(trialCount);

  // Endurance score = inverse of fatigue sensitivity
  // No fatigue drop = 1.0, 50% drop = 0.5, 100% drop = 0.0
  const score = fatigueSensitivity !== null
    ? Math.max(0, 1 - fatigueSensitivity)
    : 0;

  return {
    domainSlug: 'cognitive_endurance',
    score,
    trialCount,
    confidence: fatigueSensitivity !== null ? confidence : 'low',
    fatigueSensitivity,
    scoreComponents: {
      fatigueSensitivity: fatigueSensitivity ?? 0,
      sessionsAnalyzed: new Set(allTrials.map(t => t.session_id)).size,
    },
    trend: 'insufficient',
  };
}

// ============ Main Computation ============

/**
 * Compute cognitive state snapshot from exercise trial data
 */
export function computeCognitiveState(
  trials: ExerciseTrialRow[],
  windowStart: string,
  windowEnd: string,
  granularity: 'day' | 'week' | 'month' = 'week'
): CognitiveStateSnapshot {
  // Group trials by domain
  const trialsByDomain = new Map<DomainSlug, ExerciseTrialRow[]>();
  
  for (const domain of COGNITIVE_DOMAINS) {
    trialsByDomain.set(domain.slug, []);
  }

  for (const trial of trials) {
    if (!trial.exercise_slug) continue;
    
    for (const domain of COGNITIVE_DOMAINS) {
      if (domain.exerciseSlugs.length === 0) continue; // Skip cognitive_endurance (uses all)
      if ((domain.exerciseSlugs as readonly string[]).includes(trial.exercise_slug)) {
        trialsByDomain.get(domain.slug)!.push(trial);
      }
    }
  }

  // Score each domain
  const domains = COGNITIVE_DOMAINS.map(domain => 
    scoreDomain(domain.slug, trialsByDomain.get(domain.slug) || [], trials)
  );

  return {
    domains,
    computedAt: new Date().toISOString(),
    windowStart,
    windowEnd,
    granularity,
    domainVersion: DOMAIN_VERSION,
  };
}

/**
 * Compute trend from historical scores
 */
export function computeTrend(
  currentScore: number,
  previousScores: number[]
): 'improving' | 'stable' | 'declining' | 'insufficient' {
  if (previousScores.length < 2) return 'insufficient';

  const avgPrevious = previousScores.reduce((a, b) => a + b, 0) / previousScores.length;
  const diff = currentScore - avgPrevious;

  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}
