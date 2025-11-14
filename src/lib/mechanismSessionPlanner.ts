import { ClinicalProfile, ExerciseRecommendation } from "./clinicalProfileMapper";

export interface SessionPlan {
  mechanism: string;
  strategy: string;
  exercises: ExerciseRecommendation[];
  sessionStructure: {
    duration: number; // minutes
    exerciseRotation: string[];
    breakFrequency: number; // minutes between breaks
    difficultyProgression: 'static' | 'gradual' | 'adaptive';
  };
  rationale: string;
}

export function generateMechanismBasedSession(profile: ClinicalProfile | null): SessionPlan | null {
  if (!profile) return null;

  // Extract mechanism from profile metadata
  const mechanism = (profile as any).stroke_mechanism || 
                   (profile.source_phrases as any)?.mechanism || 
                   'undetermined';

  const { impairments } = profile;
  
  // Cardioembolic: Multi-domain exercises covering motor + speech + visual
  if (mechanism === 'cardioembolic') {
    const exercises: ExerciseRecommendation[] = [];
    
    // Always include motor if any motor impairment
    if (impairments.motor.length > 0) {
      const targetSide = profile.affected_side === 'bilateral' ? 'both' : 
                        profile.affected_side === 'left' ? 'left' :
                        profile.affected_side === 'right' ? 'right' : 'both';
      
      exercises.push({
        slug: 'reach-tap',
        priority: 'high',
        reason: 'Cardioembolic pattern - motor domain coverage',
        config: {
          startDifficulty: 2,
          targetSide,
          sessionLength: 'short',
          timeout: 3000
        }
      });
    }

    // Include speech if any speech impairment
    if (impairments.speech.length > 0) {
      exercises.push({
        slug: 'photo-naming',
        priority: 'high',
        reason: 'Cardioembolic pattern - language domain coverage',
        config: {
          startDifficulty: 2,
          enableVoice: true,
          maxChoices: 3,
          sessionLength: 'short'
        }
      });
    }

    // Include visual scanning for multi-territory involvement
    if (impairments.visual.length > 0 || exercises.length >= 2) {
      exercises.push({
        slug: 'reach-tap',
        priority: 'medium',
        reason: 'Cardioembolic pattern - visual-motor integration',
        config: {
          startDifficulty: 1,
          targetSide: 'both',
          sessionLength: 'short',
          visualCues: true
        }
      });
    }

    return {
      mechanism: 'cardioembolic',
      strategy: 'Multi-domain training targeting multiple affected territories',
      exercises,
      sessionStructure: {
        duration: 20,
        exerciseRotation: exercises.map(e => e.slug),
        breakFrequency: 5,
        difficultyProgression: 'adaptive'
      },
      rationale: 'Cardioembolic strokes affect multiple vascular territories. This session rotates through motor, speech, and visual exercises to address the distributed nature of the deficits.'
    };
  }

  // Lacunar: Focused single-domain therapy
  if (mechanism === 'lacunar') {
    const exercises: ExerciseRecommendation[] = [];
    
    // Identify primary domain
    const primaryDomain = impairments.motor.length > 0 ? 'motor' :
                         impairments.speech.length > 0 ? 'speech' :
                         impairments.cognitive.length > 0 ? 'cognitive' : 'motor';

    if (primaryDomain === 'motor') {
      const targetSide = profile.affected_side === 'bilateral' ? 'both' : 
                        profile.affected_side === 'left' ? 'left' :
                        profile.affected_side === 'right' ? 'right' : 'both';
      
      exercises.push({
        slug: 'reach-tap',
        priority: 'high',
        reason: 'Lacunar stroke - focused motor training',
        config: {
          startDifficulty: 1,
          targetSide,
          sessionLength: 'medium',
          timeout: 3500,
          consecutiveRequired: 3
        }
      });
    } else if (primaryDomain === 'speech') {
      exercises.push({
        slug: 'photo-naming',
        priority: 'high',
        reason: 'Lacunar stroke - intensive language training',
        config: {
          startDifficulty: 1,
          enableVoice: true,
          maxChoices: 2,
          sessionLength: 'medium',
          cueLevel: 3
        }
      });
    }

    return {
      mechanism: 'lacunar',
      strategy: 'Intensive single-domain therapy for focal deficit',
      exercises,
      sessionStructure: {
        duration: 15,
        exerciseRotation: [exercises[0].slug], // Single exercise focus
        breakFrequency: 7,
        difficultyProgression: 'static'
      },
      rationale: 'Lacunar strokes cause focal deficits in a single domain. This session provides intensive, repetitive practice in the primary affected area for maximum neuroplasticity.'
    };
  }

  // Large artery: Gradual difficulty progression with motor emphasis
  if (mechanism === 'large_artery') {
    const exercises: ExerciseRecommendation[] = [];
    
    const targetSide = profile.affected_side === 'bilateral' ? 'both' : 
                      profile.affected_side === 'left' ? 'left' :
                      profile.affected_side === 'right' ? 'right' : 'right';
    
    // Start with motor (always affected in large artery)
    exercises.push({
      slug: 'reach-tap',
      priority: 'high',
      reason: 'Large artery stroke - graduated motor progression',
      config: {
        startDifficulty: 1,
        targetSide,
        sessionLength: 'long',
        timeout: 4000,
        startSize: 120
      }
    });

    // Add speech if affected
    if (impairments.speech.length > 0) {
      exercises.push({
        slug: 'photo-naming',
        priority: 'medium',
        reason: 'Large artery stroke - supportive language practice',
        config: {
          startDifficulty: 1,
          enableVoice: true,
          maxChoices: 2,
          sessionLength: 'short'
        }
      });
    }

    return {
      mechanism: 'large_artery',
      strategy: 'Gradual progression with motor-dominant focus',
      exercises,
      sessionStructure: {
        duration: 25,
        exerciseRotation: exercises.map(e => e.slug),
        breakFrequency: 8,
        difficultyProgression: 'gradual'
      },
      rationale: 'Large artery strokes cause extensive deficits requiring careful, graduated progression. This session emphasizes motor recovery with gradual difficulty increases and adequate rest periods.'
    };
  }

  // Undetermined: Balanced approach
  const exercises: ExerciseRecommendation[] = [];
  
  if (impairments.motor.length > 0) {
    const targetSide = profile.affected_side === 'bilateral' ? 'both' : 
                      profile.affected_side === 'left' ? 'left' :
                      profile.affected_side === 'right' ? 'right' : 'both';
    
    exercises.push({
      slug: 'reach-tap',
      priority: 'high',
      reason: 'Balanced motor training',
      config: {
        startDifficulty: 2,
        targetSide,
        sessionLength: 'medium'
      }
    });
  }

  if (impairments.speech.length > 0) {
    exercises.push({
      slug: 'photo-naming',
      priority: 'high',
      reason: 'Balanced language training',
      config: {
        startDifficulty: 2,
        enableVoice: true,
        sessionLength: 'medium'
      }
    });
  }

  return {
    mechanism: 'undetermined',
    strategy: 'Balanced multi-domain approach',
    exercises,
    sessionStructure: {
      duration: 20,
      exerciseRotation: exercises.map(e => e.slug),
      breakFrequency: 6,
      difficultyProgression: 'adaptive'
    },
    rationale: 'Stroke mechanism unclear. This session provides balanced training across affected domains with adaptive difficulty to optimize recovery.'
  };
}
