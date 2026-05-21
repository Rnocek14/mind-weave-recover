/**
 * Semantic Feature Analysis Bank
 * 
 * Structured vocabulary with psycholinguistic features for semantic therapy.
 * Features are categorized by abstractness to enable progressive difficulty.
 */

export type FeatureCategory = 'perceptual' | 'functional' | 'categorical' | 'associative' | 'abstract';

export interface SemanticFeature {
  text: string;
  category: FeatureCategory;
  abstractness: number; // 1 (concrete) to 5 (abstract)
}

export interface SemanticFeatureTrial {
  word: string;
  imageCategory: string; // Maps to photo bank categories
  difficulty: number; // 1-5
  wordFrequency: 'high' | 'medium' | 'low';
  correctFeatures: SemanticFeature[];
  typicalDistractors: SemanticFeature[]; // Common semantic confusions
}

// Feature pool organized by category
export const FEATURE_POOL: Record<FeatureCategory, SemanticFeature[]> = {
  perceptual: [
    { text: 'red', category: 'perceptual', abstractness: 1 },
    { text: 'blue', category: 'perceptual', abstractness: 1 },
    { text: 'green', category: 'perceptual', abstractness: 1 },
    { text: 'yellow', category: 'perceptual', abstractness: 1 },
    { text: 'round', category: 'perceptual', abstractness: 1 },
    { text: 'square', category: 'perceptual', abstractness: 1 },
    { text: 'shiny', category: 'perceptual', abstractness: 2 },
    { text: 'soft', category: 'perceptual', abstractness: 2 },
    { text: 'hard', category: 'perceptual', abstractness: 2 },
    { text: 'smooth', category: 'perceptual', abstractness: 2 },
    { text: 'rough', category: 'perceptual', abstractness: 2 },
    { text: 'large', category: 'perceptual', abstractness: 1 },
    { text: 'small', category: 'perceptual', abstractness: 1 },
    { text: 'heavy', category: 'perceptual', abstractness: 2 },
    { text: 'light', category: 'perceptual', abstractness: 2 },
  ],
  functional: [
    { text: 'you eat it', category: 'functional', abstractness: 2 },
    { text: 'you wear it', category: 'functional', abstractness: 2 },
    { text: 'you drink from it', category: 'functional', abstractness: 2 },
    { text: 'you ride it', category: 'functional', abstractness: 2 },
    { text: 'you sit on it', category: 'functional', abstractness: 2 },
    { text: 'you write with it', category: 'functional', abstractness: 2 },
    { text: 'you read it', category: 'functional', abstractness: 2 },
    { text: 'it tells time', category: 'functional', abstractness: 3 },
    { text: 'it opens things', category: 'functional', abstractness: 3 },
    { text: 'it makes sound', category: 'functional', abstractness: 3 },
    { text: 'you throw it', category: 'functional', abstractness: 2 },
    { text: 'it provides shelter', category: 'functional', abstractness: 3 },
  ],
  categorical: [
    { text: 'fruit', category: 'categorical', abstractness: 2 },
    { text: 'vegetable', category: 'categorical', abstractness: 2 },
    { text: 'animal', category: 'categorical', abstractness: 2 },
    { text: 'bird', category: 'categorical', abstractness: 2 },
    { text: 'clothing', category: 'categorical', abstractness: 2 },
    { text: 'furniture', category: 'categorical', abstractness: 2 },
    { text: 'tool', category: 'categorical', abstractness: 2 },
    { text: 'toy', category: 'categorical', abstractness: 2 },
    { text: 'vehicle', category: 'categorical', abstractness: 2 },
    { text: 'food', category: 'categorical', abstractness: 2 },
    { text: 'living thing', category: 'categorical', abstractness: 3 },
    { text: 'body part', category: 'categorical', abstractness: 2 },
    { text: 'building', category: 'categorical', abstractness: 2 },
    { text: 'container', category: 'categorical', abstractness: 3 },
  ],
  associative: [
    { text: 'grows on trees', category: 'associative', abstractness: 3 },
    { text: 'found in kitchen', category: 'associative', abstractness: 3 },
    { text: 'found outdoors', category: 'associative', abstractness: 3 },
    { text: 'has wheels', category: 'associative', abstractness: 2 },
    { text: 'has legs', category: 'associative', abstractness: 2 },
    { text: 'has wings', category: 'associative', abstractness: 2 },
    { text: 'made of wood', category: 'associative', abstractness: 3 },
    { text: 'made of metal', category: 'associative', abstractness: 3 },
    { text: 'made of fabric', category: 'associative', abstractness: 3 },
    { text: 'used daily', category: 'associative', abstractness: 4 },
    { text: 'expensive', category: 'associative', abstractness: 4 },
    { text: 'common', category: 'associative', abstractness: 4 },
  ],
  abstract: [
    { text: 'healthy', category: 'abstract', abstractness: 4 },
    { text: 'useful', category: 'abstract', abstractness: 4 },
    { text: 'important', category: 'abstract', abstractness: 5 },
    { text: 'natural', category: 'abstract', abstractness: 4 },
    { text: 'comfortable', category: 'abstract', abstractness: 4 },
    { text: 'dangerous', category: 'abstract', abstractness: 4 },
    { text: 'valuable', category: 'abstract', abstractness: 5 },
    { text: 'modern', category: 'abstract', abstractness: 5 },
    { text: 'traditional', category: 'abstract', abstractness: 5 },
  ],
};

// Semantic feature trials organized by difficulty
export const SEMANTIC_TRIALS: SemanticFeatureTrial[] = [
  // Level 1: High-frequency, concrete perceptual features
  {
    word: 'apple',
    imageCategory: 'apple',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'red', category: 'perceptual', abstractness: 1 },
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'fruit', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'yellow', category: 'perceptual', abstractness: 1 },
      { text: 'vegetable', category: 'categorical', abstractness: 2 },
      { text: 'you drink from it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
    ],
  },
  {
    word: 'dog',
    imageCategory: 'dog',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'bird', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'grows on trees', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'car',
    imageCategory: 'car',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'you ride it', category: 'functional', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  {
    word: 'cat',
    imageCategory: 'cat',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'bird', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'ball',
    imageCategory: 'ball',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'toy', category: 'categorical', abstractness: 2 },
      { text: 'you throw it', category: 'functional', abstractness: 2 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'square', category: 'perceptual', abstractness: 1 },
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you sit on it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  {
    word: 'fish',
    imageCategory: 'fish',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'bird', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'shoe',
    imageCategory: 'shoe',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'clothing', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'common', category: 'abstract', abstractness: 4 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'tree',
    imageCategory: 'tree',
    difficulty: 1,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'green', category: 'perceptual', abstractness: 1 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
    ],
  },

  // Level 2: Mix of concrete and functional
  {
    word: 'chair',
    imageCategory: 'chair',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you sit on it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'you ride it', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  {
    word: 'cup',
    imageCategory: 'cup',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'container', category: 'categorical', abstractness: 3 },
      { text: 'you drink from it', category: 'functional', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
  },
  {
    word: 'book',
    imageCategory: 'book',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'you read it', category: 'functional', abstractness: 2 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
      { text: 'useful', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
    ],
  },
  {
    word: 'hat',
    imageCategory: 'hat',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'clothing', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'made of fabric', category: 'associative', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  {
    word: 'spoon',
    imageCategory: 'spoon',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'clothing', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
  },
  {
    word: 'flower',
    imageCategory: 'flower',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'bed',
    imageCategory: 'bed',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'comfortable', category: 'abstract', abstractness: 4 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
    ],
  },
  {
    word: 'lamp',
    imageCategory: 'lamp',
    difficulty: 2,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'useful', category: 'abstract', abstractness: 4 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
    ],
  {
    word: 'shoe',
    imageCategory: 'shoe',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'clothing', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'has laces', category: 'perceptual', abstractness: 2 },
      { text: 'protects feet', category: 'functional', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'food', category: 'categorical', abstractness: 2 },
      { text: 'you drink it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'perceptual', abstractness: 2 },
      { text: 'grows on trees', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'broom',
    imageCategory: 'broom',
    difficulty: 2,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'you sweep with it', category: 'functional', abstractness: 2 },
      { text: 'has a long handle', category: 'perceptual', abstractness: 2 },
      { text: 'used for cleaning', category: 'functional', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'grows in gardens', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'umbrella',
    imageCategory: 'umbrella',
    difficulty: 2,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'keeps you dry', category: 'functional', abstractness: 3 },
      { text: 'has a handle', category: 'perceptual', abstractness: 2 },
      { text: 'used in rain', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'food', category: 'categorical', abstractness: 2 },
      { text: 'you wear on feet', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'perceptual', abstractness: 2 },
      { text: 'lives in water', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'pillow',
    imageCategory: 'pillow',
    difficulty: 2,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'you rest your head on it', category: 'functional', abstractness: 3 },
      { text: 'found on a bed', category: 'associative', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'sharp', category: 'perceptual', abstractness: 2 },
      { text: 'you drive it', category: 'functional', abstractness: 2 },
      { text: 'has feathers', category: 'associative', abstractness: 2 },
    ],
  },
  {
    word: 'mirror',
    imageCategory: 'mirror',
    difficulty: 2,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'object', category: 'categorical', abstractness: 2 },
      { text: 'reflects images', category: 'functional', abstractness: 3 },
      { text: 'made of glass', category: 'perceptual', abstractness: 2 },
      { text: 'found in bathrooms', category: 'associative', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of wood', category: 'perceptual', abstractness: 2 },
      { text: 'grows on trees', category: 'associative', abstractness: 2 },
    ],
  },



  // Level 3: More abstract features
  {
    word: 'key',
    imageCategory: 'key',
    difficulty: 3,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'it opens things', category: 'functional', abstractness: 3 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'important', category: 'abstract', abstractness: 5 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  {
    word: 'bird',
    imageCategory: 'bird',
    difficulty: 3,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'bird', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'star',
    imageCategory: 'star',
    difficulty: 3,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'cake',
    imageCategory: 'cake',
    difficulty: 3,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'food', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you drink from it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'hard', category: 'perceptual', abstractness: 2 },
    ],
  },
  {
    word: 'moon',
    imageCategory: 'moon',
    difficulty: 3,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'ring',
    imageCategory: 'ring',
    difficulty: 3,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'made of fabric', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'leaf',
    imageCategory: 'leaf',
    difficulty: 3,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'green', category: 'perceptual', abstractness: 1 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'grows on trees', category: 'associative', abstractness: 3 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
    ],
  },

  // Level 4: Abstract and associative features dominate
  {
    word: 'watch',
    imageCategory: 'watch',
    difficulty: 4,
    wordFrequency: 'medium',
    correctFeatures: [
      { text: 'it tells time', category: 'functional', abstractness: 3 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'expensive', category: 'associative', abstractness: 4 },
      { text: 'useful', category: 'abstract', abstractness: 4 },
      { text: 'modern', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
      { text: 'grows on trees', category: 'associative', abstractness: 3 },
    ],
  },
  {
    word: 'phone',
    imageCategory: 'phone',
    difficulty: 4,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'tool', category: 'categorical', abstractness: 2 },
      { text: 'it makes sound', category: 'functional', abstractness: 3 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
      { text: 'important', category: 'abstract', abstractness: 5 },
      { text: 'modern', category: 'abstract', abstractness: 5 },
      { text: 'expensive', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'natural', category: 'abstract', abstractness: 4 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  {
    word: 'bike',
    imageCategory: 'bike',
    difficulty: 4,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'you ride it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'healthy', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  {
    word: 'door',
    imageCategory: 'door',
    difficulty: 4,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'it opens things', category: 'functional', abstractness: 3 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'common', category: 'abstract', abstractness: 4 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },

  // Level 5: Highly abstract reasoning required
  {
    word: 'house',
    imageCategory: 'house',
    difficulty: 5,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'building', category: 'categorical', abstractness: 2 },
      { text: 'it provides shelter', category: 'functional', abstractness: 3 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
      { text: 'expensive', category: 'associative', abstractness: 4 },
      { text: 'important', category: 'abstract', abstractness: 5 },
      { text: 'valuable', category: 'abstract', abstractness: 5 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
    ],
  },
  {
    word: 'hand',
    imageCategory: 'hand',
    difficulty: 5,
    wordFrequency: 'high',
    correctFeatures: [
      { text: 'body part', category: 'categorical', abstractness: 2 },
      { text: 'useful', category: 'abstract', abstractness: 4 },
      { text: 'important', category: 'abstract', abstractness: 5 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
    ],
  },

  // === Wave-1 expansion ===
  // Tier 1 add (d=1: 8 → 20)  high-frequency concrete nouns reusing FEATURE_POOL semantics
  { word: 'bird', imageCategory: 'bird', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'furniture', category: 'categorical', abstractness: 2 },
    ],
  },
  { word: 'house', imageCategory: 'house', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'you live in it', category: 'functional', abstractness: 2 },
      { text: 'building', category: 'categorical', abstractness: 2 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'cup', imageCategory: 'cup', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'you drink from it', category: 'functional', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
    ],
  },
  { word: 'book', imageCategory: 'book', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'made of paper', category: 'associative', abstractness: 3 },
      { text: 'you read it', category: 'functional', abstractness: 2 },
      { text: 'rectangle', category: 'perceptual', abstractness: 1 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'you drink it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'sun', imageCategory: 'sun', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'yellow', category: 'perceptual', abstractness: 1 },
      { text: 'hot', category: 'perceptual', abstractness: 2 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'cold', category: 'perceptual', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
    ],
  },
  { word: 'banana', imageCategory: 'banana', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'yellow', category: 'perceptual', abstractness: 1 },
      { text: 'fruit', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
    typicalDistractors: [
      { text: 'vegetable', category: 'categorical', abstractness: 2 },
      { text: 'red', category: 'perceptual', abstractness: 1 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
    ],
  },
  { word: 'bed', imageCategory: 'bed', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you sit on it', category: 'functional', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'spoon', imageCategory: 'spoon', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
    ],
  },
  { word: 'door', imageCategory: 'door', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'rectangle', category: 'perceptual', abstractness: 1 },
      { text: 'made of wood', category: 'associative', abstractness: 3 },
      { text: 'you open it', category: 'functional', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'flower', imageCategory: 'flower', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'green', category: 'perceptual', abstractness: 1 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'vehicle', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'has wheels', category: 'associative', abstractness: 2 },
    ],
  },
  { word: 'hat', imageCategory: 'hat', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'clothing', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'furniture', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'key', imageCategory: 'key', difficulty: 1, wordFrequency: 'high',
    correctFeatures: [
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
    ],
    typicalDistractors: [
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },

  // Tier 3 add (d=4/5: 6 → 20) abstract / lower-frequency / multi-feature
  { word: 'compass', imageCategory: 'compass', difficulty: 4, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for travel', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
  },
  { word: 'telescope', imageCategory: 'telescope', difficulty: 4, wordFrequency: 'low',
    correctFeatures: [
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for travel', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
  },
  { word: 'anchor', imageCategory: 'anchor', difficulty: 4, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
      { text: 'used for travel', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
  { word: 'accordion', imageCategory: 'accordion', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of wood', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for entertainment', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },
  { word: 'stethoscope', imageCategory: 'stethoscope', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for work', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'professional tool', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
  },
  { word: 'microscope', imageCategory: 'microscope', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for work', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'professional tool', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  { word: 'thermometer', imageCategory: 'thermometer', difficulty: 4, wordFrequency: 'low',
    correctFeatures: [
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for work', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },
  { word: 'barometer', imageCategory: 'barometer', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'professional tool', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
  },
  { word: 'lantern', imageCategory: 'lantern', difficulty: 4, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for travel', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  { word: 'kettle', imageCategory: 'kettle', difficulty: 4, wordFrequency: 'medium',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'found in kitchen', category: 'associative', abstractness: 3 },
      { text: 'used daily', category: 'associative', abstractness: 4 },
    ],
    typicalDistractors: [
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'you wear it', category: 'functional', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'has wings', category: 'associative', abstractness: 2 },
    ],
  },
  { word: 'crown', imageCategory: 'crown', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'shiny', category: 'perceptual', abstractness: 2 },
      { text: 'yellow', category: 'perceptual', abstractness: 1 },
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'symbolic', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'large', category: 'perceptual', abstractness: 1 },
    ],
  },
  { word: 'globe', imageCategory: 'globe', difficulty: 4, wordFrequency: 'medium',
    correctFeatures: [
      { text: 'round', category: 'perceptual', abstractness: 1 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'used for travel', category: 'associative', abstractness: 4 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'educational', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'soft', category: 'perceptual', abstractness: 2 },
    ],
  },
  { word: 'sundial', imageCategory: 'sundial', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'made of metal', category: 'associative', abstractness: 3 },
      { text: 'found outdoors', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'ancient', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
      { text: 'common', category: 'abstract', abstractness: 4 },
    ],
  },
  { word: 'hourglass', imageCategory: 'hourglass', difficulty: 5, wordFrequency: 'low',
    correctFeatures: [
      { text: 'small', category: 'perceptual', abstractness: 1 },
      { text: 'made of glass', category: 'associative', abstractness: 3 },
      { text: 'you use it', category: 'functional', abstractness: 2 },
      { text: 'specialized', category: 'abstract', abstractness: 5 },
      { text: 'symbolic', category: 'abstract', abstractness: 5 },
    ],
    typicalDistractors: [
      { text: 'you eat it', category: 'functional', abstractness: 2 },
      { text: 'animal', category: 'categorical', abstractness: 2 },
      { text: 'has legs', category: 'associative', abstractness: 2 },
      { text: 'living thing', category: 'categorical', abstractness: 3 },
    ],
  },
];

/**
 * Get trials for a given difficulty level
 */
export function getTrialsForLevel(level: number, count: number = 10): SemanticFeatureTrial[] {
  const pool = SEMANTIC_TRIALS.filter(t => t.difficulty === level);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get trials filtered by target words (for targeted practice)
 */
export function getTrialsByTargetWords(targetWords: string[], count: number = 10): SemanticFeatureTrial[] {
  const lowerTargets = targetWords.map(w => w.toLowerCase());
  const matchingTrials = SEMANTIC_TRIALS.filter(t => 
    lowerTargets.includes(t.word.toLowerCase())
  );
  
  if (matchingTrials.length === 0) {
    // Fallback to level 1 trials if no matches
    return getTrialsForLevel(1, count);
  }
  
  // Repeat trials if needed to fill count
  const repeated: SemanticFeatureTrial[] = [];
  while (repeated.length < count && repeated.length < matchingTrials.length * 3) {
    repeated.push(...[...matchingTrials].sort(() => Math.random() - 0.5));
  }
  return repeated.slice(0, count);
}

/**
 * Get all unique image categories available in trials
 */
export function getAvailableCategories(): string[] {
  return [...new Set(SEMANTIC_TRIALS.map(t => t.imageCategory))];
}

/**
 * Generate feature options for a trial (correct + distractors)
 */
export function generateFeatureOptions(
  trial: SemanticFeatureTrial,
  difficulty: number
): SemanticFeature[] {
  const featureCount = Math.min(4 + difficulty, trial.correctFeatures.length);
  const distractorCount = Math.min(4 + Math.floor(difficulty / 2), 6);
  
  const correctSubset = trial.correctFeatures.slice(0, featureCount);
  const distractorSubset = trial.typicalDistractors.slice(0, distractorCount);
  
  const allOptions = [...correctSubset, ...distractorSubset];
  return allOptions.sort(() => Math.random() - 0.5);
}

/**
 * Analyze which feature categories user struggles with
 */
export function analyzeFeatureErrors(
  selectedFeatures: SemanticFeature[],
  correctFeatures: SemanticFeature[]
): {
  missedCategories: FeatureCategory[];
  incorrectCategories: FeatureCategory[];
  weakestAbstractness: number;
} {
  const correctIds = new Set(correctFeatures.map(f => f.text));
  const selectedIds = new Set(selectedFeatures.map(f => f.text));
  
  const missed = correctFeatures.filter(f => !selectedIds.has(f.text));
  const incorrect = selectedFeatures.filter(f => !correctIds.has(f.text));
  
  const missedCategories = [...new Set(missed.map(f => f.category))];
  const incorrectCategories = [...new Set(incorrect.map(f => f.category))];
  
  const missedAbstractness = missed.length > 0
    ? Math.max(...missed.map(f => f.abstractness))
    : 1;
  
  return {
    missedCategories,
    incorrectCategories,
    weakestAbstractness: missedAbstractness,
  };
}
