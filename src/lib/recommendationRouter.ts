/**
 * Maps recommendation text to specific exercise routes
 * Used for "Practice now" deep-linking from Smart Recommendations
 */

export interface RecommendationRoute {
  route: string;
  label: string;
  exerciseType: string;
}

/**
 * Analyzes recommendation text to determine the most relevant exercise
 */
export function getRecommendedExerciseRoute(recommendationText: string): RecommendationRoute | null {
  const text = recommendationText.toLowerCase();
  
  // Semantic/word-finding patterns
  if (
    text.includes('semantic') ||
    text.includes('word finding') ||
    text.includes('word-finding') ||
    text.includes('retrieval') ||
    text.includes('meaning') ||
    text.includes('category') ||
    text.includes('related word')
  ) {
    return {
      route: '/exercise/semantic-features',
      label: 'Practice word meanings (5 min)',
      exerciseType: 'semantic',
    };
  }
  
  // Phonological/sound patterns
  if (
    text.includes('phonemic') ||
    text.includes('phonological') ||
    text.includes('sound') ||
    text.includes('pronunciation') ||
    text.includes('articulation')
  ) {
    return {
      route: '/exercise/phonological-awareness',
      label: 'Practice sounds (5 min)',
      exerciseType: 'phonological',
    };
  }
  
  // Naming/photo patterns
  if (
    text.includes('naming') ||
    text.includes('photo') ||
    text.includes('picture') ||
    text.includes('object')
  ) {
    return {
      route: '/exercise/photo-naming',
      label: 'Practice naming (5 min)',
      exerciseType: 'naming',
    };
  }
  
  // Sentence/phrase patterns
  if (
    text.includes('sentence') ||
    text.includes('phrase') ||
    text.includes('fluency') ||
    text.includes('speech rate') ||
    text.includes('pausing')
  ) {
    return {
      route: '/exercise/phrase-practice',
      label: 'Practice phrases (5 min)',
      exerciseType: 'sentence',
    };
  }
  
  // Attention/motor patterns
  if (
    text.includes('attention') ||
    text.includes('focus') ||
    text.includes('shorter session') ||
    text.includes('timeout')
  ) {
    return {
      route: '/exercise/reach-tap',
      label: 'Practice focus (5 min)',
      exerciseType: 'attention',
    };
  }
  
  // Motor/reaction patterns
  if (
    text.includes('motor') ||
    text.includes('reaction') ||
    text.includes('latency') ||
    text.includes('speed')
  ) {
    return {
      route: '/exercise/reach-tap',
      label: 'Practice motor skills (5 min)',
      exerciseType: 'motor',
    };
  }
  
  // Visual/spatial patterns
  if (
    text.includes('visual') ||
    text.includes('vision') ||
    text.includes('left side') ||
    text.includes('field')
  ) {
    return {
      route: '/exercise/reach-tap?variant=left-side-hunt',
      label: 'Practice visual awareness (5 min)',
      exerciseType: 'visual',
    };
  }
  
  // Default fallback - general practice (photo naming is versatile)
  return {
    route: '/exercise/photo-naming',
    label: 'Practice (5 min)',
    exerciseType: 'general',
  };
}

/**
 * Maps error types to exercise routes for "Practice this type" buttons
 */
export function getExerciseForErrorType(errorType: string): RecommendationRoute | null {
  const errorMap: Record<string, RecommendationRoute> = {
    semantic_paraphasia: {
      route: '/exercise/semantic-features',
      label: 'Practice word meanings (5 min)',
      exerciseType: 'semantic',
    },
    phonemic_paraphasia: {
      route: '/exercise/phonological-awareness',
      label: 'Practice sounds (5 min)',
      exerciseType: 'phonological',
    },
    neologism: {
      route: '/exercise/photo-naming',
      label: 'Practice naming (5 min)',
      exerciseType: 'naming',
    },
    circumlocution: {
      route: '/exercise/semantic-features',
      label: 'Practice word retrieval (5 min)',
      exerciseType: 'semantic',
    },
    perseveration: {
      route: '/exercise/photo-naming',
      label: 'Practice with variety (5 min)',
      exerciseType: 'naming',
    },
    no_response: {
      route: '/exercise/reach-tap',
      label: 'Warm up with motor task (5 min)',
      exerciseType: 'motor',
    },
    mixed_error: {
      route: '/exercise/semantic-features',
      label: 'Practice word features (5 min)',
      exerciseType: 'semantic',
    },
    unrelated: {
      route: '/exercise/semantic-features',
      label: 'Practice categories (5 min)',
      exerciseType: 'semantic',
    },
  };
  
  return errorMap[errorType] || null;
}
