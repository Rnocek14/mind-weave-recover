export interface ClinicalProfile {
  impairments: {
    motor: string[];
    speech: string[];
    cognitive: string[];
    visual: string[];
  };
  stroke_location: string | null;
  affected_side: 'left' | 'right' | 'bilateral' | null;
  therapy_focus: string[];
  severity?: Record<string, string>;
  notes?: string | null;
  profile_source?: 'manual' | 'nlp' | 'hybrid';
  last_updated?: string | null;
  source_phrases?: Record<string, any>;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ExerciseRecommendation {
  slug: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  config: ExerciseConfig;
}

export interface ExerciseConfig {
  startDifficulty?: number;
  enableVoice?: boolean;
  maxChoices?: number;
  cueLevel?: number;
  sessionLength?: 'short' | 'medium' | 'long';
  targetSide?: 'left' | 'right' | 'both';
  startSize?: number;
  timeout?: number;
  consecutiveRequired?: number;
  timeoutMultiplier?: number;
  errorlessMode?: boolean;
  visualCues?: boolean;
  simplifyUI?: boolean;
  textInstructions?: boolean;
  breakFrequency?: 'low' | 'medium' | 'high';
}

export function getExerciseRecommendations(profile: ClinicalProfile | null): ExerciseRecommendation[] {
  if (!profile) return [];
  
  const recommendations: ExerciseRecommendation[] = [];
  const { impairments, affected_side, therapy_focus, severity } = profile;

  // Speech impairments → Photo Naming Game
  if (impairments.speech.length > 0) {
    const hasExpressiveAphasia = impairments.speech.some(imp => 
      imp.includes('aphasia') || imp.includes('expressive') || imp.includes('word')
    );
    
    const hasReceptiveAphasia = impairments.speech.some(imp => 
      imp.includes('receptive') || imp.includes('understanding')
    );

    recommendations.push({
      slug: 'photo-naming',
      priority: 'high',
      reason: hasExpressiveAphasia 
        ? 'Expressive aphasia - naming practice' 
        : 'Speech therapy - language recovery',
      config: {
        startDifficulty: hasExpressiveAphasia ? 1 : 2,
        enableVoice: true,
        maxChoices: hasReceptiveAphasia ? 2 : 3,
        cueLevel: hasExpressiveAphasia ? 3 : 2,
        sessionLength: 'short',
        visualCues: hasReceptiveAphasia,
        simplifyUI: hasReceptiveAphasia,
        textInstructions: !hasReceptiveAphasia
      }
    });
  }

  // Motor impairments → Reach & Tap Game
  if (impairments.motor.length > 0) {
    const hasArmWeakness = impairments.motor.some(imp => 
      imp.includes('arm') || imp.includes('hand') || imp.includes('weakness') || imp.includes('paresis')
    );
    
    const severityLevel = severity?.motor || 'moderate';
    const isSerious = severityLevel === 'severe' || impairments.motor.some(imp => 
      imp.includes('hemiplegia') || imp.includes('paralysis')
    );

    recommendations.push({
      slug: 'reach-tap',
      priority: 'high',
      reason: affected_side 
        ? `${affected_side} side weakness - motor recovery`
        : 'Motor impairment - coordination training',
      config: {
        startDifficulty: isSerious ? 1 : 2,
        targetSide: affected_side === 'left' ? 'left' : affected_side === 'right' ? 'right' : 'both',
        startSize: isSerious ? 120 : 80,
        timeout: isSerious ? 4000 : 3000,
        consecutiveRequired: isSerious ? 2 : 3,
        sessionLength: 'short'
      }
    });
  }

  // Cognitive impairments → Apply global adjustments
  if (impairments.cognitive.length > 0) {
    const hasSlowProcessing = impairments.cognitive.some(imp => 
      imp.includes('slow') || imp.includes('processing')
    );
    
    const hasAttentionDeficit = impairments.cognitive.some(imp => 
      imp.includes('attention') || imp.includes('concentration')
    );
    
    const hasMemoryIssues = impairments.cognitive.some(imp => 
      imp.includes('memory') || imp.includes('recall')
    );

    // Apply cognitive adjustments to all recommendations
    recommendations.forEach(rec => {
      if (hasSlowProcessing) {
        rec.config.timeoutMultiplier = 1.5;
        rec.config.sessionLength = 'short';
      }
      if (hasAttentionDeficit) {
        rec.config.breakFrequency = 'high';
        rec.config.simplifyUI = true;
      }
      if (hasMemoryIssues) {
        rec.config.errorlessMode = true;
      }
    });
  }

  // Visual impairments → Add visual training considerations
  if (impairments.visual.length > 0) {
    const hasNeglect = impairments.visual.some(imp => 
      imp.includes('neglect') || imp.includes('inattention')
    );

    if (hasNeglect) {
      // Add visual cues to all exercises
      recommendations.forEach(rec => {
        rec.config.visualCues = true;
        if (affected_side === 'left') {
          rec.reason += ' (with left-side attention cues)';
        }
      });
    }
  }

  // Therapy focus → Prioritize matching exercises
  if (therapy_focus.length > 0) {
    therapy_focus.forEach(goal => {
      const goalLower = goal.toLowerCase();
      
      if ((goalLower.includes('speech') || goalLower.includes('language')) && 
          !recommendations.some(r => r.slug === 'photo-naming')) {
        recommendations.push({
          slug: 'photo-naming',
          priority: 'high',
          reason: 'Therapy goal: improve speech/language',
          config: {
            startDifficulty: 2,
            enableVoice: true,
            maxChoices: 3,
            cueLevel: 2,
            sessionLength: 'medium'
          }
        });
      }
      
      if ((goalLower.includes('motor') || goalLower.includes('hand') || goalLower.includes('arm')) && 
          !recommendations.some(r => r.slug === 'reach-tap')) {
        recommendations.push({
          slug: 'reach-tap',
          priority: 'high',
          reason: 'Therapy goal: improve motor function',
          config: {
            startDifficulty: 2,
            targetSide: affected_side === 'left' ? 'left' : affected_side === 'right' ? 'right' : 'both',
            startSize: 80,
            timeout: 3000,
            consecutiveRequired: 3,
            sessionLength: 'medium'
          }
        });
      }
    });
  }

  return recommendations;
}

export function getExerciseConfig(exerciseSlug: string, profile: ClinicalProfile | null): ExerciseConfig {
  if (!profile) return {};
  
  const recommendations = getExerciseRecommendations(profile);
  const recommendation = recommendations.find(r => r.slug === exerciseSlug);
  
  return recommendation?.config || {};
}