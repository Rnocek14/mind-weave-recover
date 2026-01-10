/**
 * Topic Word Banks
 * 
 * Organized vocabulary by topic for the Assistive Panel.
 * Words are curated for stroke recovery - common, high-frequency,
 * personally relevant words that build confidence.
 */

export const TOPIC_WORD_BANKS: Record<string, string[]> = {
  // Food & Eating
  food: [
    'eggs', 'toast', 'coffee', 'tea', 'bread', 'butter', 'milk', 'juice',
    'cereal', 'fruit', 'bacon', 'pancakes', 'cheese', 'yogurt', 'oatmeal',
    'lunch', 'dinner', 'snack', 'water', 'sugar'
  ],
  
  // Morning Routine
  morning: [
    'coffee', 'shower', 'breakfast', 'news', 'walk', 'exercise', 'dressed',
    'pills', 'brush', 'teeth', 'shave', 'stretch', 'paper', 'quiet', 'early'
  ],
  
  // Family
  family: [
    'wife', 'husband', 'daughter', 'son', 'grandkids', 'sister', 'brother',
    'mom', 'dad', 'friend', 'neighbor', 'kids', 'baby', 'dog', 'cat'
  ],
  
  // Activities
  activities: [
    'walk', 'read', 'TV', 'garden', 'cook', 'shop', 'visit', 'drive',
    'church', 'lunch', 'nap', 'call', 'game', 'music', 'outside'
  ],
  
  // Places
  places: [
    'home', 'store', 'church', 'hospital', 'park', 'mall', 'restaurant',
    'bank', 'doctor', 'pharmacy', 'library', 'gym', 'beach', 'downtown'
  ],
  
  // Weather & Time
  weather: [
    'sunny', 'rain', 'cold', 'hot', 'nice', 'cloudy', 'wind', 'snow',
    'today', 'yesterday', 'morning', 'night', 'weekend', 'week', 'soon'
  ],
  
  // Feelings
  feelings: [
    'good', 'tired', 'happy', 'okay', 'better', 'hungry', 'full',
    'sore', 'fine', 'busy', 'relaxed', 'bored', 'excited', 'sleepy'
  ],
  
  // Default/Generic
  general: [
    'yes', 'no', 'maybe', 'good', 'nice', 'like', 'want', 'need',
    'more', 'done', 'okay', 'thanks', 'please', 'help', 'again'
  ],
};

// Sentence frames organized by topic
export const SENTENCE_FRAMES: Record<string, string[]> = {
  food: [
    'I had ___.',
    'I like ___.',
    'I ate ___.',
    'I made ___.',
    'It was ___.',
  ],
  
  morning: [
    'I woke up ___.',
    'This morning I ___.',
    'I felt ___.',
    'First I ___.',
    'Then I ___.',
  ],
  
  family: [
    'My ___ called.',
    'I saw my ___.',
    '___ came over.',
    'We talked about ___.',
    '___ is doing well.',
  ],
  
  activities: [
    'I went to ___.',
    'I did ___.',
    'I watched ___.',
    'I like to ___.',
    'We went ___.',
  ],
  
  general: [
    'I want ___.',
    'I need ___.',
    'I like ___.',
    'It was ___.',
    'I feel ___.',
  ],
};

// Cue progressions for each difficulty level
export interface CueLevel {
  level: number;
  name: string;
  description: string;
}

export const CUE_LADDER: CueLevel[] = [
  { level: 0, name: 'Think', description: 'Take your time' },
  { level: 1, name: 'Category', description: 'It\'s a food/person/place' },
  { level: 2, name: 'Semantic', description: 'You eat it for breakfast' },
  { level: 3, name: 'First Sound', description: 'It starts with "t..."' },
  { level: 4, name: 'Show Word', description: 'The word is "toast"' },
];

/**
 * Get words for a topic, excluding recently used words
 */
export function getWordsForTopic(
  topic: string | null,
  exclude: string[] = [],
  limit: number = 6
): string[] {
  const topicKey = topic?.toLowerCase() || 'general';
  const bank = TOPIC_WORD_BANKS[topicKey] || TOPIC_WORD_BANKS.general;
  
  const available = bank.filter(w => !exclude.includes(w.toLowerCase()));
  
  // Shuffle and return limited set
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

/**
 * Get sentence frames for a topic
 */
export function getFramesForTopic(
  topic: string | null,
  limit: number = 3
): string[] {
  const topicKey = topic?.toLowerCase() || 'general';
  const frames = SENTENCE_FRAMES[topicKey] || SENTENCE_FRAMES.general;
  
  const shuffled = [...frames].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

/**
 * Detect topic from user's words (for dynamic word bank updates)
 */
export function detectTopicFromWords(words: string[]): string | null {
  const lowerWords = words.map(w => w.toLowerCase());
  
  // Check each topic bank for matches
  for (const [topic, bank] of Object.entries(TOPIC_WORD_BANKS)) {
    if (topic === 'general') continue;
    
    const matches = bank.filter(w => lowerWords.includes(w.toLowerCase()));
    if (matches.length >= 2) {
      return topic;
    }
  }
  
  return null;
}

/**
 * Get related words based on a seed word
 */
export function getRelatedWords(seedWord: string, limit: number = 4): string[] {
  const lower = seedWord.toLowerCase();
  
  // Find which topic this word belongs to
  for (const [topic, bank] of Object.entries(TOPIC_WORD_BANKS)) {
    if (bank.includes(lower)) {
      return bank.filter(w => w !== lower).slice(0, limit);
    }
  }
  
  return TOPIC_WORD_BANKS.general.slice(0, limit);
}

/**
 * Get warmup words - easy, high-frequency words for session start
 */
export function getWarmupWords(): string[] {
  return ['coffee', 'toast', 'eggs', 'morning', 'good', 'yes'];
}
