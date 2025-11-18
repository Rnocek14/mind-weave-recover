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
 * Determine today's dose based on fatigue and frustration
 */
export function calculateTodaysDose(
  performanceSignals: PerformanceSignals,
  baselineMinutes: number = 15
): number {
  let dose = baselineMinutes;

  // Reduce for high fatigue
  if (performanceSignals.fatigueLevel === 'high') {
    dose *= 0.5; // 50% of baseline
  } else if (performanceSignals.fatigueLevel === 'medium') {
    dose *= 0.75; // 75% of baseline
  }

  // Reduce for high frustration
  if (performanceSignals.frustrationLevel === 'high') {
    dose *= 0.6;
  } else if (performanceSignals.frustrationLevel === 'medium') {
    dose *= 0.85;
  }

  // Increase for high engagement (but cap at 25 min)
  if (performanceSignals.engagementScore >= 8) {
    dose = Math.min(dose * 1.2, 25);
  }

  // Floor at 5 minutes
  return Math.max(5, Math.round(dose));
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
  learningRates: LearningRateData[]
): DailyLesson {
  const domainPriorities = calculateDomainPriorities(clinicalProfile);
  const totalDuration = calculateTodaysDose(performanceSignals);
  const reasoning: string[] = [];

  // Exercise metadata (extend this with your actual exercise catalog)
  const exerciseMetadata: Record<string, { domains: string[]; baseMinutes: number }> = {
    'reach-tap': { domains: ['motor_control', 'attention'], baseMinutes: 2 },
    'photo-naming': { domains: ['expressive_language', 'semantic_systems'], baseMinutes: 4 },
    'phonological': { domains: ['phonology', 'expressive_language'], baseMinutes: 3 },
    'semantic-features': { domains: ['semantic_systems', 'receptive_language'], baseMinutes: 3 },
    'phrase-practice': { domains: ['expressive_language', 'phonology'], baseMinutes: 4 },
    'sentence-construction': { domains: ['expressive_language', 'receptive_language'], baseMinutes: 4 },
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
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  const blocks: ExerciseBlock[] = [];
  let remainingTime = totalDuration;

  // 1. WARMUP (1-2 min) - simple motor task
  const warmup = scoredExercises.find(e => e!.domains.includes('motor_control'));
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
      reasoning: 'Light motor warmup to engage attention and reduce anxiety',
    });
    remainingTime -= duration;
    reasoning.push(`Starting with ${warmup.id} as warmup (${duration}m)`);
  }

  // 2. PRIMARY BLOCK (40-50% of time) - top priority exercises
  const primaryCount = Math.min(2, scoredExercises.length);
  const primaryTime = Math.floor(remainingTime * 0.45);
  
  for (let i = 0; i < primaryCount && remainingTime > 0; i++) {
    const ex = scoredExercises[i];
    if (!ex) continue;
    
    const duration = Math.min(
      Math.floor(primaryTime / primaryCount),
      ex.baseMinutes,
      remainingTime
    );

    if (duration < 1) continue;

    blocks.push({
      exerciseId: ex.id,
      duration,
      priority: 'primary',
      adaptations: {
        startDifficulty: Math.max(1, capabilityScores.attention - 2),
        cueLevel: performanceSignals.frustrationLevel === 'high' ? 2 : 1,
        timeout: performanceSignals.avgReactionTime * 2,
        visualSupport: capabilityScores.vision < 5,
      },
      reasoning: `High priority based on ${ex.domains.join(', ')}`,
    });
    remainingTime -= duration;
    reasoning.push(`${ex.id} prioritized: targets ${ex.domains.join(', ')} (${duration}m)`);
  }

  // 3. SECONDARY BLOCK (30% of time) - cross-domain support
  const secondaryTime = Math.floor(totalDuration * 0.3);
  const secondaryExercises = scoredExercises.slice(primaryCount, primaryCount + 2);

  for (const ex of secondaryExercises) {
    if (!ex || remainingTime < 2) break;

    const duration = Math.min(
      Math.floor(secondaryTime / secondaryExercises.length),
      ex.baseMinutes,
      remainingTime
    );

    if (duration < 1) continue;

    blocks.push({
      exerciseId: ex.id,
      duration,
      priority: 'secondary',
      adaptations: {
        startDifficulty: Math.max(1, capabilityScores.attention - 1),
        cueLevel: 1,
        timeout: performanceSignals.avgReactionTime * 1.5,
        visualSupport: capabilityScores.vision < 6,
      },
      reasoning: `Supporting domain: ${ex.domains.join(', ')}`,
    });
    remainingTime -= duration;
  }

  // 4. CONSOLIDATION (1-2 min) - easy success
  if (remainingTime >= 1 && warmup) {
    blocks.push({
      exerciseId: warmup.id,
      duration: Math.min(2, remainingTime),
      priority: 'consolidation',
      adaptations: {
        startDifficulty: 1,
        cueLevel: 0,
        timeout: 6000,
        visualSupport: true,
      },
      reasoning: 'End on success to boost confidence and dopamine',
    });
  }

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
