/**
 * Generate progressive cues for photo-naming tasks
 * Enhanced with error-pattern adaptive cueing
 * 
 * Priority: cueBank lookup → generated fallback
 */

import type { LinguisticFeatures } from '@/data/photoBank';
import type { ErrorClassificationResult } from './errorClassifier';
import { analyzeErrorPatterns } from './errorClassifier';
import { getCueText as getCueBankText, hasCueCoverage } from '@/data/cueBank';

export interface CueDecision {
  cueType: 'semantic' | 'phonemic' | 'full' | 'none';
  cueText: string;
  reasoning: string;
}

/**
 * Select optimal cue based on error pattern and linguistic features
 * Adapts cue type based on whether user makes semantic vs phonemic errors
 */
export const selectOptimalCue = (
  errorHistory: ErrorClassificationResult[],
  target: string,
  category: string,
  features: LinguisticFeatures,
  currentCueLevel: number
): CueDecision => {
  
  // Analyze recent error patterns
  const patterns = analyzeErrorPatterns(errorHistory);
  
  // Rule 1: If predominantly semantic errors → semantic cue
  if (patterns.predominantPattern === 'semantic' && currentCueLevel === 0) {
    return {
      cueType: 'semantic',
      cueText: generateSemanticCue(category, target, features),
      reasoning: `${patterns.semanticErrorCount} recent semantic errors detected, providing semantic cue`
    };
  }
  
  // Rule 2: If predominantly phonemic errors → phonemic cue
  if (patterns.predominantPattern === 'phonemic' && currentCueLevel === 0) {
    return {
      cueType: 'phonemic',
      cueText: generatePhonologicalCue(target, features),
      reasoning: `${patterns.phonemicErrorCount} recent phonemic errors detected, providing phonological cue`
    };
  }
  
  // Rule 3: Standard hierarchy (semantic → phonemic → full)
  if (currentCueLevel === 0) {
    return {
      cueType: 'semantic',
      cueText: generateSemanticCue(category, target, features),
      reasoning: 'Initial cue: semantic (default starting point)'
    };
  }
  
  if (currentCueLevel === 1) {
    return {
      cueType: 'phonemic',
      cueText: generatePhonologicalCue(target, features),
      reasoning: 'Escalating to phonemic cue after semantic cue attempt'
    };
  }
  
  // Rule 4: Maximum support
  return {
    cueType: 'full',
    cueText: generateFullCue(target),
    reasoning: 'Maximum support: providing full word'
  };
};

/**
 * Enhanced semantic cue using linguistic features
 */
export const generateSemanticCue = (
  category: string, 
  target: string,
  features?: LinguisticFeatures
): string => {
  // Try cueBank first
  const bankCue = getCueBankText(target, 'semantic');
  if (bankCue) return bankCue;
  // Fine-grained semantic category descriptions
  const categoryHints: Record<string, string[]> = {
    // Animals
    'domestic_animal': [
      "It's a common pet",
      "Many people have this animal at home",
      "It's a friendly companion animal"
    ],
    'flying_animal': [
      "It's an animal that can fly",
      "You might see this in the sky or trees",
      "It has wings and feathers"
    ],
    
    // Food
    'fruit': [
      "It's a type of fruit",
      "It grows on trees or plants",
      "It's sweet and healthy to eat"
    ],
    'baked_good': [
      "It's something baked",
      "You might buy this at a bakery",
      "It's made from dough or batter"
    ],
    
    // Furniture & Objects
    'seating': [
      "It's something you sit on",
      "You'll find this in most rooms",
      "It's a piece of furniture for sitting"
    ],
    'drinking_vessel': [
      "You drink from this",
      "It holds liquids",
      "You might find this in a kitchen"
    ],
    
    // Transportation
    'vehicle': [
      "It's a type of vehicle",
      "People use it to travel",
      "You might see this on the road or street"
    ],
    
    // Body
    'body_part': [
      "It's a part of your body",
      "Everyone has this",
      "You use this every day"
    ],
    
    // Buildings
    'dwelling': [
      "It's a type of building",
      "People live in this",
      "It provides shelter"
    ],
    
    // Electronics
    'communication_device': [
      "It's an electronic device",
      "You use it to communicate",
      "Most people carry this with them"
    ]
  };
  
  // Broad category fallbacks
  const broadCategoryHints: Record<string, string> = {
    animals: "It's a type of animal",
    buildings: "It's a type of building or structure",
    furniture: "It's a piece of furniture",
    kitchenware: "It's something you'd find in the kitchen",
    electronics: "It's an electronic device",
    food: "It's something you can eat",
    transportation: "It's a type of vehicle or transportation",
    body: "It's a part of the body",
  };
  
  // Use fine-grained category if features available
  if (features?.semantic_category) {
    const hints = categoryHints[features.semantic_category];
    if (hints) {
      // Return most specific hint, potentially adjusted by typicality
      return hints[0];
    }
  }
  
  // Fall back to broad category
  return broadCategoryHints[category] || `It's related to ${category}`;
};

/**
 * Enhanced phonemic cue using linguistic features
 */
export const generatePhonologicalCue = (target: string, features?: LinguisticFeatures): string => {
  if (features) {
    const firstSound = features.first_phoneme;
    
    if (features.syllable_count === 1) {
      return `It starts with "${firstSound}" and has one syllable`;
    } else {
      return `It starts with "${firstSound}" and has ${features.syllable_count} syllables`;
    }
  }
  
  // Fallback to simple first letter cue
  const firstLetter = target.charAt(0).toUpperCase();
  return `It starts with the letter "${firstLetter}"`;
};

/**
 * Full word cue (maximum support)
 */
export const generateFullCue = (target: string): string => {
  return `The word is "${target}"`;
};

/**
 * Legacy function for backward compatibility
 * Uses basic cueing without error-pattern adaptation
 */
export const getCueText = (
  cueLevel: number,
  category: string,
  target: string
): string => {
  switch (cueLevel) {
    case 1:
      return generateSemanticCue(category, target);
    case 2:
      return generatePhonologicalCue(target);
    case 3:
      return generateFullCue(target);
    default:
      return '';
  }
};
