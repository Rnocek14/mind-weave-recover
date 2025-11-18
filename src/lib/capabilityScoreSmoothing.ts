/**
 * Utilities for smoothing capability scores over time to prevent wild swings
 * from a single tired/distracted assessment session.
 */

export interface CapabilityAssessment {
  id: string;
  assessed_at: string;
  vision_score: number | null;
  motor_score: number | null;
  attention_score: number | null;
  confidence_score: number | null;
}

export interface DropFlag {
  domain: 'vision' | 'motor' | 'attention';
  from: number;
  to: number;
  delta: number;
}

/**
 * Detects significant drops (≥3 points) between two assessments.
 * Returns an array of flagged domains.
 */
export function getSignificantDrops(
  current: CapabilityAssessment | null,
  previous: CapabilityAssessment | null
): DropFlag[] {
  if (!current || !previous) return [];

  const domains: Array<'vision' | 'motor' | 'attention'> = ['vision', 'motor', 'attention'];
  const flags: DropFlag[] = [];

  for (const domain of domains) {
    const prev = previous[`${domain}_score`];
    const curr = current[`${domain}_score`];
    
    if (prev == null || curr == null) continue;

    const delta = curr - prev; // negative if worse

    // Threshold: ≥3-point drop on 0–10 scale
    if (delta <= -3) {
      flags.push({ domain, from: prev, to: curr, delta });
    }
  }

  return flags;
}

/**
 * Blends a new raw score with the previous score to smooth changes over time.
 * 
 * @param rawScore - The newly calculated score
 * @param previousScore - The previous assessment's score (or null if first assessment)
 * @param weightNew - Weight given to new score (0-1). Default 0.4 means 60% old, 40% new.
 * @returns Blended score rounded to nearest integer
 */
export function blendWithPrevious(
  rawScore: number,
  previousScore: number | null,
  weightNew = 0.4
): number {
  if (previousScore == null) return rawScore;
  
  const weightOld = 1 - weightNew;
  return Math.round(weightOld * previousScore + weightNew * rawScore);
}

/**
 * Caps how much a single assessment can drop from the previous one.
 * This prevents a single bad day from locking out exercises.
 * 
 * @param blendedScore - The score after blending
 * @param previousScore - The previous assessment's score
 * @param maxDrop - Maximum allowed drop in a single assessment (default 3)
 * @returns Score with drop limit applied
 */
export function applyMaxDropLimit(
  blendedScore: number,
  previousScore: number | null,
  maxDrop = 3
): number {
  if (previousScore == null) return blendedScore;
  
  const lowerBound = previousScore - maxDrop;
  return Math.max(blendedScore, lowerBound);
}

/**
 * Applies smoothing and drop limits to a new score.
 * Combines blending and max drop logic.
 */
export function smoothScore(
  rawScore: number,
  previousScore: number | null
): number {
  const blended = blendWithPrevious(rawScore, previousScore);
  return applyMaxDropLimit(blended, previousScore);
}

/**
 * Caregiver observations from graceful exit
 */
export interface CaregiverObservations {
  lookingAtScreen: boolean;
  seemsConfused: boolean;
  tooTired: boolean;
  motorLimitation: boolean;
  notes: string;
}

export type InteractionMode = 'independent' | 'assisted' | 'passive';

/**
 * Suggests an interaction mode based on caregiver observations.
 * 
 * - 'assisted': User is cognitively present but has motor limitations
 * - 'passive': User shows low arousal, confusion, or severe fatigue
 * - 'independent': Default mode for users who can interact normally
 */
export function suggestInteractionMode(
  caregiverObs?: CaregiverObservations | null
): InteractionMode | null {
  if (!caregiverObs) return null;

  const { lookingAtScreen, seemsConfused, tooTired, motorLimitation } = caregiverObs;

  // Assisted: cognitively present, motor-limited
  if (lookingAtScreen && motorLimitation) {
    return 'assisted';
  }

  // Passive: very low arousal / confusion
  if (tooTired || (!lookingAtScreen && seemsConfused)) {
    return 'passive';
  }

  // Otherwise: independent-ish
  return 'independent';
}
