/**
 * Daily Lesson Engine
 * 
 * Generates personalized daily curriculum based on:
 * 1. Capability Profile (guardrails, updated weekly)
 * 2. Performance Signals (tracked every session)
 * 3. Learning Rate (trajectory over days)
 * 4. Error Patterns (what needs work)
 * 5. Fatigue/Frustration (today's tolerance)
 */

import type { CapabilityScores } from './capabilityAssessor';
import type { ClinicalProfile } from './clinicalProfileMapper';
import type { RecencyPenalties } from './exerciseRecency';
import type { ProgressionPlanningSignal } from './progressionPlanningSignals';
import { CANONICAL_EXERCISES } from '@/data/canonicalExerciseRegistry';
import { isPolishedExercise, filterToPolished, POLISHED_EXERCISES } from './polishedExercises';

/** Speech profile signals used for exercise SELECTION scoring (not in-game adaptation) */
export interface SpeechProfileSelectionSignals {
  errorTypeDistribution?: Record<string, number>;
  mostChallengingCategories?: string[];
  phonemeDifficultyMap?: Record<string, { accuracy: number; trials: number }>;
}

/**
 * Map adaptive engine domain names → exercise domain names.
 * primaryDomains from computeTodayFocus uses cognitive/clinical names;
 * exerciseMetadata uses lesson-engine names. This bridge connects them.
 */
const PRIMARY_DOMAIN_MAP: Record<string, string[]> = {
  'semantic': ['semantic_systems'],
  'semantic_depth': ['semantic_systems'],
  'executive': ['attention'],
  'executive_function': ['attention'],
  'discourse': ['expressive_language'],
  'phonological': ['phonology'],
  'language_production': ['expressive_language', 'phonology'],
  'language_comprehension': ['receptive_language'],
  'visual_spatial': ['visual_processing'],
};

/**
 * Domain families for cross-domain balancing.
 * Sessions should include exercises from ≥2 families to avoid tunnel-vision therapy.
 */
const DOMAIN_FAMILIES: Record<string, string[]> = {
  language: ['expressive_language', 'receptive_language', 'phonology'],
  semantic: ['semantic_systems'],
  cognition: ['attention', 'visual_processing'],
  motor: ['motor_control'],
};

function getExerciseDomainFamilies(exerciseDomains: string[]): string[] {
  const families: string[] = [];
  for (const [family, domains] of Object.entries(DOMAIN_FAMILIES)) {
    if (exerciseDomains.some(d => domains.includes(d)) && !families.includes(family)) {
      families.push(family);
    }
  }
  return families;
}

export interface DomainPriority {
  expressive_language: 'high' | 'medium' | 'low';
  receptive_language: 'high' | 'medium' | 'low';
  semantic_systems: 'high' | 'medium' | 'low';
  phonology: 'high' | 'medium' | 'low';
  motor_control: 'high' | 'medium' | 'low';
  attention: 'high' | 'medium' | 'low';
  visual_processing: 'high' | 'medium' | 'low';
}

export interface PerformanceSignals {
  avgReactionTime: number;
  avgAccuracy: number;
  timeoutRate: number;
  errorTypes: {
    semantic: number;
    phonological: number;
    omissions: number;
    perseverations: number;
  };
  frustrationLevel: 'low' | 'medium' | 'high';
  fatigueLevel: 'low' | 'medium' | 'high';
  engagementScore: number; // 0-10
}

export interface LearningRateData {
  domain: string;
  accuracySlope: number; // change per day
  rtSlope: number; // change per day
  confidenceScore: number;
  trialCount: number;
}

export interface ExerciseBlock {
  exerciseId: string;
  duration: number; // minutes
  priority: 'warmup' | 'primary' | 'secondary' | 'consolidation' | 'support';
  adaptations: {
    startDifficulty: number;
    cueLevel: number;
    timeout: number;
    visualSupport: boolean;
  };
  reasoning: string;
  trialLimit?: number; // Optional: override default round count (e.g. 5 for combined sessions)
}

/** Target accuracy bands per session phase (evidence-based optimal challenge zones) */
export const PHASE_TARGET_BANDS: Record<ExerciseBlock['priority'], { min: number; max: number; label: string }> = {
  warmup: { min: 0.80, max: 0.95, label: 'Confidence builder' },
  primary: { min: 0.65, max: 0.80, label: 'Core challenge' },
  secondary: { min: 0.55, max: 0.75, label: 'Cross-domain work' },
  consolidation: { min: 0.75, max: 0.90, label: 'End on a high' },
  support: { min: 0.80, max: 0.95, label: 'Recovery & support' },
};

export interface DailyLesson {
  totalDuration: number; // minutes
  blocks: ExerciseBlock[];
  /** Pre-planned support/fallback blocks — not in the default queue, inserted on struggle */
  supportBlocks?: ExerciseBlock[];
  targetDomains: string[];
  reasoning: string[];
  energyLevel: 'light' | 'moderate' | 'challenging';
  doseReasoning?: DoseReasoning;
  /** If set, LessonFlow will use this session frame template for Maya intro/transitions/closing */
  sessionFrameId?: string;
}

/**
 * Detect specific aphasia type from clinical profile impairments.
 * This drives domain priority weighting for session planning.
 */
export type AphasiaType = 'anomic' | 'broca' | 'wernicke' | 'global' | 'conduction' | 'generic_speech' | null;

export function detectAphasiaType(clinicalProfile: ClinicalProfile | null): AphasiaType {
  if (!clinicalProfile) return null;
  const speech = clinicalProfile.impairments.speech.map(s => s.toLowerCase());
  if (speech.length === 0) return null;
  
  const joined = speech.join(' ');
  if (joined.includes('anomic') || joined.includes('anomia') || joined.includes('word finding') || joined.includes('word-finding')) return 'anomic';
  if (joined.includes('broca') || joined.includes('non-fluent') || joined.includes('nonfluent') || joined.includes('expressive')) return 'broca';
  if (joined.includes('wernicke') || joined.includes('receptive') || joined.includes('fluent aphasia')) return 'wernicke';
  if (joined.includes('global')) return 'global';
  if (joined.includes('conduction')) return 'conduction';
  return 'generic_speech';
}

/**
 * Calculate domain priorities from clinical profile.
 * 
 * KEY FIX: Aphasia-type-specific weighting prevents "all high" flattening.
 * For anomic aphasia, naming/semantic domains are boosted to 'high' while
 * non-speech domains stay at baseline unless explicitly impaired.
 */
export function calculateDomainPriorities(
  clinicalProfile: ClinicalProfile | null
): DomainPriority {
  const defaults: DomainPriority = {
    expressive_language: 'medium',
    receptive_language: 'medium',
    semantic_systems: 'medium',
    phonology: 'medium',
    motor_control: 'low',
    attention: 'low',
    visual_processing: 'low',
  };

  if (!clinicalProfile) return defaults;

  const priorities = { ...defaults };
  const aphasiaType = detectAphasiaType(clinicalProfile);
  
  // === APHASIA-TYPE-SPECIFIC PRIORITIES ===
  // These create clear differentiation in exercise scoring
  switch (aphasiaType) {
    case 'anomic':
      // Anomic aphasia: naming and word retrieval are THE primary deficit
      priorities.expressive_language = 'high';
      priorities.semantic_systems = 'high';
      priorities.receptive_language = 'medium'; // Usually relatively preserved
      priorities.phonology = 'medium';
      break;
    case 'broca':
      // Broca's: expressive language and motor speech are primary
      priorities.expressive_language = 'high';
      priorities.phonology = 'high';
      priorities.motor_control = 'medium'; // Often co-occurs
      priorities.receptive_language = 'medium';
      priorities.semantic_systems = 'medium';
      break;
    case 'wernicke':
      // Wernicke's: comprehension and semantic processing are primary
      priorities.receptive_language = 'high';
      priorities.semantic_systems = 'high';
      priorities.expressive_language = 'medium';
      break;
    case 'global':
      // Global: everything language is high priority
      priorities.expressive_language = 'high';
      priorities.receptive_language = 'high';
      priorities.semantic_systems = 'high';
      priorities.phonology = 'high';
      break;
    case 'conduction':
      // Conduction: repetition/phonological processing
      priorities.phonology = 'high';
      priorities.expressive_language = 'high';
      priorities.semantic_systems = 'medium';
      break;
    case 'generic_speech':
      // Generic speech impairment: boost language broadly
      priorities.expressive_language = 'high';
      priorities.receptive_language = 'high';
      break;
  }

  // === STROKE LOCATION REFINEMENTS (additive, don't override aphasia type) ===
  const strokeLocation = Array.isArray(clinicalProfile.stroke_location)
    ? clinicalProfile.stroke_location.join(' ').toLowerCase()
    : (clinicalProfile.stroke_location || '').toLowerCase();

  if (strokeLocation.includes('temporal')) {
    priorities.semantic_systems = 'high';
  }
  if (strokeLocation.includes('frontal') || strokeLocation.includes('broca')) {
    priorities.expressive_language = 'high';
  }
  if (strokeLocation.includes('parietal')) {
    if (priorities.attention !== 'high') priorities.attention = 'medium';
    if (priorities.visual_processing !== 'high') priorities.visual_processing = 'medium';
  }

  // === EXPLICIT IMPAIRMENT OVERRIDES ===
  // Only boost non-speech domains if explicitly documented
  if (clinicalProfile.impairments.motor.length > 0) {
    priorities.motor_control = 'medium'; // Upgrade from 'low' but don't compete with speech
  }
  if (clinicalProfile.impairments.cognitive.length > 0) {
    priorities.attention = 'medium';
  }
  if (clinicalProfile.impairments.visual.length > 0) {
    priorities.visual_processing = 'medium';
    // Only go to 'high' if neglect is documented
    const hasNeglect = clinicalProfile.impairments.visual.some(v => 
      v.toLowerCase().includes('neglect') || v.toLowerCase().includes('inattention'));
    if (hasNeglect) priorities.visual_processing = 'high';
  }

  console.log('[DailyLessonEngine] Domain priorities:', {
    aphasiaType,
    priorities,
    speechImpairments: clinicalProfile.impairments.speech,
  });

  return priorities;
}

/**
 * Daily readiness data from check-in (fatigue, sleep, mood, pain)
 */
export interface ReadinessInput {
  fatigue_rating: number;       // 1-5 (1=fresh, 5=exhausted)
  sleep_quality?: number | null; // 1-5
  mood_rating?: number | null;   // 1-5
  pain_level?: number | null;    // 1-5
  fatigue_limited_practice?: boolean;
}

/**
 * Dose reasoning for clinician-grade explainability.
 * Structured so clinicians can see exactly which signal drove the dose decision.
 */
export interface DoseReasoning {
  baselineMinutes: number;
  readinessApplied: ReadinessInput | null;
  readiness: { multiplierComputed: number; factorsApplied: { source: string; value: number }[] };
  performance: { multiplierComputed: number; factorsApplied: { source: string; value: number }[] };
  selected: { source: 'none' | 'readiness' | 'performance' | 'equal'; multiplier: number; clamped: number };
  caps: { source: string; cap: number }[];
  finalMinutes: number;
}

/** Clamp a value to [min, max], coercing numeric strings. Treats null/undefined/NaN as fallback. */
function clampInput(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value === 'boolean') return fallback;
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || typeof n !== 'number' || Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Determine today's dose based on fatigue, frustration, AND daily readiness.
 * 
 * Uses "max reduction source" pattern: readiness and performance each compute
 * a single worst-case multiplier, then we apply only the larger reduction.
 * This prevents stacking from cratering dose below useful levels.
 */
export function calculateTodaysDose(
  performanceSignals: PerformanceSignals,
  baselineMinutes: number = 15,
  readiness?: ReadinessInput | null,
  sessionDurationCap?: number,
): { dose: number; reasoning: DoseReasoning } {
  const caps: DoseReasoning['caps'] = [];
  let dose = baselineMinutes;

  // Track readiness and performance reductions separately to pick max
  let readinessMultiplier = 1;
  let performanceMultiplier = 1;
  const readinessFactors: { source: string; value: number }[] = [];
  const performanceFactors: { source: string; value: number }[] = [];

  // === Daily Readiness Modulation ===
  if (readiness) {
    const fatigue = clampInput(readiness.fatigue_rating, 1, 5, 3);
    const sleep = clampInput(readiness.sleep_quality, 1, 5, 3);
    const pain = clampInput(readiness.pain_level, 1, 5, 1);

    // Hard cap: user explicitly said fatigue limits practice
    if (readiness.fatigue_limited_practice) {
      caps.push({ source: 'fatigue_limited_practice', cap: 8 });
    }

    // Fatigue-based reduction
    if (fatigue >= 4) {
      readinessMultiplier *= 0.4;
      readinessFactors.push({ source: 'readiness.fatigue', value: 0.4 });
    } else if (fatigue >= 3) {
      readinessMultiplier *= 0.65;
      readinessFactors.push({ source: 'readiness.fatigue', value: 0.65 });
    }

    // Poor sleep compounds fatigue
    if (sleep <= 2) {
      readinessMultiplier *= 0.8;
      readinessFactors.push({ source: 'readiness.sleep', value: 0.8 });
    }

    // High pain reduces tolerance
    if (pain >= 4) {
      readinessMultiplier *= 0.7;
      readinessFactors.push({ source: 'readiness.pain', value: 0.7 });
    }
  }

  // === Performance-Based Modulation ===
  if (performanceSignals.fatigueLevel === 'high') {
    performanceMultiplier *= 0.5;
    performanceFactors.push({ source: 'performance.fatigue', value: 0.5 });
  } else if (performanceSignals.fatigueLevel === 'medium') {
    performanceMultiplier *= 0.75;
    performanceFactors.push({ source: 'performance.fatigue', value: 0.75 });
  }

  if (performanceSignals.frustrationLevel === 'high') {
    performanceMultiplier *= 0.6;
    performanceFactors.push({ source: 'performance.frustration', value: 0.6 });
  } else if (performanceSignals.frustrationLevel === 'medium') {
    performanceMultiplier *= 0.85;
    performanceFactors.push({ source: 'performance.frustration', value: 0.85 });
  }

  // Apply the WORSE of readiness vs performance reduction (not both stacked)
  const combinedMultiplier = Math.min(readinessMultiplier, performanceMultiplier);
  const selectedSource: 'none' | 'readiness' | 'performance' | 'equal' =
    !readiness ? (performanceMultiplier < 1 ? 'performance' : 'none') :
    readinessMultiplier < performanceMultiplier ? 'readiness' :
    performanceMultiplier < readinessMultiplier ? 'performance' : 'equal';
  
  // minMultiplierFloor: never reduce beyond this (0.3 = 70% max reduction, 0.15 for fatigue-limited)
  const minMultiplierFloor = readiness?.fatigue_limited_practice ? 0.15 : 0.3;
  const clampedMultiplier = Math.max(minMultiplierFloor, combinedMultiplier);
  
  dose *= clampedMultiplier;

  // Engagement boost: allowed only when no hard caps and no high fatigue/frustration
  const canBoost =
    !readiness?.fatigue_limited_practice &&
    performanceSignals.fatigueLevel !== 'high' &&
    performanceSignals.frustrationLevel !== 'high';

  if (performanceSignals.engagementScore >= 8 && canBoost) {
    dose = Math.min(dose * 1.2, 25);
    performanceFactors.push({ source: 'engagement.boost', value: 1.2 });
  }

  // === Apply caps (hard limits) ===
  if (sessionDurationCap && sessionDurationCap > 0) {
    dose = Math.min(dose, sessionDurationCap);
    caps.push({ source: 'adaptive_engine.sessionDurationCap', cap: sessionDurationCap });
  }

  // fatigue_limited_practice hard cap (applied LAST so nothing can re-expand)
  if (readiness?.fatigue_limited_practice) {
    dose = Math.min(dose, 8);
  }

  // Floor at 5 minutes
  const finalDose = Math.max(5, Math.round(dose));

  return {
    dose: finalDose,
    reasoning: {
      baselineMinutes,
      readinessApplied: readiness || null,
      readiness: { multiplierComputed: readinessMultiplier, factorsApplied: readinessFactors },
      performance: { multiplierComputed: performanceMultiplier, factorsApplied: performanceFactors },
      selected: { source: selectedSource, multiplier: combinedMultiplier, clamped: clampedMultiplier },
      caps,
      finalMinutes: finalDose,
    },
  };
}

/**
 * Weight exercises by domain priorities and learning rates.
 * 
 * Scoring spread: high=5, medium=2, low=0
 * This creates enough separation that aphasia-type-specific priorities
 * reliably push the correct exercises to the top.
 */
export function scoreExercise(
  exerciseId: string,
  exerciseDomains: string[],
  domainPriorities: DomainPriority,
  learningRates: LearningRateData[],
  errorPatterns: PerformanceSignals['errorTypes']
): number {
  let score = 0;

  // Base score from domain priorities — wider spread for clear differentiation
  exerciseDomains.forEach(domain => {
    const priority = (domainPriorities as any)[domain];
    if (priority === 'high') score += 5;
    else if (priority === 'medium') score += 2;
    // 'low' adds 0 — non-priority domains don't inflate scores
  });

  // Boost if learning rate is slow (needs more practice)
  exerciseDomains.forEach(domain => {
    const lr = learningRates.find(r => r.domain === domain);
    if (lr) {
      if (lr.accuracySlope < 0.02) {
        score += 2; // Slow improvement → boost priority
      } else if (lr.accuracySlope > 0.1) {
        score -= 1; // Fast improvement → reduce slightly
      }
    }
  });

  // Boost if error patterns match exercise targets
  if (exerciseDomains.includes('semantic_systems') && errorPatterns.semantic > 0.3) {
    score += 2;
  }
  if (exerciseDomains.includes('phonology') && errorPatterns.phonological > 0.3) {
    score += 2;
  }

  return score;
}

/**
 * Preset lesson definitions for structured multi-exercise sessions.
 * These bypass normal spacing/adjacency rules — block order is intentional.
 */
export type LessonPreset = 'comprehension_session' | 'core_communication' | 'expression_focused' | 'comprehension_focused' | 'low_energy' | 'depth_battery_onboarding' | 'depth_battery_weekly';

const PRESET_LESSONS: Record<LessonPreset, { title: string; blocks: Array<Pick<ExerciseBlock, 'exerciseId' | 'duration' | 'priority' | 'reasoning' | 'trialLimit'> & { adaptations?: Partial<ExerciseBlock['adaptations']> }> }> = {
  comprehension_session: {
    title: 'Comprehension Session',
    blocks: [
      {
        exerciseId: 'detective-mind',
        duration: 4,
        trialLimit: 5,
        priority: 'primary',
        reasoning: 'Inference comprehension (5 trials)',
      },
      {
        exerciseId: 'meaning-match',
        duration: 3,
        trialLimit: 5,
        priority: 'primary',
        reasoning: 'Semantic mapping comprehension (5 trials)',
      },
    ],
  },
  core_communication: {
    title: 'Core Communication',
    blocks: [
      {
        exerciseId: 'detective-mind',
        duration: 4,
        trialLimit: 3,
        priority: 'primary',
        reasoning: 'Comprehension + clue-finding (3 cases)',
      },
      {
        exerciseId: 'narrative-retell',
        duration: 4,
        trialLimit: 1,
        priority: 'primary',
        reasoning: 'Recall + sequencing + expression (1 story)',
      },
    ],
  },
  depth_battery_onboarding: {
    title: 'Depth Battery (Baseline)',
    blocks: [
      { exerciseId: 'abstract-compare', duration: 3, trialLimit: 3, priority: 'primary', reasoning: 'Semantic depth baseline (3 pairs)' },
      { exerciseId: 'multi-step-plan', duration: 3, trialLimit: 2, priority: 'primary', reasoning: 'Executive sequencing baseline (2 goals)' },
      { exerciseId: 'narrative-retell', duration: 4, trialLimit: 2, priority: 'primary', reasoning: 'Discourse organization baseline (2 stories)' },
      { exerciseId: 'dual-load-naming', duration: 3, trialLimit: 1, priority: 'secondary', reasoning: 'Executive load tolerance baseline (1 set)' },
    ],
  },
  depth_battery_weekly: {
    title: 'Weekly Depth Check',
    blocks: [
      { exerciseId: 'abstract-compare', duration: 2, trialLimit: 2, priority: 'primary', reasoning: 'Semantic depth check (2 pairs)' },
      { exerciseId: 'narrative-retell', duration: 3, trialLimit: 1, priority: 'primary', reasoning: 'Discourse check (1 story)' },
      { exerciseId: 'dual-load-naming', duration: 2, trialLimit: 1, priority: 'secondary', reasoning: 'Load tolerance check (1 set)' },
    ],
  },
  expression_focused: {
    title: 'Expression Focus',
    blocks: [
      {
        exerciseId: 'semantic-features',
        duration: 4,
        trialLimit: 3,
        priority: 'primary',
        reasoning: 'Feature analysis for word retrieval (3 words)',
      },
      {
        exerciseId: 'synonym-generator',
        duration: 3,
        trialLimit: 5,
        priority: 'primary',
        reasoning: 'Semantic network activation (5 words)',
      },
      {
        exerciseId: 'category-fluency',
        duration: 3,
        trialLimit: 2,
        priority: 'secondary',
        reasoning: 'Rapid word generation (2 categories)',
      },
    ],
  },
  comprehension_focused: {
    title: 'Comprehension Focus',
    blocks: [
      {
        exerciseId: 'detective-mind',
        duration: 4,
        trialLimit: 4,
        priority: 'primary',
        reasoning: 'Inference and literal comprehension (4 cases)',
      },
      {
        exerciseId: 'meaning-match',
        duration: 3,
        trialLimit: 5,
        priority: 'primary',
        reasoning: 'Semantic relationship mapping (5 pairs)',
      },
      {
        exerciseId: 'narrative-retell',
        duration: 4,
        trialLimit: 1,
        priority: 'primary',
        reasoning: 'Full story comprehension + retelling (1 story)',
      },
    ],
  },
  low_energy: {
    title: 'Light Session',
    blocks: [
      {
        exerciseId: 'meaning-match',
        duration: 3,
        trialLimit: 5,
        priority: 'warmup',
        reasoning: 'Low-effort semantic matching (5 pairs)',
      },
      {
        exerciseId: 'photo-naming',
        duration: 3,
        trialLimit: 5,
        priority: 'primary',
        reasoning: 'Familiar naming practice (5 images)',
      },
    ],
  },
};

/**
 * Build a preset lesson directly (no engine context needed).
 * Use this from UI components that want to launch a preset session.
 * Pass accessibleExercises to gate availability; omit to skip the check.
 */
export function buildPresetLesson(preset: LessonPreset, accessibleExercises?: string[]): DailyLesson | null {
  const presetDef = PRESET_LESSONS[preset];
  if (!presetDef) return null;

  // Polished allowlist: presets must NOT force-include unpolished games into daily flow.
  const unpolished = presetDef.blocks.filter(b => !isPolishedExercise(b.exerciseId));
  if (unpolished.length > 0) {
    console.warn('[DailyLessonEngine] Rejecting preset — contains unpolished exercises:', preset, unpolished.map(b => b.exerciseId));
    return null;
  }

  // If accessibility list provided, verify all exercises are accessible
  if (accessibleExercises && !presetDef.blocks.every(b => accessibleExercises.includes(b.exerciseId))) {
    return null;
  }

  
  const defaultAdaptations: ExerciseBlock['adaptations'] = {
    startDifficulty: 1,
    cueLevel: 1,
    timeout: 5000,
    visualSupport: false,
  };
  const blocks: ExerciseBlock[] = presetDef.blocks.map(b => ({
    ...b,
    adaptations: { ...defaultAdaptations, ...b.adaptations },
  }));
  const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
  // Attach session frame ID for presets that have one
  const FRAME_MAP: Partial<Record<LessonPreset, string>> = {
    core_communication: 'core_communication',
    expression_focused: 'expression_focused',
    comprehension_focused: 'comprehension_focused',
    low_energy: 'low_energy',
  };
  return {
    totalDuration,
    blocks,
    targetDomains: ['receptive_language', 'semantic_systems'],
    reasoning: [`Preset: ${presetDef.title}`],
    energyLevel: totalDuration <= 7 ? 'light' : 'moderate',
    sessionFrameId: FRAME_MAP[preset],
  };
}

/**
 * Generate daily lesson plan
 */
export function generateDailyLesson(
  capabilityScores: CapabilityScores,
  clinicalProfile: ClinicalProfile | null,
  accessibleExercises: string[],
  performanceSignals: PerformanceSignals,
  learningRates: LearningRateData[],
  suggestedMode?: 'independent' | 'assisted' | 'passive' | null,
  readiness?: ReadinessInput | null,
  todayFocusAdaptations?: { startDifficulty?: number; sessionDurationCap?: number; suggestedSessionMinutes?: number } | null,
  preset?: LessonPreset | null,
  recencyPenalties?: RecencyPenalties | null,
  primaryDomains?: string[] | null,
  speechProfileSignals?: SpeechProfileSelectionSignals | null,
  struggleBoosts?: Map<string, number> | null,
  struggleReEntryConfigs?: Map<string, { difficulty: number; cueLevel: number }> | null,
  progressionSignals?: Map<string, ProgressionPlanningSignal> | null,
): DailyLesson {
  // Polished allowlist gate: daily auto-selection only chooses from QA'd games.
  // Unpolished games remain available via manual picker / dev routes.
  const polishedAccessible = filterToPolished(accessibleExercises);
  if (polishedAccessible.length < accessibleExercises.length) {
    console.log('[DailyLessonEngine] Polished allowlist filtered candidates:',
      `${accessibleExercises.length} accessible → ${polishedAccessible.length} polished`,
      'allowlist:', POLISHED_EXERCISES);
  }

  // If a preset is requested and all its exercises are accessible, return it directly
  if (preset && PRESET_LESSONS[preset]) {
    const presetDef = PRESET_LESSONS[preset];
    const allPolished = presetDef.blocks.every(b => isPolishedExercise(b.exerciseId));
    const allAccessible = presetDef.blocks.every(b => accessibleExercises.includes(b.exerciseId));
    if (allPolished && allAccessible) {
      const defaultAdaptations: ExerciseBlock['adaptations'] = {
        startDifficulty: todayFocusAdaptations?.startDifficulty ?? 1,
        cueLevel: 1,
        timeout: 5000,
        visualSupport: false,
      };
      const blocks: ExerciseBlock[] = presetDef.blocks.map(b => ({
        ...b,
        adaptations: { ...defaultAdaptations, ...b.adaptations },
      }));
      const totalDuration = blocks.reduce((sum, b) => sum + b.duration, 0);
      console.log('[DailyLessonEngine] Using preset lesson:', preset, blocks.map(b => b.exerciseId).join(' → '));
      const FRAME_MAP: Partial<Record<LessonPreset, string>> = {
        core_communication: 'core_communication',
        expression_focused: 'expression_focused',
        comprehension_focused: 'comprehension_focused',
        low_energy: 'low_energy',
      };
      return {
        totalDuration,
        blocks,
        targetDomains: ['receptive_language', 'semantic_systems'],
        reasoning: [`Preset: ${presetDef.title}`],
        energyLevel: totalDuration <= 7 ? 'light' : 'moderate',
        sessionFrameId: FRAME_MAP[preset],
      };
    }
  }

  const domainPriorities = calculateDomainPriorities(clinicalProfile);
  const doseResult = calculateTodaysDose(
    performanceSignals,
    15,
    readiness,
    todayFocusAdaptations?.sessionDurationCap,
  );
  let totalDuration = doseResult.dose;
  const reasoning: string[] = [];

  // Telemetry: structured log for clinician transparency and prod verification
  console.log('[DailyLessonEngine] Dose reasoning:', {
    adaptationEngineActive: true,
    focusAdaptations: todayFocusAdaptations ?? null,
    readinessMultiplier: doseResult.reasoning.readiness.multiplierComputed,
    performanceMultiplier: doseResult.reasoning.performance.multiplierComputed,
    selectedSource: doseResult.reasoning.selected.source,
    clampedMultiplier: doseResult.reasoning.selected.clamped,
    caps: doseResult.reasoning.caps,
    finalMinutes: doseResult.reasoning.finalMinutes,
  });

  // Apply TodayFocus session minute suggestion if tighter than dose calc
  if (todayFocusAdaptations?.suggestedSessionMinutes) {
    const suggested = todayFocusAdaptations.suggestedSessionMinutes;
    if (suggested < totalDuration) {
      totalDuration = suggested;
      reasoning.push(`Adaptive engine capped session to ${suggested}min`);
    }
  }

  // Log readiness influence
  if (readiness) {
    reasoning.push(`Daily readiness: fatigue=${readiness.fatigue_rating}/5${readiness.fatigue_limited_practice ? ' (limited practice)' : ''}`);
  }

  // Adjust duration based on suggested interaction mode
  if (suggestedMode === 'assisted') {
    totalDuration = Math.min(totalDuration, 8);
    reasoning.push('Using shorter session length for caregiver-assisted mode');
  } else if (suggestedMode === 'passive') {
    totalDuration = Math.min(totalDuration, 5);
    reasoning.push('Using light session length due to low engagement signals');
  }

  // Exercise metadata derived from canonical registry — single source of truth
  const exerciseMetadata: Record<string, { domains: string[]; baseMinutes: number; baseComponent?: string }> = {};
  for (const ex of CANONICAL_EXERCISES) {
    exerciseMetadata[ex.slug] = {
      domains: ex.engineDomains,
      baseMinutes: ex.baseMinutes,
      baseComponent: ex.baseComponent,
    };
  }
  // Legacy alias for backward compatibility
  if (!exerciseMetadata['phonological'] && exerciseMetadata['phonological-awareness']) {
    exerciseMetadata['phonological'] = exerciseMetadata['phonological-awareness'];
  }

  // Score each accessible exercise
  // Map primaryDomains from adaptive engine to exercise domain names (once)
  const mappedPrimaryDomains = (primaryDomains || []).flatMap(d => PRIMARY_DOMAIN_MAP[d] || [d]);

  const selectionReasons: Array<{
    id: string; baseScore: number; recencyPenalty: number; componentPenalty: number;
    primaryDomainBoost: number; speechProfileBoost: number; finalScore: number; reason: string;
  }> = [];

  const scoredExercises = polishedAccessible
    .map(id => {
      const meta = exerciseMetadata[id];
      if (!meta) return null;

      const baseScore = scoreExercise(
        id,
        meta.domains,
        domainPriorities,
        learningRates,
        performanceSignals.errorTypes
      );

      // Apply recency penalties
      let recencyPenalty = 0;
      let componentPenalty = 0;
      let penaltyReason = '';

      if (recencyPenalties) {
        recencyPenalty = recencyPenalties.exercisePenalties.get(id) || 0;
        const component = meta.baseComponent;
        if (component) {
          componentPenalty = recencyPenalties.componentPenalties.get(component) || 0;
        }
        penaltyReason = recencyPenalties.reasons.get(id) || '';
      }

      // === PRIMARY DOMAINS BOOST (from adaptive engine) ===
      // This is the critical connection: TodayFocus.primaryDomains now drives selection
      let primaryDomainBoost = 0;
      if (mappedPrimaryDomains.length > 0) {
        const overlap = meta.domains.filter(d => mappedPrimaryDomains.includes(d));
        primaryDomainBoost = overlap.length * 3; // Strong boost: +3 per overlapping domain
      }

      // === SPEECH PROFILE BOOST ===
      // Uses actual speech profile data to influence which exercises get selected
      let speechProfileBoost = 0;
      if (speechProfileSignals) {
        const dist = speechProfileSignals.errorTypeDistribution;
        if (dist) {
          const total = Object.values(dist).reduce((a, b) => a + b, 0);
          if (total >= 10) {
            const semanticPct = ((dist['semantic_related'] || 0) + (dist['semantic_paraphasia'] || 0)) / total;
            const phonologicalPct = ((dist['phonological'] || 0) + (dist['phonemic_paraphasia'] || 0)) / total;
            // Boost exercises that match the user's dominant error type
            if (semanticPct > 0.3 && meta.domains.includes('semantic_systems')) speechProfileBoost += 2;
            if (phonologicalPct > 0.3 && meta.domains.includes('phonology')) speechProfileBoost += 2;
          }
        }
        // Phoneme difficulty → boost phonology-related exercises
        if (speechProfileSignals.phonemeDifficultyMap && meta.domains.includes('phonology')) {
          const struggling = Object.values(speechProfileSignals.phonemeDifficultyMap)
            .filter(s => s.accuracy < 70 && s.trials >= 5);
          if (struggling.length > 0) speechProfileBoost += 1;
        }
        // Challenging categories → boost semantic exercises
        if (speechProfileSignals.mostChallengingCategories &&
            speechProfileSignals.mostChallengingCategories.length > 0 &&
            meta.domains.includes('semantic_systems')) {
          speechProfileBoost += 1;
        }
      }

      // === EXERCISE STRUGGLE BOOST ===
      // Struggling exercises get a targeted re-exposure boost
      let struggleBoost = 0;
      if (struggleBoosts && struggleBoosts.has(id)) {
        struggleBoost = struggleBoosts.get(id) || 0;
      }

      const finalScore = baseScore + recencyPenalty + componentPenalty + primaryDomainBoost + speechProfileBoost + struggleBoost;

      selectionReasons.push({
        id,
        baseScore,
        recencyPenalty,
        componentPenalty,
        primaryDomainBoost,
        speechProfileBoost,
        finalScore,
        reason: [
          penaltyReason || 'no recency penalty',
          struggleBoost > 0 ? `struggle re-exposure: +${struggleBoost}` : '',
        ].filter(Boolean).join('; '),
      });

      return {
        id,
        score: finalScore,
        domains: meta.domains,
        baseMinutes: meta.baseMinutes,
        baseComponent: meta.baseComponent,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  // Log primaryDomains wiring for observability
  if (mappedPrimaryDomains.length > 0) {
    reasoning.push(`Adaptive engine prioritizing: ${(primaryDomains || []).join(', ')}`);
    console.log('[DailyLessonEngine] primaryDomains wired:', {
      raw: primaryDomains,
      mapped: mappedPrimaryDomains,
      boostedExercises: selectionReasons
        .filter(r => r.primaryDomainBoost > 0)
        .map(r => `${r.id} (+${r.primaryDomainBoost})`),
    });
  }
  if (speechProfileSignals) {
    const boosted = selectionReasons.filter(r => r.speechProfileBoost > 0);
    if (boosted.length > 0) {
      console.log('[DailyLessonEngine] Speech profile boosts:', boosted.map(r => `${r.id} (+${r.speechProfileBoost})`));
    }
  }

  // Helper to check if two exercises share the same base component
  const sharesBaseComponent = (ex1: typeof scoredExercises[0], ex2: typeof scoredExercises[0]): boolean => {
    if (!ex1 || !ex2) return false;
    return !!(ex1.baseComponent && ex1.baseComponent === ex2.baseComponent);
  };

  // Helper to get next best exercise that doesn't share component with previous
  const getNextNonRepetitiveExercise = (
    candidates: typeof scoredExercises,
    previousExercise: typeof scoredExercises[0],
    usedIds: Set<string>
  ): typeof scoredExercises[0] => {
    for (const ex of candidates) {
      if (!ex || usedIds.has(ex.id)) continue;
      if (!sharesBaseComponent(ex, previousExercise)) {
        return ex;
      }
    }
    // If all share component, just return first unused (fallback)
    return candidates.find(ex => ex && !usedIds.has(ex.id)) || null;
  };

  const blocks: ExerciseBlock[] = [];
  let remainingTime = totalDuration;
  const usedExerciseIds = new Set<string>();
  let lastAddedExercise: typeof scoredExercises[0] = null;

  // 1. WARMUP (1-2 min) - confidence-building exercise
  // Profile-aware: prefer exercises that match the user's PRIMARY domain but are easy.
  // CRITICAL: respect recencyPenalty (already baked into `score`) so we don't pick the
  // same warmup game day after day. Previously this sort ignored score and always
  // picked the lowest-baseMinutes primary-match → Category Fluency every session.
  const warmupCandidates = scoredExercises
    .filter(e => e && e.baseMinutes <= 3)
    .sort((a, b) => {
      if (!a || !b) return 0;
      // Primary-domain match still matters most (therapeutic relevance)
      const aMatchesPrimary = a.domains.some(d => mappedPrimaryDomains.includes(d)) ? 1 : 0;
      const bMatchesPrimary = b.domains.some(d => mappedPrimaryDomains.includes(d)) ? 1 : 0;
      if (bMatchesPrimary !== aMatchesPrimary) return bMatchesPrimary - aMatchesPrimary;
      // Then prefer higher overall score (includes recency penalty + struggle boost)
      // → automatically rotates warmups while still respecting clinical fit.
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreak: shorter exercises win (true warmup feel)
      return a.baseMinutes - b.baseMinutes;
    });

  const warmup = warmupCandidates[0] || scoredExercises[0];
  if (warmup && remainingTime >= 1) {
    const matchesPrimary = warmup.domains.some(d => mappedPrimaryDomains.includes(d));
    const duration = Math.min(2, remainingTime);
    blocks.push({
      exerciseId: warmup.id,
      duration,
      priority: 'warmup',
      adaptations: {
        startDifficulty: 1,
        cueLevel: 2, // Higher cue level for warmup = easier success
        timeout: 6000,
        visualSupport: true,
      },
      reasoning: matchesPrimary
        ? `Therapeutic warmup: ${warmup.id} (matches primary domain)`
        : `General warmup: ${warmup.id}`,
    });
    remainingTime -= duration;
    usedExerciseIds.add(warmup.id);
    lastAddedExercise = warmup;
    reasoning.push(`Starting with ${warmup.id} as warmup (${duration}m)`);
  }

  // Also mark same-component siblings as "avoid" for primary selection
  const warmupComponent = warmup?.baseComponent;

  // 2. PRIMARY BLOCK (40-50% of time) - top priority exercises (avoid same component as warmup)
  const primaryCount = Math.min(2, scoredExercises.length);
  const primaryTime = Math.floor(remainingTime * 0.45);
  
  for (let i = 0; i < primaryCount && remainingTime > 0; i++) {
    // Get next exercise that doesn't share base component with last added
    let ex = getNextNonRepetitiveExercise(scoredExercises, lastAddedExercise, usedExerciseIds);
    
    // Extra check: first primary should NOT share component with warmup
    if (i === 0 && ex && warmupComponent && ex.baseComponent === warmupComponent) {
      // Find alternative that doesn't share warmup component
      const alternative = scoredExercises.find(e => 
        e && !usedExerciseIds.has(e.id) && e.baseComponent !== warmupComponent
      );
      if (alternative) ex = alternative;
    }
    
    if (!ex) continue;
    
    const duration = Math.min(
      Math.floor(primaryTime / primaryCount),
      ex.baseMinutes,
      remainingTime
    );

    if (duration < 1) continue;

    // Use TodayFocus startDifficulty if engine recommends it, else derive from capability
    const effectiveStartDifficulty = todayFocusAdaptations?.startDifficulty 
      ?? Math.max(0, capabilityScores.attention - 2);

    // Apply struggle re-entry config if this exercise was flagged as struggling
    const reEntryConfig = struggleReEntryConfigs?.get(ex.id);
    const blockDifficulty = reEntryConfig?.difficulty ?? effectiveStartDifficulty;
    const blockCueLevel = reEntryConfig?.cueLevel ?? (performanceSignals.frustrationLevel === 'high' ? 2 : 1);
    const struggleNote = reEntryConfig ? ` (re-entry: easier start, increased support)` : '';

    blocks.push({
      exerciseId: ex.id,
      duration,
      priority: 'primary',
      adaptations: {
        startDifficulty: blockDifficulty,
        cueLevel: blockCueLevel,
        timeout: performanceSignals.avgReactionTime * 2,
        visualSupport: capabilityScores.vision < 5,
      },
      reasoning: `Primary: ${ex.domains.join(', ')}${struggleNote}`,
    });
    remainingTime -= duration;
    usedExerciseIds.add(ex.id);
    lastAddedExercise = ex;
    reasoning.push(`${ex.id} prioritized: targets ${ex.domains.join(', ')} (${duration}m)`);
  }

  // 3. SECONDARY BLOCK (30% of time) - cross-domain support (avoid same component)
  const secondaryTime = Math.floor(totalDuration * 0.3);
  let addedSecondary = 0;

  for (let i = 0; i < scoredExercises.length && addedSecondary < 2 && remainingTime >= 2; i++) {
    const ex = getNextNonRepetitiveExercise(scoredExercises, lastAddedExercise, usedExerciseIds);
    if (!ex) break;

    const duration = Math.min(
      Math.floor(secondaryTime / 2),
      ex.baseMinutes,
      remainingTime
    );

    if (duration < 1) continue;

    // Use TodayFocus startDifficulty consistently (same source of truth as primary)
    const effectiveStartDifficulty = todayFocusAdaptations?.startDifficulty 
      ?? Math.max(0, capabilityScores.attention - 2);

    blocks.push({
      exerciseId: ex.id,
      duration,
      priority: 'secondary',
      adaptations: {
        startDifficulty: effectiveStartDifficulty,
        cueLevel: 1,
        timeout: performanceSignals.avgReactionTime * 1.5,
        visualSupport: capabilityScores.vision < 6,
      },
      reasoning: `Supporting domain: ${ex.domains.join(', ')}`,
    });
    remainingTime -= duration;
    usedExerciseIds.add(ex.id);
    lastAddedExercise = ex;
    addedSecondary++;
  }

  // === DOMAIN FAMILY BALANCING ===
  // Enforce ≥2 domain families in session to prevent tunnel-vision therapy
  const currentFamilies = new Set<string>();
  for (const block of blocks) {
    const meta = exerciseMetadata[block.exerciseId];
    if (meta) {
      getExerciseDomainFamilies(meta.domains).forEach(f => currentFamilies.add(f));
    }
  }
  
  if (currentFamilies.size < 2 && remainingTime >= 2) {
    // Find an exercise from an unrepresented family
    const missingFamilyExercise = scoredExercises.find(ex => {
      if (!ex || usedExerciseIds.has(ex.id)) return false;
      const exFamilies = getExerciseDomainFamilies(ex.domains);
      return exFamilies.some(f => !currentFamilies.has(f));
    });
    
    if (missingFamilyExercise) {
      const duration = Math.min(missingFamilyExercise.baseMinutes, remainingTime, 3);
      if (duration >= 1) {
        const effectiveStartDifficulty = todayFocusAdaptations?.startDifficulty 
          ?? Math.max(0, capabilityScores.attention - 2);
        blocks.push({
          exerciseId: missingFamilyExercise.id,
          duration,
          priority: 'secondary',
          adaptations: {
            startDifficulty: effectiveStartDifficulty,
            cueLevel: 1,
            timeout: performanceSignals.avgReactionTime * 1.5,
            visualSupport: capabilityScores.vision < 6,
          },
          reasoning: `Balance: cross-domain coverage (${getExerciseDomainFamilies(missingFamilyExercise.domains).join(', ')})`,
        });
        remainingTime -= duration;
        usedExerciseIds.add(missingFamilyExercise.id);
        lastAddedExercise = missingFamilyExercise;
        const newFamilies = getExerciseDomainFamilies(missingFamilyExercise.domains);
        newFamilies.forEach(f => currentFamilies.add(f));
        reasoning.push(`Added ${missingFamilyExercise.id} for cross-domain balance`);
      }
    }
  }

  // === EXECUTIVE FUNCTION REACHABILITY GUARANTEE ===
  // multi-step-plan / dual-load-naming target executive_function but rarely
  // outscore expressive/semantic exercises for anomic profiles. Ensure ≥1 EF
  // exercise appears when the session has room and none was included yet.
  const EF_EXERCISE_IDS = new Set(['multi-step-plan', 'dual-load-naming', 'detective-mind', 'pattern-match']);
  const sessionHasEF = blocks.some(b => EF_EXERCISE_IDS.has(b.exerciseId));
  if (!sessionHasEF && totalDuration >= 6 && remainingTime >= 2) {
    const efCandidate = scoredExercises.find(ex =>
      ex && !usedExerciseIds.has(ex.id) && EF_EXERCISE_IDS.has(ex.id)
    );
    if (efCandidate) {
      const duration = Math.min(efCandidate.baseMinutes, remainingTime, 3);
      if (duration >= 1) {
        const effectiveStartDifficulty = todayFocusAdaptations?.startDifficulty
          ?? Math.max(0, capabilityScores.attention - 2);
        blocks.push({
          exerciseId: efCandidate.id,
          duration,
          priority: 'secondary',
          adaptations: {
            startDifficulty: effectiveStartDifficulty,
            cueLevel: 1,
            timeout: performanceSignals.avgReactionTime * 1.5,
            visualSupport: capabilityScores.vision < 6,
          },
          reasoning: `EF reachability: ${efCandidate.id} (executive_function not yet covered)`,
        });
        remainingTime -= duration;
        usedExerciseIds.add(efCandidate.id);
        lastAddedExercise = efCandidate;
        reasoning.push(`Added ${efCandidate.id} to guarantee executive function coverage`);
      }
    }
  }

  // 4. CONSOLIDATION (1-2 min) - easy success (flexible, not motor-only)
  if (remainingTime >= 1) {
    // Prefer exercise from different component than last; motor is fine but not required
    let consolidationExercise: typeof scoredExercises[0] = null;
    
    // Collect exerciseIds already in session to prevent duplicates
    const usedIds = new Set(blocks.map(b => b.exerciseId));
    
    // First try: any exercise not already in session and doesn't share component with last
    consolidationExercise = scoredExercises.find(e => 
      e && !usedIds.has(e.id) && !sharesBaseComponent(e, lastAddedExercise)
    ) || scoredExercises.find(e => e && !usedIds.has(e.id)) // fallback: just not a duplicate
    || null; // Never repeat an exercise already in the session; skip consolidation instead
    
    if (consolidationExercise) {
      blocks.push({
        exerciseId: consolidationExercise.id,
        duration: Math.min(2, remainingTime),
        priority: 'consolidation',
        adaptations: {
          startDifficulty: 1,
          cueLevel: 0,
          timeout: 6000,
          visualSupport: true,
        },
        reasoning: `Consolidation: ${consolidationExercise.id}`,
      });
    }
  }

  // Log lesson structure with selection reasoning for inspectability
  console.log('[DailyLessonEngine] Generated lesson blocks:', 
    blocks.map(b => `${b.priority}: ${b.exerciseId}`).join(' → ')
  );
  
  // Log selection reasoning (Phase 3 debug output)
  if (selectionReasons.length > 0) {
    const top10 = selectionReasons
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10);
    console.log('[DailyLessonEngine] Exercise scoring (top 10):', 
      top10.map(r => ({
        exercise: r.id,
        base: r.baseScore,
        primaryDomain: r.primaryDomainBoost,
        speechProfile: r.speechProfileBoost,
        recency: r.recencyPenalty,
        component: r.componentPenalty,
        final: r.finalScore,
        reason: r.reason,
      }))
    );
    
    // Log selected vs penalized for quick diagnosis
    const selected = new Set(blocks.map(b => b.exerciseId));
    const penalized = selectionReasons.filter(r => r.recencyPenalty < 0 || r.componentPenalty < 0);
    if (penalized.length > 0) {
      console.log('[DailyLessonEngine] Recency penalties applied:', 
        penalized.map(r => `${r.id}: ${r.reason} (${selected.has(r.id) ? 'still selected' : 'deprioritized'})`).join(', ')
      );
    }
    
    // SUPPRESSION DETECTION: warn if the clinically top-ranked exercise for any
    // high-priority domain was pushed out entirely by recency penalties
    const highPriorityDomains = Object.entries(domainPriorities)
      .filter(([, level]) => level === 'high')
      .map(([domain]) => domain);
    
    for (const domain of highPriorityDomains) {
      // Find the exercise that would have been #1 for this domain without penalties
      const domainExercises = selectionReasons
        .filter(r => exerciseMetadata[r.id]?.domains.includes(domain))
        .sort((a, b) => b.baseScore - a.baseScore);
      
      const topByBase = domainExercises[0];
      if (topByBase && !selected.has(topByBase.id) && (topByBase.recencyPenalty < 0 || topByBase.componentPenalty < 0)) {
        const totalPenalty = topByBase.recencyPenalty + topByBase.componentPenalty;
        console.warn(
          `[DailyLessonEngine] ⚠️ SUPPRESSION: Top exercise for high-priority domain "${domain}" ` +
          `(${topByBase.id}, base=${topByBase.baseScore}) was deprioritized by recency (${totalPenalty}). ` +
          `Final=${topByBase.finalScore}. Check if domain coverage is adequate.`
        );
        reasoning.push(`⚠️ ${topByBase.id} suppressed for "${domain}" by recency (${totalPenalty})`);
      }
    }
  }

  const targetDomains = Array.from(
    new Set(blocks.flatMap(b => exerciseMetadata[b.exerciseId]?.domains || []))
  );

  const energyLevel = 
    totalDuration <= 7 ? 'light' :
    totalDuration <= 15 ? 'moderate' :
    'challenging';

  // === PRE-PLAN SUPPORT FALLBACK BLOCKS ===
  // These are NOT in the main queue — LessonFlow inserts them if the user is struggling
  const supportBlocks: ExerciseBlock[] = [];
  const supportCandidates = scoredExercises.filter(e => 
    e && e.baseMinutes <= 3 &&
    // Prefer easy, cueable exercises
    CANONICAL_EXERCISES.find(ce => ce.slug === e.id)?.difficulty === 'Easy'
  );
  
  for (const candidate of supportCandidates.slice(0, 2)) {
    if (!candidate) continue;
    supportBlocks.push({
      exerciseId: candidate.id,
      duration: 2,
      priority: 'support',
      adaptations: {
        startDifficulty: 1,
        cueLevel: 3, // Maximum support
        timeout: 8000,
        visualSupport: true,
      },
      reasoning: `Support fallback: easy ${candidate.id} with maximum cueing`,
    });
  }

  if (supportBlocks.length > 0) {
    reasoning.push(`Pre-planned ${supportBlocks.length} support fallback(s): ${supportBlocks.map(b => b.exerciseId).join(', ')}`);
  }

  return {
    totalDuration,
    blocks,
    supportBlocks: supportBlocks.length > 0 ? supportBlocks : undefined,
    targetDomains,
    reasoning,
    energyLevel,
    doseReasoning: doseResult.reasoning,
    sessionFrameId: 'general_session',
  };
}

/**
 * Get performance signals from recent session data
 */
export function aggregatePerformanceSignals(
  recentTrials: any[], // From exercise_events
  recentSessions: any[] // From sessions
): PerformanceSignals {
  if (recentTrials.length === 0) {
    return {
      avgReactionTime: 3000,
      avgAccuracy: 0.5,
      timeoutRate: 0.1,
      errorTypes: { semantic: 0, phonological: 0, omissions: 0, perseverations: 0 },
      frustrationLevel: 'low',
      fatigueLevel: 'low',
      engagementScore: 5,
    };
  }

  const totalTrials = recentTrials.length;
  const correctTrials = recentTrials.filter(t => t.score === 1).length;
  const timeouts = recentTrials.filter(t => t.reaction_time_ms === null).length;

  const validRTs = recentTrials
    .filter(t => t.reaction_time_ms !== null)
    .map(t => t.reaction_time_ms);
  const avgReactionTime = validRTs.length > 0
    ? validRTs.reduce((a, b) => a + b, 0) / validRTs.length
    : 3000;

  const errorCounts = {
    semantic: 0,
    phonological: 0,
    omissions: 0,
    perseverations: 0,
  };

  recentTrials.forEach(t => {
    if (t.error_type) {
      if (t.error_type.includes('semantic')) errorCounts.semantic++;
      if (t.error_type.includes('phonological')) errorCounts.phonological++;
      if (t.error_type.includes('omission')) errorCounts.omissions++;
      if (t.error_type.includes('perseveration')) errorCounts.perseverations++;
    }
  });

  const errorTypes = {
    semantic: errorCounts.semantic / totalTrials,
    phonological: errorCounts.phonological / totalTrials,
    omissions: errorCounts.omissions / totalTrials,
    perseverations: errorCounts.perseverations / totalTrials,
  };

  // Infer frustration from engagement_flags
  let frustrationSignals = 0;
  recentTrials.forEach(t => {
    if (t.engagement_flags) {
      const flags = t.engagement_flags as any;
      if (flags.frustrationLevel === 'high') frustrationSignals++;
    }
  });
  const frustrationLevel = 
    frustrationSignals > totalTrials * 0.3 ? 'high' :
    frustrationSignals > totalTrials * 0.15 ? 'medium' :
    'low';

  // Infer fatigue from RT drift
  const firstHalfRT = validRTs.slice(0, Math.floor(validRTs.length / 2));
  const secondHalfRT = validRTs.slice(Math.floor(validRTs.length / 2));
  const rtDrift = secondHalfRT.length > 0 && firstHalfRT.length > 0
    ? (secondHalfRT.reduce((a, b) => a + b, 0) / secondHalfRT.length) -
      (firstHalfRT.reduce((a, b) => a + b, 0) / firstHalfRT.length)
    : 0;

  const fatigueLevel = 
    rtDrift > 1000 ? 'high' :
    rtDrift > 500 ? 'medium' :
    'low';

  const engagementScore = Math.max(1, Math.min(10, 
    10 - (frustrationSignals / totalTrials) * 5 - (timeouts / totalTrials) * 3
  ));

  return {
    avgReactionTime,
    avgAccuracy: correctTrials / totalTrials,
    timeoutRate: timeouts / totalTrials,
    errorTypes,
    frustrationLevel,
    fatigueLevel,
    engagementScore,
  };
}
