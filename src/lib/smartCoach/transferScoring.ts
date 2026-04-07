/**
 * Transfer Scoring System
 * 
 * Measures whether skills practiced in drills transfer to real conversation.
 * This is the core clinical metric that differentiates the product.
 * 
 * Transfer Score 0–4:
 *   0 = No transfer (target absent)
 *   1 = Recognition only (understood but not produced)
 *   2 = Supported transfer (produced with heavy cue)
 *   3 = Functional transfer (produced with minimal cue in scenario)
 *   4 = Spontaneous transfer (produced naturally, no cue)
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type TransferTargetType = 'word' | 'phrase' | 'strategy';

export interface TransferTarget {
  /** The word/phrase/strategy practiced */
  value: string;
  type: TransferTargetType;
  /** Real-world context for transfer check */
  functionalContext: string;
}

export interface TransferCheckInput {
  /** What was practiced in the drill */
  targets: TransferTarget[];
  /** What the user said in the transfer turn */
  userResponse: string;
  /** Cue level needed (0 = none, 1-4 escalating) */
  cueLevelNeeded: number;
  /** Response latency in ms (null if unavailable) */
  latencyMs: number | null;
  /** Baseline latency for comparison (null if unavailable) */
  baselineLatencyMs: number | null;
  /** Breakdown signals detected */
  breakdownSignals: {
    longPause: boolean;
    fillerCount: number;
    restart: boolean;
    abandonment: boolean;
  };
  /** Whether Maya modeled the word first */
  usedAfterModel: boolean;
}

export interface TransferCheckResult {
  /** Overall transfer score 0–4 */
  transferScore: number;
  /** Raw score 0–100 */
  rawScore: number;
  /** Per-target results */
  targetResults: TargetTransferResult[];
  /** Component scores */
  components: {
    targetReuse: number;
    cueIndependence: number;
    latencyEase: number;
    functionalFit: number;
  };
  /** Human-readable label */
  label: TransferLabel;
}

export interface TargetTransferResult {
  target: string;
  found: boolean;
  approximation: 'exact' | 'semantic' | 'phonemic' | 'absent';
}

export type TransferLabel = 
  | 'not_yet'
  | 'recognized'
  | 'with_help'
  | 'used_it'
  | 'used_independently';

// ═══════════════════════════════════════════════════════════════
// Scoring Logic
// ═══════════════════════════════════════════════════════════════

/** Check if a target word appears in the response (case-insensitive, fuzzy) */
function findTargetInResponse(target: string, response: string): TargetTransferResult {
  const lower = response.toLowerCase();
  const targetLower = target.toLowerCase();
  
  // Exact match (word boundary to avoid "cat" matching "caterpillar")
  const exactPattern = new RegExp(`\\b${targetLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (exactPattern.test(response)) {
    return { target, found: true, approximation: 'exact' };
  }
  
  // Phonemic approximation: first 3+ chars match
  const prefix = targetLower.slice(0, Math.min(3, targetLower.length));
  const words = lower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(prefix) && word.length >= targetLower.length - 2) {
      return { target, found: true, approximation: 'phonemic' };
    }
  }
  
  // Semantic approximation: check for common synonyms/descriptions
  // (simplified — in production this would use embeddings)
  // For now, partial match of 60%+ characters
  for (const word of words) {
    if (word.length >= 3 && targetLower.length >= 3) {
      const commonChars = [...word].filter(c => targetLower.includes(c)).length;
      if (commonChars / targetLower.length >= 0.6 && word.length >= targetLower.length - 2) {
        return { target, found: true, approximation: 'semantic' };
      }
    }
  }
  
  return { target, found: false, approximation: 'absent' };
}

/** Compute target reuse score (0–100) */
function computeTargetReuseScore(targetResults: TargetTransferResult[], usedAfterModel: boolean): number {
  if (targetResults.length === 0) return 0;
  
  const scores = targetResults.map(r => {
    if (!r.found) return 0;
    switch (r.approximation) {
      case 'exact': return 100;
      case 'phonemic': return 70;
      case 'semantic': return 70;
      case 'absent': return 0;
    }
  });
  
  let avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Penalty if only used after Maya modeled it
  if (usedAfterModel && avg > 0) {
    avg = Math.min(avg, 40);
  }
  
  return avg;
}

/** Compute cue independence score (0–100) */
function computeCueIndependenceScore(cueLevelNeeded: number): number {
  switch (cueLevelNeeded) {
    case 0: return 100;
    case 1: return 75;
    case 2: return 50;
    case 3: return 25;
    default: return 0;
  }
}

/** Compute latency/ease score (0–100) */
function computeLatencyEaseScore(
  latencyMs: number | null,
  baselineMs: number | null,
  breakdownSignals: TransferCheckInput['breakdownSignals'],
): number {
  // Start from breakdown signals
  let score = 100;
  
  if (breakdownSignals.abandonment) return 0;
  if (breakdownSignals.longPause) score -= 30;
  if (breakdownSignals.restart) score -= 20;
  score -= breakdownSignals.fillerCount * 10;
  
  // Latency comparison if available
  if (latencyMs !== null && baselineMs !== null && baselineMs > 0) {
    const ratio = latencyMs / baselineMs;
    if (ratio <= 0.8) score = Math.min(score, 100); // faster
    else if (ratio <= 1.0) score = Math.min(score, 85);
    else if (ratio <= 1.5) score = Math.min(score, 60);
    else score = Math.min(score, 30);
  } else if (latencyMs !== null) {
    // No baseline, use absolute thresholds
    if (latencyMs < 2000) score = Math.min(score, 100);
    else if (latencyMs < 4000) score = Math.min(score, 75);
    else if (latencyMs < 8000) score = Math.min(score, 50);
    else score = Math.min(score, 25);
  }
  
  return Math.max(0, score);
}

/** Compute functional fit score (0–100) */
function computeFunctionalFitScore(
  targetResults: TargetTransferResult[],
  userResponse: string,
  cueLevelNeeded: number,
): number {
  const anyFound = targetResults.some(r => r.found);
  if (!anyFound) return 0;
  
  const wordCount = userResponse.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // Used in a sentence (functional context) vs isolated word
  if (wordCount >= 5) return 100;  // Full sentence
  if (wordCount >= 3) return 70;   // Short phrase
  if (wordCount >= 1 && cueLevelNeeded <= 1) return 40; // Isolated but independent
  return 20; // Isolated with support
}

/** Score transfer from raw to 0–4 bucket */
function bucketScore(raw: number): number {
  if (raw >= 80) return 4;
  if (raw >= 60) return 3;
  if (raw >= 40) return 2;
  if (raw >= 20) return 1;
  return 0;
}

function scoreToLabel(score: number): TransferLabel {
  switch (score) {
    case 4: return 'used_independently';
    case 3: return 'used_it';
    case 2: return 'with_help';
    case 1: return 'recognized';
    default: return 'not_yet';
  }
}

// ═══════════════════════════════════════════════════════════════
// Main scoring function
// ═══════════════════════════════════════════════════════════════

export function scoreTransfer(input: TransferCheckInput): TransferCheckResult {
  const targetResults = input.targets.map(t => findTargetInResponse(t.value, input.userResponse));
  
  const targetReuse = computeTargetReuseScore(targetResults, input.usedAfterModel);
  const cueIndependence = computeCueIndependenceScore(input.cueLevelNeeded);
  const latencyEase = computeLatencyEaseScore(input.latencyMs, input.baselineLatencyMs, input.breakdownSignals);
  const functionalFit = computeFunctionalFitScore(targetResults, input.userResponse, input.cueLevelNeeded);
  
  // Critical gate: if no target was found in the response at all, cap at score 1 max
  const anyFound = targetResults.some(r => r.found);
  const isEmpty = input.userResponse.trim().length === 0;
  
  let rawScore = Math.round(
    targetReuse * 0.35 +
    cueIndependence * 0.25 +
    latencyEase * 0.20 +
    functionalFit * 0.20
  );
  
  // Floor: empty/abandoned response → 0; target not found → cap at 20
  if (isEmpty || input.breakdownSignals.abandonment) {
    rawScore = 0;
  } else if (!anyFound) {
    rawScore = Math.min(rawScore, 19); // forces bucket 0
  }
  
  const transferScore = bucketScore(rawScore);
  
  return {
    transferScore,
    rawScore,
    targetResults,
    components: {
      targetReuse,
      cueIndependence,
      latencyEase,
      functionalFit,
    },
    label: scoreToLabel(transferScore),
  };
}

// ═══════════════════════════════════════════════════════════════
// UI Labels
// ═══════════════════════════════════════════════════════════════

export const TRANSFER_LABELS: Record<TransferLabel, string> = {
  not_yet: 'Not yet',
  recognized: 'Recognized',
  with_help: 'Used with help',
  used_it: 'Used it',
  used_independently: 'Used on your own',
};
