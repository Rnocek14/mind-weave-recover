// Functional phrases for speech rehabilitation
// Focused on daily communication needs (script training & MIT-inspired)

export interface PhraseFeatures {
  syllable_count: number;
  word_count: number;
  contains_pronouns: boolean;
  motor_complexity: 'simple' | 'moderate' | 'complex';
  frequency_rank: number; // 1-10000 (lower = more common)
  emotional_valence: 'neutral' | 'positive' | 'negative';
  social_context: 'caregiver' | 'medical' | 'self_care' | 'social' | 'emergency';
}

export interface PhraseTrial {
  id: string;
  phrase: string;
  category: 'daily_needs' | 'social' | 'medical' | 'emotional';
  difficulty: number; // 1-5
  imageUrl?: string; // Optional visual support
  features: PhraseFeatures;
  semanticAlternatives?: string[]; // Related phrases
  cueWords?: string[]; // Key words for semantic cueing
}

export const PHRASE_BANK: PhraseTrial[] = [
  // LEVEL 1: Simple daily needs (2-3 words, high frequency, simple motor)
  {
    id: 'need_help',
    phrase: "I need help",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 50,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['help', 'need'],
    semanticAlternatives: ["Help me", "I need assistance"]
  },
  {
    id: 'im_thirsty',
    phrase: "I'm thirsty",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 200,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['thirsty', 'water'],
    semanticAlternatives: ["I want water", "Water please"]
  },
  {
    id: 'im_tired',
    phrase: "I'm tired",
    category: 'emotional',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 150,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['tired', 'rest'],
    semanticAlternatives: ["I need rest", "I'm exhausted"]
  },
  {
    id: 'thank_you',
    phrase: "Thank you",
    category: 'social',
    difficulty: 1,
    features: {
      syllable_count: 2,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'simple',
      frequency_rank: 20,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['thank', 'thanks'],
    semanticAlternatives: ["Thanks", "Thanks so much"]
  },
  {
    id: 'im_hungry',
    phrase: "I'm hungry",
    category: 'daily_needs',
    difficulty: 1,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 180,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['hungry', 'food'],
    semanticAlternatives: ["I want food", "I need to eat"]
  },

  // LEVEL 2: Common requests (3-4 words, moderate frequency)
  {
    id: 'need_bathroom',
    phrase: "I need the bathroom",
    category: 'daily_needs',
    difficulty: 2,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 300,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['bathroom', 'need'],
    semanticAlternatives: ["I need to go", "Bathroom please"]
  },
  {
    id: 'in_pain',
    phrase: "I'm in pain",
    category: 'medical',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 250,
      emotional_valence: 'negative',
      social_context: 'medical'
    },
    cueWords: ['pain', 'hurt'],
    semanticAlternatives: ["It hurts", "I hurt"]
  },
  {
    id: 'good_morning',
    phrase: "Good morning",
    category: 'social',
    difficulty: 2,
    features: {
      syllable_count: 3,
      word_count: 2,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 100,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['morning', 'hello'],
    semanticAlternatives: ["Hello", "Hi there"]
  },
  {
    id: 'need_medicine',
    phrase: "I need my medicine",
    category: 'medical',
    difficulty: 2,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 400,
      emotional_valence: 'neutral',
      social_context: 'medical'
    },
    cueWords: ['medicine', 'pills'],
    semanticAlternatives: ["I need pills", "Time for medicine"]
  },
  {
    id: 'feel_better',
    phrase: "I feel better",
    category: 'emotional',
    difficulty: 2,
    features: {
      syllable_count: 4,
      word_count: 3,
      contains_pronouns: true,
      motor_complexity: 'simple',
      frequency_rank: 200,
      emotional_valence: 'positive',
      social_context: 'caregiver'
    },
    cueWords: ['better', 'feel'],
    semanticAlternatives: ["I'm better", "Feeling good"]
  },

  // LEVEL 3: Longer functional phrases (4-5 words)
  {
    id: 'call_doctor',
    phrase: "Please call the doctor",
    category: 'medical',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 500,
      emotional_valence: 'neutral',
      social_context: 'emergency'
    },
    cueWords: ['doctor', 'call'],
    semanticAlternatives: ["Call my doctor", "I need the doctor"]
  },
  {
    id: 'want_sit_down',
    phrase: "I want to sit down",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 350,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['sit', 'down'],
    semanticAlternatives: ["Let me sit", "Need to sit"]
  },
  {
    id: 'whats_time',
    phrase: "What time is it",
    category: 'social',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 300,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['time', 'what'],
    semanticAlternatives: ["What's the time", "Tell me the time"]
  },
  {
    id: 'turn_tv',
    phrase: "Turn on the TV",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 5,
      word_count: 4,
      contains_pronouns: false,
      motor_complexity: 'moderate',
      frequency_rank: 450,
      emotional_valence: 'neutral',
      social_context: 'self_care'
    },
    cueWords: ['TV', 'turn'],
    semanticAlternatives: ["TV on please", "I want TV"]
  },
  {
    id: 'need_blanket',
    phrase: "I need a blanket",
    category: 'daily_needs',
    difficulty: 3,
    features: {
      syllable_count: 6,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'moderate',
      frequency_rank: 600,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['blanket', 'cold'],
    semanticAlternatives: ["I'm cold", "Blanket please"]
  },

  // LEVEL 4: Complex functional phrases (5-6 words, harder motor planning)
  {
    id: 'help_stand_up',
    phrase: "Can you help me stand up",
    category: 'daily_needs',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 700,
      emotional_valence: 'neutral',
      social_context: 'caregiver'
    },
    cueWords: ['help', 'stand'],
    semanticAlternatives: ["Help me up", "I need to stand"]
  },
  {
    id: 'feeling_dizzy',
    phrase: "I'm feeling very dizzy",
    category: 'medical',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 4,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 800,
      emotional_valence: 'negative',
      social_context: 'emergency'
    },
    cueWords: ['dizzy', 'feeling'],
    semanticAlternatives: ["I feel dizzy", "Very dizzy"]
  },
  {
    id: 'talk_family',
    phrase: "I want to talk to my family",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 600,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['family', 'talk'],
    semanticAlternatives: ["Call my family", "Family please"]
  },
  {
    id: 'dont_understand',
    phrase: "I don't understand what you said",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 9,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 500,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['understand', "don't"],
    semanticAlternatives: ["I'm confused", "Say that again"]
  },
  {
    id: 'thanks_help',
    phrase: "Thank you for helping me",
    category: 'social',
    difficulty: 4,
    features: {
      syllable_count: 7,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 400,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['thank', 'help'],
    semanticAlternatives: ["Thanks for the help", "Appreciate it"]
  },

  // LEVEL 5: Complex social/emotional phrases (harder motor planning, abstract concepts)
  {
    id: 'worried_about',
    phrase: "I'm worried about my recovery",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 9,
      word_count: 5,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 900,
      emotional_valence: 'negative',
      social_context: 'medical'
    },
    cueWords: ['worried', 'recovery'],
    semanticAlternatives: ["I'm anxious", "Concerned about progress"]
  },
  {
    id: 'proud_progress',
    phrase: "I'm proud of my progress today",
    category: 'emotional',
    difficulty: 5,
    features: {
      syllable_count: 8,
      word_count: 6,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 850,
      emotional_valence: 'positive',
      social_context: 'social'
    },
    cueWords: ['proud', 'progress'],
    semanticAlternatives: ["Feeling good today", "Making progress"]
  },
  {
    id: 'need_talk',
    phrase: "I need to talk about something important",
    category: 'social',
    difficulty: 5,
    features: {
      syllable_count: 11,
      word_count: 7,
      contains_pronouns: true,
      motor_complexity: 'complex',
      frequency_rank: 950,
      emotional_valence: 'neutral',
      social_context: 'social'
    },
    cueWords: ['talk', 'important'],
    semanticAlternatives: ["Need to discuss", "Important conversation"]
  }
];

// Get phrases for a specific difficulty level
export function getPhrasesForLevel(level: number, count: number = 10): PhraseTrial[] {
  const levelPhrases = PHRASE_BANK.filter(p => p.difficulty === level);
  
  // Shuffle and return requested count
  const shuffled = [...levelPhrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get mixed phrases across difficulty range
export function getTrialsForLevel(difficultyLevel: number, totalTrials: number): PhraseTrial[] {
  // For level N, include phrases from level N-1, N, and N+1 (if they exist)
  const minDiff = Math.max(1, difficultyLevel - 1);
  const maxDiff = Math.min(5, difficultyLevel + 1);
  
  const availablePhrases = PHRASE_BANK.filter(
    p => p.difficulty >= minDiff && p.difficulty <= maxDiff
  );
  
  const shuffled = [...availablePhrases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(totalTrials, shuffled.length));
}

// Generate semantic alternatives (no multiple choice for phrases, but useful for partial credit)
export function getPhraseAlternatives(phrase: PhraseTrial): string[] {
  return phrase.semanticAlternatives || [phrase.phrase];
}

// Check if spoken phrase matches target (allows for minor variations)
export function evaluatePhraseMatch(spoken: string, target: PhraseTrial): {
  match: boolean;
  wordAccuracy: number;
  matchedWords: string[];
} {
  const spokenWords = spoken.toLowerCase().trim().split(/\s+/);
  const targetWords = target.phrase.toLowerCase().split(/\s+/);
  
  let matchedCount = 0;
  const matched: string[] = [];
  
  for (const targetWord of targetWords) {
    // Check if any spoken word closely matches this target word
    const found = spokenWords.some(sw => {
      const similarity = getWordSimilarity(sw, targetWord);
      return similarity > 0.7; // Allow minor variations
    });
    
    if (found) {
      matchedCount++;
      matched.push(targetWord);
    }
  }
  
  const wordAccuracy = targetWords.length > 0 ? matchedCount / targetWords.length : 0;
  
  // Consider it a match if 80%+ of words are correct
  return {
    match: wordAccuracy >= 0.8,
    wordAccuracy,
    matchedWords: matched
  };
}

// Simple word similarity using Levenshtein-like approach
function getWordSimilarity(word1: string, word2: string): number {
  const longer = word1.length > word2.length ? word1 : word2;
  const shorter = word1.length > word2.length ? word2 : word1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
