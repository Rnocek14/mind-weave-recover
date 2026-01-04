/**
 * Stuck-Type Classifier for Thought Continuation Game
 * 
 * Tier A implementation using locally measurable metrics (no alignment required):
 * - latencyToFirstWordMs: time before speech started
 * - didSpeak: whether any speech was detected
 * - utteranceComplete: whether the thought reached a natural conclusion
 * - wordCount: number of words spoken
 * - durationMs: total recording duration
 * - narrowingLevelUsed: how many hints were needed
 * 
 * Classification helps the adaptive prompt selector choose better next prompts.
 */

export type StuckType = 
  | 'no_speech'           // User didn't speak at all
  | 'prompt_overload'     // High latency, struggled to start
  | 'word_search_stall'   // Started but got stuck mid-utterance  
  | 'thought_abandonment' // Started speaking but trailed off / gave up
  | 'strong_flow';        // Completed the thought with good momentum

export interface TierAMetrics {
  didSpeak: boolean;
  latencyToFirstWordMs: number | null;
  utteranceComplete: boolean;
  wordCount: number;
  durationMs: number;
  narrowingLevelUsed: number;
  // Optional Tier B metrics (when available)
  filledPauseRate?: number;
  longestPauseMs?: number;
  trailingOffDetected?: boolean;
}

export interface StuckTypeResult {
  stuckType: StuckType;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  metrics: {
    latencyCategory: 'fast' | 'normal' | 'slow' | 'very_slow' | 'none';
    lengthCategory: 'none' | 'minimal' | 'short' | 'adequate' | 'full';
    completionStatus: 'complete' | 'incomplete' | 'abandoned' | 'none';
  };
}

// Thresholds for classification (tunable based on user data)
const THRESHOLDS = {
  // Latency thresholds (ms) - more tolerant for thinking time
  LATENCY_FAST: 2000,
  LATENCY_NORMAL: 6000,
  LATENCY_SLOW: 10000,
  LATENCY_VERY_SLOW: 18000,
  
  // Word count thresholds - consider shorter responses as success
  WORDS_MINIMAL: 2,
  WORDS_SHORT: 4,
  WORDS_ADEQUATE: 7,
  
  // Duration thresholds (ms)
  DURATION_MINIMAL: 2000,
  DURATION_SHORT: 5000,
  
  // Narrowing level that suggests difficulty
  NARROWING_HIGH: 2,
};

/**
 * Classify the stuck type based on Tier A metrics
 */
export function classifyStuckType(metrics: TierAMetrics): StuckTypeResult {
  const { 
    didSpeak, 
    latencyToFirstWordMs, 
    utteranceComplete, 
    wordCount, 
    durationMs,
    narrowingLevelUsed,
    trailingOffDetected 
  } = metrics;

  // Categorize individual metrics
  const latencyCategory = categorizeLatency(latencyToFirstWordMs, didSpeak);
  const lengthCategory = categorizeLength(wordCount, durationMs);
  const completionStatus = categorizeCompletion(utteranceComplete, wordCount, trailingOffDetected);

  // Classification logic - order matters (most specific first)
  
  // 1. No speech at all
  if (!didSpeak || wordCount === 0) {
    return {
      stuckType: 'no_speech',
      confidence: 'high',
      reasoning: 'No speech detected during recording',
      metrics: { latencyCategory, lengthCategory: 'none', completionStatus: 'none' }
    };
  }

  // 2. Strong flow - completed thought with reasonable metrics
  if (
    utteranceComplete && 
    wordCount >= THRESHOLDS.WORDS_ADEQUATE &&
    (latencyCategory === 'fast' || latencyCategory === 'normal') &&
    narrowingLevelUsed === 0
  ) {
    return {
      stuckType: 'strong_flow',
      confidence: 'high',
      reasoning: 'Completed thought with good latency and no hints needed',
      metrics: { latencyCategory, lengthCategory, completionStatus }
    };
  }

  // 3. Thought abandonment - started but trailed off
  if (
    (trailingOffDetected || !utteranceComplete) &&
    wordCount >= THRESHOLDS.WORDS_MINIMAL &&
    wordCount < THRESHOLDS.WORDS_ADEQUATE
  ) {
    const confidence = trailingOffDetected ? 'high' : 'medium';
    return {
      stuckType: 'thought_abandonment',
      confidence,
      reasoning: trailingOffDetected 
        ? 'Speech trailed off before completing thought'
        : 'Short utterance that did not reach completion',
      metrics: { latencyCategory, lengthCategory, completionStatus: 'abandoned' }
    };
  }

  // 4. Prompt overload - high latency or needed lots of narrowing
  if (
    latencyCategory === 'very_slow' ||
    (latencyCategory === 'slow' && narrowingLevelUsed >= THRESHOLDS.NARROWING_HIGH)
  ) {
    return {
      stuckType: 'prompt_overload',
      confidence: latencyCategory === 'very_slow' ? 'high' : 'medium',
      reasoning: `High latency (${latencyToFirstWordMs}ms) suggests prompt was too broad`,
      metrics: { latencyCategory, lengthCategory, completionStatus }
    };
  }

  // 5. Word search stall - mid-utterance difficulty
  // This is our "default stuck" - started but struggled
  if (
    wordCount < THRESHOLDS.WORDS_ADEQUATE &&
    !utteranceComplete &&
    didSpeak
  ) {
    return {
      stuckType: 'word_search_stall',
      confidence: 'medium',
      reasoning: 'Started speaking but produced short incomplete utterance',
      metrics: { latencyCategory, lengthCategory, completionStatus: 'incomplete' }
    };
  }

  // 6. Moderate success - completed but with some difficulty
  if (utteranceComplete && wordCount >= THRESHOLDS.WORDS_SHORT) {
    return {
      stuckType: 'strong_flow',
      confidence: 'medium',
      reasoning: 'Completed thought, possibly with some hesitation',
      metrics: { latencyCategory, lengthCategory, completionStatus }
    };
  }

  // Fallback - minimal speech, unclear cause
  return {
    stuckType: 'word_search_stall',
    confidence: 'low',
    reasoning: 'Minimal speech detected, classification uncertain',
    metrics: { latencyCategory, lengthCategory, completionStatus }
  };
}

function categorizeLatency(
  latencyMs: number | null, 
  didSpeak: boolean
): 'fast' | 'normal' | 'slow' | 'very_slow' | 'none' {
  if (!didSpeak || latencyMs === null) return 'none';
  if (latencyMs < THRESHOLDS.LATENCY_FAST) return 'fast';
  if (latencyMs < THRESHOLDS.LATENCY_NORMAL) return 'normal';
  if (latencyMs < THRESHOLDS.LATENCY_SLOW) return 'slow';
  return 'very_slow';
}

function categorizeLength(
  wordCount: number, 
  durationMs: number
): 'none' | 'minimal' | 'short' | 'adequate' | 'full' {
  if (wordCount === 0) return 'none';
  if (wordCount < THRESHOLDS.WORDS_MINIMAL) return 'minimal';
  if (wordCount < THRESHOLDS.WORDS_SHORT) return 'short';
  if (wordCount < THRESHOLDS.WORDS_ADEQUATE) return 'adequate';
  return 'full';
}

function categorizeCompletion(
  utteranceComplete: boolean,
  wordCount: number,
  trailingOffDetected?: boolean
): 'complete' | 'incomplete' | 'abandoned' | 'none' {
  if (wordCount === 0) return 'none';
  if (trailingOffDetected) return 'abandoned';
  if (utteranceComplete) return 'complete';
  return 'incomplete';
}

/**
 * Get a human-readable label for the stuck type (for debug overlay)
 */
export function getStuckTypeLabel(stuckType: StuckType): string {
  const labels: Record<StuckType, string> = {
    'no_speech': 'No speech',
    'prompt_overload': 'Prompt overload',
    'word_search_stall': 'Word-search stall',
    'thought_abandonment': 'Trailing off',
    'strong_flow': 'Strong flow'
  };
  return labels[stuckType];
}

/**
 * Get intervention suggestion based on stuck type
 */
export function getInterventionHint(stuckType: StuckType): string {
  const hints: Record<StuckType, string> = {
    'no_speech': 'Try a more constrained prompt with time anchor',
    'prompt_overload': 'Narrow the prompt, use "today" or "last" anchors',
    'word_search_stall': 'Offer "say it another way" or intent choices',
    'thought_abandonment': 'Use "what happened next?" nudges, resolution prompts',
    'strong_flow': 'Can try slightly broader prompts'
  };
  return hints[stuckType];
}
