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
  priority: 'warmup' | 'primary' | 'secondary' | 'consolidation';
  adaptations: {
    startDifficulty: number;
    cueLevel: number;
    timeout: number;
    visualSupport: boolean;
  };
  reasoning: string;
}

export interface DailyLesson {
  totalDuration: number; // minutes
  blocks: ExerciseBlock[];
  targetDomains: string[];
  reasoning: string[];
  energyLevel: 'light' | 'moderate' | 'challenging';
  doseReasoning?: DoseReasoning;
}

/**
 * Calculate domain priorities from clinical profile
 */
export function calculateDomainPriorities(
  clinicalProfile: ClinicalProfile | null
): DomainPriority {
  const defaults: DomainPriority = {
    expressive_language: 'medium',
    receptive_language: 'medium',
    semantic_systems: 'medium',
    phonology: 'medium',
    motor_control: 'medium',
    attention: 'medium',
    visual_processing: 'medium',
  };

  if (!clinicalProfile) return defaults;

  const priorities = { ...defaults };
  
  // Get stroke location info
  const strokeLocation = Array.isArray(clinicalProfile.stroke_location)
    ? clinicalProfile.stroke_location.join(' ').toLowerCase()
    : (clinicalProfile.stroke_location || '').toLowerCase();

  // Infer hemisphere from stroke location or affected side
  const isLeftHemisphere = strokeLocation.includes('left') || 
    strokeLocation.includes('mca') || 
    strokeLocation.includes('broca') ||
    strokeLocation.includes('wernicke');
  
  const isRightHemisphere = strokeLocation.includes('right') ||
    clinicalProfile.affected_side === 'left'; // Left-sided weakness = right hemisphere

  // Left hemisphere lesions → prioritize language
  if (isLeftHemisphere) {
    priorities.expressive_language = 'high';
    priorities.receptive_language = 'high';
    priorities.phonology = 'high';
  }

  // Check for specific brain regions in stroke location
  if (strokeLocation.includes('temporal')) {
    priorities.semantic_systems = 'high';
  }

  if (strokeLocation.includes('frontal') || strokeLocation.includes('broca')) {
    priorities.expressive_language = 'high';
    priorities.motor_control = 'high';
  }

  if (strokeLocation.includes('parietal')) {
    priorities.attention = 'high';
    priorities.visual_processing = 'high';
  }

  if (strokeLocation.includes('motor') || strokeLocation.includes('precentral')) {
    priorities.motor_control = 'high';
  }

  // Right hemisphere → attention, spatial processing
  if (isRightHemisphere) {
    priorities.attention = 'high';
    priorities.visual_processing = 'high';
  }

  // Prioritize based on documented impairments
  if (clinicalProfile.impairments.speech.length > 0) {
    priorities.expressive_language = 'high';
    priorities.receptive_language = 'high';
  }

  if (clinicalProfile.impairments.motor.length > 0) {
    priorities.motor_control = 'high';
  }

  if (clinicalProfile.impairments.cognitive.length > 0) {
    priorities.attention = 'high';
  }

  if (clinicalProfile.impairments.visual.length > 0) {
    priorities.visual_processing = 'high';
  }

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
 * Weight exercises by domain priorities and learning rates
 */
export function scoreExercise(
  exerciseId: string,
  exerciseDomains: string[],
  domainPriorities: DomainPriority,
  learningRates: LearningRateData[],
  errorPatterns: PerformanceSignals['errorTypes']
): number {
  let score = 0;

  // Base score from domain priorities
  exerciseDomains.forEach(domain => {
    const priority = (domainPriorities as any)[domain];
    if (priority === 'high') score += 3;
    else if (priority === 'medium') score += 2;
    else score += 1;
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
): DailyLesson {
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

  // Exercise metadata with baseComponent to prevent back-to-back similar games
  const exerciseMetadata: Record<string, { domains: string[]; baseMinutes: number; baseComponent?: string }> = {
    'reach-tap': { domains: ['motor_control', 'attention'], baseMinutes: 2, baseComponent: 'reach-tap-game' },
    'left-side-hunt': { domains: ['visual_processing', 'attention'], baseMinutes: 2, baseComponent: 'reach-tap-game' },
    'pattern-match': { domains: ['attention', 'visual_processing'], baseMinutes: 2, baseComponent: 'pattern-match-game' },
    'photo-naming': { domains: ['expressive_language', 'semantic_systems'], baseMinutes: 4, baseComponent: 'photo-naming-game' },
    'phonological': { domains: ['phonology', 'expressive_language'], baseMinutes: 3, baseComponent: 'phonological-game' },
    'semantic-features': { domains: ['semantic_systems', 'receptive_language'], baseMinutes: 3, baseComponent: 'semantic-game' },
    'phrase-practice': { domains: ['expressive_language', 'phonology'], baseMinutes: 4, baseComponent: 'phrase-game' },
    'sentence-construction': { domains: ['expressive_language', 'receptive_language'], baseMinutes: 4, baseComponent: 'sentence-game' },
  };

  // Score each accessible exercise
  const scoredExercises = accessibleExercises
    .map(id => {
      const meta = exerciseMetadata[id];
      if (!meta) return null;
      return {
        id,
        score: scoreExercise(
          id,
          meta.domains,
          domainPriorities,
          learningRates,
          performanceSignals.errorTypes
        ),
        domains: meta.domains,
        baseMinutes: meta.baseMinutes,
        baseComponent: meta.baseComponent,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

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

  // 1. WARMUP (1-2 min) - simple motor task (prefer reach-tap, but allow left-side-hunt)
  const motorExercises = scoredExercises.filter(e => e!.domains.includes('motor_control'));
  const warmup = motorExercises[0];
  if (warmup && remainingTime >= 1) {
    const duration = Math.min(2, remainingTime);
    blocks.push({
      exerciseId: warmup.id,
      duration,
      priority: 'warmup',
      adaptations: {
        startDifficulty: 1,
        cueLevel: 0,
        timeout: 5000,
        visualSupport: true,
      },
      reasoning: `Light motor warmup: ${warmup.id}`,
    });
    remainingTime -= duration;
    usedExerciseIds.add(warmup.id);
    lastAddedExercise = warmup;
    reasoning.push(`Starting with ${warmup.id} as warmup (${duration}m)`);
  }

  // Also mark same-component siblings as "avoid" for primary selection
  // This ensures primary picks a DIFFERENT component type
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

    blocks.push({
      exerciseId: ex.id,
      duration,
      priority: 'primary',
      adaptations: {
        startDifficulty: effectiveStartDifficulty,
        cueLevel: performanceSignals.frustrationLevel === 'high' ? 2 : 1,
        timeout: performanceSignals.avgReactionTime * 2,
        visualSupport: capabilityScores.vision < 5,
      },
      reasoning: `Primary: ${ex.domains.join(', ')}`,
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

  // 4. CONSOLIDATION (1-2 min) - easy success (pick one that doesn't repeat last component)
  if (remainingTime >= 1) {
    // For consolidation, prefer a different component than the last block
    let consolidationExercise: typeof scoredExercises[0] = null;
    
    // First try: motor exercise that doesn't share component with last
    const motorForConsolidation = motorExercises.find(e => 
      e && !sharesBaseComponent(e, lastAddedExercise)
    );
    if (motorForConsolidation) {
      consolidationExercise = motorForConsolidation;
    } else {
      // Fallback: any exercise that doesn't share component with last
      consolidationExercise = scoredExercises.find(e => 
        e && !sharesBaseComponent(e, lastAddedExercise)
      ) || warmup; // Last resort: repeat warmup
    }
    
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

  // Log lesson structure for QA verification
  console.log('[DailyLessonEngine] Generated lesson blocks:', 
    blocks.map(b => `${b.priority}: ${b.exerciseId}`).join(' → ')
  );

  const targetDomains = Array.from(
    new Set(blocks.flatMap(b => exerciseMetadata[b.exerciseId]?.domains || []))
  );

  const energyLevel = 
    totalDuration <= 7 ? 'light' :
    totalDuration <= 15 ? 'moderate' :
    'challenging';

  return {
    totalDuration,
    blocks,
    targetDomains,
    reasoning,
    energyLevel,
    doseReasoning: doseResult.reasoning,
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
