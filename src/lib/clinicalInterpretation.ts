import { BrainRegion } from './brainRegionMapper';
import { RegionFunctionalScore } from './functionalScoreCalculator';

export interface ClinicalInterpretation {
  likelyRole: string;
  currentSignal: string;
  interpretation: string;
  therapyFocus: string;
  confidence: 'high' | 'moderate' | 'low' | 'none';
  confidenceLabel: string;
}

// ── Region → functional role mapping (deterministic) ──────────────────────

const REGION_ROLES: Record<string, string> = {
  frontal_lobe: 'Executive planning, initiation, working memory, speech production',
  motor_cortex: 'Voluntary movement control, motor planning, fine motor execution',
  somatosensory_cortex: 'Sensory discrimination, proprioception, tactile processing',
  parietal_lobe: 'Spatial attention, sensory integration, visuospatial processing',
  temporal_lobe: 'Auditory comprehension, lexical retrieval, semantic memory',
  language_areas: 'Speech production (Broca\'s), comprehension (Wernicke\'s), phonological processing',
  occipital_lobe: 'Visual processing, object recognition, reading',
  cerebellum: 'Motor coordination, timing, balance, motor learning',
  brainstem: 'Arousal, cranial nerve function, swallowing, respiratory control',
  subcortical: 'Movement initiation, cognitive-motor integration, processing speed',
};

// ── Region → therapy focus mapping (deterministic) ────────────────────────

const THERAPY_FOCUS: Record<string, string> = {
  frontal_lobe: 'Prioritize naming drills, phrase completion, and sequencing tasks. Support expressive language with structured cues.',
  motor_cortex: 'Focus on repetitive movement practice, graded motor activation, and precision-targeted exercises.',
  somatosensory_cortex: 'Prioritize sensory discrimination tasks, feedback-guided exercises, and proprioceptive training.',
  parietal_lobe: 'Focus on visual scanning, spatial awareness tasks, and cross-midline activities.',
  temporal_lobe: 'Prioritize auditory comprehension drills, word retrieval practice, and category fluency tasks.',
  language_areas: 'Focus on naming drills, sentence building, cue-based retrieval, and phonological awareness tasks.',
  occipital_lobe: 'Prioritize visual matching, letter recognition, and graded reading exercises.',
  cerebellum: 'Focus on coordination drills, timed movement sequences, and balance-integrated tasks.',
  brainstem: 'Prioritize oral motor exercises, sustained phonation tasks, and swallowing protocol support.',
  subcortical: 'Focus on initiation support, dual-task training, and paced cognitive-motor activities.',
};

// ── Interpretation rules (deterministic, rule-based) ──────────────────────

function generateInterpretation(
  hasData: boolean,
  score: number,
  trend: 'improving' | 'stable' | 'declining',
  trialCount: number,
  isAffected: boolean
): string {
  if (!hasData) {
    if (isAffected) {
      return 'Region identified as affected by stroke location. No exercise-derived estimate yet; interpretation is based on clinical profile only.';
    }
    return 'No exercise-derived estimate yet. Complete exercises targeting this area to generate a functional signal.';
  }

  // Severe impairment (<30%)
  if (score < 30) {
    if (trend === 'improving') return 'Severe impairment but showing recovery response. Recent exercise performance suggests emerging functional gains. Continue current therapy approach.';
    if (trend === 'declining') return 'Severe impairment with recent decline. Consider reviewing task difficulty, fatigue levels, and adherence patterns before adjusting therapy.';
    return 'Severe impairment with limited recent change. May benefit from increased practice intensity or modified task parameters.';
  }

  // Moderate impairment (30–49%)
  if (score < 50) {
    if (trend === 'improving') return 'Moderate impairment but trending upward with recent exercise exposure. Current therapy approach appears effective.';
    if (trend === 'declining') return 'Moderate impairment with recent regression. May warrant review of fatigue, difficulty calibration, or adherence.';
    return 'Moderate impairment with stable performance. Consider adjusting difficulty or adding variety to stimulate further gains.';
  }

  // Mild impairment (50–69%)
  if (score < 70) {
    if (trend === 'improving') return 'Mild impairment with active recovery trajectory. Performance is approaching functional threshold.';
    if (trend === 'declining') return 'Mild impairment with recent softening. Monitor for fatigue or task ceiling effects.';
    return 'Mild impairment holding steady. May benefit from increased task complexity to drive further recovery.';
  }

  // Strong (70%+)
  if (trend === 'improving') return 'Strong function with continued improvement. Consider advancing task complexity or reducing cue support.';
  if (trend === 'declining') return 'Strong baseline with recent slight decline. Likely normal variability; monitor over next 2-3 sessions.';
  return 'Strong and stable function. Maintain current exercise regimen; consider transfer activities for generalization.';
}

// ── Signal summary (deterministic) ────────────────────────────────────────

function generateSignal(
  hasData: boolean,
  score: number | undefined,
  trend: string | undefined,
  trialCount: number,
  isAffected: boolean
): string {
  const parts: string[] = [];

  if (hasData && score !== undefined) {
    parts.push(`${Math.round(score)}% function`);
  }

  if (trend) {
    parts.push(trend);
  }

  if (trialCount > 0) {
    parts.push(`${trialCount} trials`);
  }

  if (isAffected) {
    parts.push('stroke-affected');
  }

  if (parts.length === 0) {
    return 'No signal available';
  }

  return parts.join(' · ');
}

// ── Confidence calculation (deterministic, threshold-based) ───────────────

function getConfidence(trialCount: number): { level: 'high' | 'moderate' | 'low' | 'none'; label: string } {
  if (trialCount >= 30) return { level: 'high', label: '30+ trials' };
  if (trialCount >= 10) return { level: 'moderate', label: `${trialCount} trials` };
  if (trialCount > 0) return { level: 'low', label: `${trialCount} trials (need 10+)` };
  return { level: 'none', label: 'No exercise data' };
}

// ── Main export ───────────────────────────────────────────────────────────

export function interpretRegion(
  region: BrainRegion,
  score: RegionFunctionalScore | null | undefined,
  isAffected: boolean
): ClinicalInterpretation {
  const hasData = !!score && score.contributingMetrics.trialCount >= 10;
  const trialCount = score?.contributingMetrics.trialCount || 0;
  const currentScore = score?.currentScore || 0;
  const trend = score?.trend || 'stable';

  const { level, label } = getConfidence(trialCount);

  return {
    likelyRole: REGION_ROLES[region.id] || region.functionalDomains.join(', '),
    currentSignal: generateSignal(hasData, score?.currentScore, score?.trend, trialCount, isAffected),
    interpretation: generateInterpretation(hasData, currentScore, trend, trialCount, isAffected),
    therapyFocus: THERAPY_FOCUS[region.id] || 'Continue exercises targeting this functional area',
    confidence: level,
    confidenceLabel: label,
  };
}
