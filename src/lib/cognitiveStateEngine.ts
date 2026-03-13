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
    exerciseSlugs: ['photo-naming', 'word-finding', 'describe-guess', 'dual-load-naming'],
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
    exerciseSlugs: ['meaning-match', 'semantic-features', 'category-sorting', 'odd-one-out', 'abstract-compare'],
    icon: 'Layers',
  },
  {
    slug: 'executive_function',
    label: 'Executive Function',
    description: 'Reasoning, planning, and cognitive flexibility',
    exerciseSlugs: ['detective-mind', 'sequencing', 'multi-step-plan', 'dual-load-naming'],
    icon: 'Brain',
  },
  {
    slug: 'discourse_organization',
    label: 'Discourse Organization',
    description: 'Staying on topic, narrative structure, conversational flow',
    exerciseSlugs: ['conversation-partner', 'describe-guess', 'thought-organization', 'narrative-retell'],
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

export interface TransferComponents {
  independentAccuracy: number;
  scaffoldedAccuracy: number;
  nIndependent: number;
  nScaffolded: number;
}

export interface DomainScore {
  domainSlug: DomainSlug;
  score: number; // 0-1
  trialCount: number;
  confidence: 'high' | 'medium' | 'low';
  fatigueSensitivity: number | null;
  scoreComponents: Record<string, number>;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  transferIndex: number | null;
  transferComponents: TransferComponents | null;
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
  let coverageSum = 0, coverageCount = 0;
  let topicSum = 0, topicCount = 0;

  for (const t of trials) {
    const explanation = t.outputs?.explanation || t.inputs?.explanation;
    if (!explanation) continue;

    if (typeof explanation.coverageRatio === 'number') {
      coverageSum += explanation.coverageRatio;
      coverageCount++;
    }
    if (typeof explanation.onTopicScore === 'number') {
      topicSum += explanation.onTopicScore;
      topicCount++;
    }
  }

  return {
    avgCoverageRatio: coverageCount > 0 ? coverageSum / coverageCount : null,
    avgOnTopicScore: topicCount > 0 ? topicSum / topicCount : null,
    explanationCount: Math.max(coverageCount, topicCount),
  };
}

/**
 * Extract depth-task metrics from trial outputs.depth
 * Used for enhanced domain scoring (Phase 2)
 */
/** Clamp a value to [min, max] */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Minimum depth trials required before blending depth signals into domain scores */
const MIN_DEPTH_TRIALS_FOR_BLEND = 2;

/** Max mean utterance length for normalization (words) */
const MAX_MUL = 12;

function extractDepthMetrics(trials: ExerciseTrialRow[]): {
  avgCoherenceScore: number | null;
  avgEventCoverage: number | null;
  avgSequenceScore: number | null;
  avgAbstractionLevel: number | null;
  avgConceptCount: number | null;
  avgInterferenceIndex: number | null;
  avgMeanUtteranceLength: number | null;
  normalizedMUL: number | null;
  depthTrialCount: number;
} {
  let coherenceSum = 0, coherenceCount = 0;
  let eventCovSum = 0, eventCovCount = 0;
  let seqSum = 0, seqCount = 0;
  let absSum = 0, absCount = 0;
  let conceptSum = 0, conceptCount = 0;
  let interSum = 0, interCount = 0;
  let mulSum = 0, mulCount = 0;

  for (const t of trials) {
    const depth = t.outputs?.depth;
    if (!depth || typeof depth !== 'object') continue;

    if (typeof depth.coherenceScore === 'number') { coherenceSum += clamp(depth.coherenceScore, 0, 1); coherenceCount++; }
    if (typeof depth.eventCoverage === 'number') { eventCovSum += clamp(depth.eventCoverage, 0, 1); eventCovCount++; }
    if (typeof depth.sequenceScore === 'number') { seqSum += clamp(depth.sequenceScore, 0, 1); seqCount++; }
    if (typeof depth.abstractionLevel === 'number') { absSum += clamp(depth.abstractionLevel, 0, 1); absCount++; }
    if (typeof depth.conceptCount === 'number') { conceptSum += depth.conceptCount; conceptCount++; }
    if (typeof depth.interferenceIndex === 'number') { interSum += clamp(depth.interferenceIndex, 0, 1); interCount++; }
    if (typeof depth.meanUtteranceLength === 'number') { mulSum += clamp(depth.meanUtteranceLength, 0, MAX_MUL); mulCount++; }
  }

  const avgMUL = mulCount > 0 ? mulSum / mulCount : null;

  return {
    avgCoherenceScore: coherenceCount > 0 ? coherenceSum / coherenceCount : null,
    avgEventCoverage: eventCovCount > 0 ? eventCovSum / eventCovCount : null,
    avgSequenceScore: seqCount > 0 ? seqSum / seqCount : null,
    avgAbstractionLevel: absCount > 0 ? absSum / absCount : null,
    avgConceptCount: conceptCount > 0 ? conceptSum / conceptCount : null,
    avgInterferenceIndex: interCount > 0 ? interSum / interCount : null,
    avgMeanUtteranceLength: avgMUL,
    normalizedMUL: avgMUL !== null ? avgMUL / MAX_MUL : null,
    depthTrialCount: Math.max(coherenceCount, eventCovCount, seqCount, absCount, interCount, mulCount),
  };
}

// ============ Transfer Index ============

/**
 * Compute Transfer Index for a domain.
 * Compares independent (cue_level=0) vs scaffolded (cue_level≥1) accuracy.
 * Low index (<0.4) = gains aren't generalizing to independent performance.
 * 
 * Stores both raw values for interpretability per reviewer feedback.
 */
function computeTransferIndex(
  domainTrials: ExerciseTrialRow[]
): { transferIndex: number | null; transferComponents: TransferComponents | null } {
  const independent = domainTrials.filter(t => {
    const cueLevel = t.inputs?.cue_level ?? t.outputs?.cue_level ?? 0;
    return cueLevel === 0;
  });
  const scaffolded = domainTrials.filter(t => {
    const cueLevel = t.inputs?.cue_level ?? t.outputs?.cue_level;
    return cueLevel != null && cueLevel >= 1;
  });

  // Need minimum samples in both groups
  if (independent.length < 3 || scaffolded.length < 3) {
    return { transferIndex: null, transferComponents: null };
  }

  const independentAcc = computeAccuracy(independent);
  const scaffoldedAcc = computeAccuracy(scaffolded);

  // Avoid division by zero; if scaffolded accuracy is 0, transfer is 0
  const transferIndex = scaffoldedAcc > 0
    ? Math.min(1, independentAcc / scaffoldedAcc)
    : (independentAcc > 0 ? 1 : 0);

  return {
    transferIndex: Math.max(0, Math.min(1, transferIndex)),
    transferComponents: {
      independentAccuracy: independentAcc,
      scaffoldedAccuracy: scaffoldedAcc,
      nIndependent: independent.length,
      nScaffolded: scaffolded.length,
    },
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
      transferIndex: null,
      transferComponents: null,
    };
  }

  const accuracy = computeAccuracy(domainTrials);
  const fatigueSensitivity = computeFatigueSensitivity(domainTrials);

  // Base score is accuracy
  let score = accuracy;
  const components: Record<string, number> = { accuracy };

  // For semantic_depth and executive_function, blend in explanation + depth metrics
  if (domainSlug === 'semantic_depth' || domainSlug === 'executive_function') {
    const explanationMetrics = extractExplanationMetrics(domainTrials);
    const depthMetrics = extractDepthMetrics(domainTrials);
    
    if (explanationMetrics.avgCoverageRatio !== null) {
      components.coverageRatio = explanationMetrics.avgCoverageRatio;
      score = accuracy * 0.6 + explanationMetrics.avgCoverageRatio * 0.4;
    }
    
    if (explanationMetrics.avgOnTopicScore !== null) {
      components.onTopicScore = explanationMetrics.avgOnTopicScore;
    }

    components.explanationCount = explanationMetrics.explanationCount;

    if (domainSlug === 'semantic_depth') {
      // Only blend depth if enough trials exist to be meaningful
      if (depthMetrics.depthTrialCount >= MIN_DEPTH_TRIALS_FOR_BLEND && depthMetrics.avgAbstractionLevel !== null) {
        components.abstractionLevel = depthMetrics.avgAbstractionLevel;
        const coverage = explanationMetrics.avgCoverageRatio ?? accuracy;
        score = accuracy * 0.4 + coverage * 0.3 + depthMetrics.avgAbstractionLevel * 0.3;
      }
      if (depthMetrics.avgConceptCount !== null) {
        components.conceptCount = depthMetrics.avgConceptCount;
      }
      components.depthTrialCount = depthMetrics.depthTrialCount;
    }

    if (domainSlug === 'executive_function') {
      if (depthMetrics.avgSequenceScore !== null) {
        components.sequenceScore = depthMetrics.avgSequenceScore;
      }
      if (depthMetrics.avgInterferenceIndex !== null) {
        components.interferenceIndex = depthMetrics.avgInterferenceIndex;
      }
      const onTopic = explanationMetrics.avgOnTopicScore ?? accuracy;
      // Only blend depth signals if we have enough depth trials
      if (depthMetrics.depthTrialCount >= MIN_DEPTH_TRIALS_FOR_BLEND) {
        const seqScore = depthMetrics.avgSequenceScore;
        const interference = depthMetrics.avgInterferenceIndex;
        if (seqScore !== null && interference !== null) {
          score = accuracy * 0.3 + onTopic * 0.25 + seqScore * 0.25 + (1 - interference) * 0.2;
        } else if (seqScore !== null) {
          score = accuracy * 0.35 + onTopic * 0.3 + seqScore * 0.35;
        }
      } else if (explanationMetrics.avgCoverageRatio !== null) {
        score = accuracy * 0.4 + onTopic * 0.3 + explanationMetrics.avgCoverageRatio * 0.3;
      }
      components.depthTrialCount = depthMetrics.depthTrialCount;
    }
  }

  // For discourse_organization, blend coherence + event coverage from depth tasks
  if (domainSlug === 'discourse_organization') {
    const depthMetrics = extractDepthMetrics(domainTrials);
    
    // Reaction time as fluency proxy (existing)
    const rts = domainTrials
      .map(t => t.reaction_time_ms)
      .filter((rt): rt is number => rt !== null && rt > 0);
    
    if (rts.length >= 5) {
      const medianRt = rts.sort((a, b) => a - b)[Math.floor(rts.length / 2)];
      const rtScore = Math.max(0, Math.min(1, 1 - (medianRt - 3000) / 12000));
      components.rtScore = rtScore;
      score = accuracy * 0.7 + rtScore * 0.3;
    }

    // Record depth components even if below threshold (for visibility)
    if (depthMetrics.avgCoherenceScore !== null) {
      components.coherenceScore = depthMetrics.avgCoherenceScore;
    }
    if (depthMetrics.avgEventCoverage !== null) {
      components.eventCoverage = depthMetrics.avgEventCoverage;
    }
    if (depthMetrics.avgMeanUtteranceLength !== null) {
      components.meanUtteranceLength = depthMetrics.avgMeanUtteranceLength;
    }
    if (depthMetrics.normalizedMUL !== null) {
      components.normalizedMUL = depthMetrics.normalizedMUL;
    }
    // Only blend depth into score if enough trials
    if (depthMetrics.depthTrialCount >= MIN_DEPTH_TRIALS_FOR_BLEND
        && depthMetrics.avgCoherenceScore !== null && depthMetrics.avgEventCoverage !== null) {
      const rtScore = components.rtScore ?? 0.5;
      score = accuracy * 0.3 + depthMetrics.avgCoherenceScore * 0.25 + depthMetrics.avgEventCoverage * 0.25 + rtScore * 0.2;
    }
    components.depthTrialCount = depthMetrics.depthTrialCount;
  }

  // Compute transfer index for this domain
  const { transferIndex, transferComponents } = computeTransferIndex(domainTrials);

  return {
    domainSlug,
    score: Math.max(0, Math.min(1, score)),
    trialCount,
    confidence,
    fatigueSensitivity,
    scoreComponents: components,
    trend: 'insufficient', // Computed later from historical data
    transferIndex,
    transferComponents,
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
    transferIndex: null,
    transferComponents: null,
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
