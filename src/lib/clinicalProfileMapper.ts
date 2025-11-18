export interface InferenceNote {
  impairment: string;
  source: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ClinicalProfile {
  impairments: {
    motor: string[];
    speech: string[];
    cognitive: string[];
    visual: string[];
  };
  stroke_location: string | string[] | null;
  affected_side: 'left' | 'right' | 'bilateral' | null;
  therapy_focus: string[];
  severity?: Record<string, string>;
  notes?: string | null;
  profile_source?: 'manual' | 'nlp' | 'hybrid';
  last_updated?: string | null;
  source_phrases?: Record<string, any>;
  confidence?: 'high' | 'medium' | 'low';
  inference_notes?: InferenceNote[];
  stroke_mechanism?: 'cardioembolic' | 'lacunar' | 'large_artery' | 'undetermined';
  extraction_metadata?: {
    last_updated?: string;
    parser_version?: string;
    [key: string]: any;
  };
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

  // Speech impairments → Photo Naming Game & Phrase Practice
  if (impairments.speech.length > 0) {
    const hasExpressiveAphasia = impairments.speech.some(imp => 
      imp.includes('aphasia') || imp.includes('expressive') || imp.includes('word')
    );
    
    const hasReceptiveAphasia = impairments.speech.some(imp => 
      imp.includes('receptive') || imp.includes('understanding')
    );

    const hasApraxia = impairments.speech.some(imp =>
      imp.includes('apraxia') || imp.includes('motor speech')
    );

    const hasNonFluentAphasia = impairments.speech.some(imp =>
      imp.includes('non-fluent') || imp.includes('broca')
    );

    // Photo Naming: Single-word retrieval
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

    // Phrase Practice: Functional communication (script training, MIT-style)
    if (hasNonFluentAphasia || hasApraxia || hasExpressiveAphasia) {
      recommendations.push({
        slug: 'word-practice',
        priority: 'high',
        reason: hasApraxia 
          ? 'Apraxia - functional phrase practice for daily communication'
          : hasNonFluentAphasia
          ? 'Non-fluent aphasia - script training for everyday needs'
          : 'Build functional communication skills',
        config: {
          startDifficulty: hasApraxia ? 1 : hasNonFluentAphasia ? 1 : 2,
          enableVoice: true,
          sessionLength: 'short',
          errorlessMode: hasApraxia,
          cueLevel: 2,
          visualCues: true
        }
      });
    }
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

  // Visual/Neglect impairments → Left-Side Hunt
  if (impairments.visual.length > 0 || impairments.cognitive.length > 0) {
    const hasNeglect = 
      impairments.visual.some(imp => imp.includes('neglect') || imp.includes('inattention')) ||
      impairments.cognitive.some(imp => imp.includes('neglect') || imp.includes('spatial'));
    
    const isRightHemisphere = 
      (typeof profile.stroke_location === 'string' && profile.stroke_location.toLowerCase().includes('right')) ||
      (Array.isArray(profile.stroke_location) && profile.stroke_location.some(loc => loc.toLowerCase().includes('right'))) ||
      affected_side === 'left';

    if (hasNeglect || isRightHemisphere) {
      recommendations.push({
        slug: 'left-side-hunt',
        priority: hasNeglect ? 'high' : 'medium',
        reason: hasNeglect 
          ? 'Left neglect - attention training for left visual field'
          : 'Right hemisphere stroke - preventive attention training',
        config: {
          startDifficulty: hasNeglect ? 1 : 2,
          targetSide: 'left',
          sessionLength: 'short',
          timeout: hasNeglect ? 4000 : 3000
        }
      });
    }
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

/**
 * Predict expected capability scores based on clinical profile
 * Used to compare against behavioral assessment results
 */
export interface ExpectedCapabilities {
  vision: { min: number; max: number; predicted: number };
  motor: { min: number; max: number; predicted: number };
  attention: { min: number; max: number; predicted: number };
  reasoning: string[];
}

export function predictExpectedCapabilities(profile: ClinicalProfile | null): ExpectedCapabilities {
  if (!profile) {
    return {
      vision: { min: 5, max: 10, predicted: 7 },
      motor: { min: 5, max: 10, predicted: 7 },
      attention: { min: 5, max: 10, predicted: 7 },
      reasoning: ['No clinical profile available'],
    };
  }

  const reasoning: string[] = [];
  let visionScore = 7; // Default baseline
  let motorScore = 7;
  let attentionScore = 7;

  // Visual impairments
  const visualImpairments = profile.impairments.visual || [];
  if (visualImpairments.length > 0) {
    if (visualImpairments.some(imp => imp.includes('neglect') || imp.includes('hemianopia'))) {
      visionScore = 3;
      reasoning.push('Severe visual impairment (neglect/hemianopia) → Vision 3/10');
    } else if (visualImpairments.some(imp => imp.includes('field cut') || imp.includes('visual'))) {
      visionScore = 5;
      reasoning.push('Moderate visual impairment → Vision 5/10');
    }
  }

  // Motor impairments
  const motorImpairments = profile.impairments.motor || [];
  if (motorImpairments.length > 0) {
    if (motorImpairments.some(imp => imp.includes('severe') || imp.includes('plegia'))) {
      motorScore = 2;
      reasoning.push('Severe motor impairment (plegia) → Motor 2/10');
    } else if (motorImpairments.some(imp => imp.includes('paresis') || imp.includes('weakness'))) {
      motorScore = 4;
      reasoning.push('Moderate motor impairment (paresis) → Motor 4/10');
    } else if (motorImpairments.some(imp => imp.includes('mild') || imp.includes('coordination'))) {
      motorScore = 6;
      reasoning.push('Mild motor impairment → Motor 6/10');
    }
  }

  // Cognitive impairments (attention)
  const cognitiveImpairments = profile.impairments.cognitive || [];
  if (cognitiveImpairments.length > 0) {
    if (cognitiveImpairments.some(imp => imp.includes('severe') || imp.includes('confusion'))) {
      attentionScore = 3;
      reasoning.push('Severe cognitive impairment → Attention 3/10');
    } else if (cognitiveImpairments.some(imp => imp.includes('attention') || imp.includes('executive'))) {
      attentionScore = 5;
      reasoning.push('Attention/executive deficits → Attention 5/10');
    } else if (cognitiveImpairments.some(imp => imp.includes('mild'))) {
      attentionScore = 6;
      reasoning.push('Mild cognitive impairment → Attention 6/10');
    }
  }

  // Stroke location adjustments
  const strokeLocation = Array.isArray(profile.stroke_location) 
    ? profile.stroke_location 
    : profile.stroke_location 
    ? [profile.stroke_location] 
    : [];

  if (strokeLocation.some(loc => loc.toLowerCase().includes('occipital') || loc.toLowerCase().includes('pca'))) {
    visionScore = Math.min(visionScore, 4);
    reasoning.push('Occipital/PCA lesion → Further reduces vision score');
  }

  if (strokeLocation.some(loc => loc.toLowerCase().includes('parietal'))) {
    attentionScore = Math.min(attentionScore, 5);
    reasoning.push('Parietal lesion → Attention/spatial deficits expected');
  }

  if (strokeLocation.some(loc => loc.toLowerCase().includes('motor cortex') || loc.toLowerCase().includes('mca'))) {
    motorScore = Math.min(motorScore, 5);
    reasoning.push('Motor cortex/MCA lesion → Motor deficits expected');
  }

  // Severity adjustments
  if (profile.severity) {
    const overallSeverity = Object.values(profile.severity).find(s => s === 'severe');
    if (overallSeverity) {
      // Reduce all scores slightly for severe overall presentation
      visionScore = Math.max(1, visionScore - 1);
      motorScore = Math.max(1, motorScore - 1);
      attentionScore = Math.max(1, attentionScore - 1);
      reasoning.push('Severe overall presentation → All scores reduced');
    }
  }

  return {
    vision: {
      min: Math.max(1, visionScore - 2),
      max: Math.min(10, visionScore + 2),
      predicted: visionScore,
    },
    motor: {
      min: Math.max(1, motorScore - 2),
      max: Math.min(10, motorScore + 2),
      predicted: motorScore,
    },
    attention: {
      min: Math.max(1, attentionScore - 2),
      max: Math.min(10, attentionScore + 2),
      predicted: attentionScore,
    },
    reasoning,
  };
}