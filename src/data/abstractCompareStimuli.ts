/**
 * Abstract Comparison Stimuli
 * 
 * "How are X and Y similar?" prompts ranging from concrete to abstract.
 * Each item has expected key properties for scoring.
 */

export interface AbstractCompareItem {
  id: string;
  wordA: string;
  wordB: string;
  /** Key shared properties a good answer should mention */
  keyProperties: string[];
  /** How abstract the comparison is (affects scoring weight) */
  abstractionLevel: 'concrete' | 'moderate' | 'abstract';
  tier: 1 | 2 | 3;
}

export const ABSTRACT_COMPARE_ITEMS: AbstractCompareItem[] = [
  // Tier 1 — Concrete, obvious similarities
  { id: 'ac-01', wordA: 'Dog', wordB: 'Cat', keyProperties: ['animal', 'pet', 'four legs', 'fur', 'tail'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-02', wordA: 'Apple', wordB: 'Orange', keyProperties: ['fruit', 'round', 'food', 'grow on trees', 'healthy'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-03', wordA: 'Car', wordB: 'Bus', keyProperties: ['vehicle', 'wheels', 'transport', 'drive', 'road'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-04', wordA: 'Table', wordB: 'Chair', keyProperties: ['furniture', 'legs', 'wood', 'house', 'sit'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-05', wordA: 'Pen', wordB: 'Pencil', keyProperties: ['write', 'tool', 'hold', 'paper', 'school'], abstractionLevel: 'concrete', tier: 1 },

  // Tier 2 — Moderate abstraction, cross-category
  { id: 'ac-06', wordA: 'Book', wordB: 'Movie', keyProperties: ['story', 'entertainment', 'characters', 'beginning end', 'learn'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-07', wordA: 'Eye', wordB: 'Camera', keyProperties: ['see', 'image', 'focus', 'capture', 'light', 'lens'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-08', wordA: 'Brain', wordB: 'Computer', keyProperties: ['process', 'memory', 'information', 'solve', 'store'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-09', wordA: 'Seed', wordB: 'Egg', keyProperties: ['beginning', 'grow', 'life', 'small', 'develop', 'potential'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-10', wordA: 'Map', wordB: 'Menu', keyProperties: ['guide', 'choices', 'navigate', 'find', 'options', 'information'], abstractionLevel: 'moderate', tier: 2 },

  // Tier 3 — Abstract, metaphorical
  { id: 'ac-11', wordA: 'River', wordB: 'Time', keyProperties: ['flow', 'direction', 'continuous', 'can\'t stop', 'change', 'moves forward'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-12', wordA: 'Hammer', wordB: 'Keyboard', keyProperties: ['tool', 'hit', 'press', 'create', 'build', 'force', 'fingers'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-13', wordA: 'Winter', wordB: 'Old age', keyProperties: ['end', 'slow', 'cold', 'rest', 'quiet', 'final stage'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-14', wordA: 'Bridge', wordB: 'Translator', keyProperties: ['connect', 'between', 'gap', 'help cross', 'link', 'communicate'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-15', wordA: 'Mirror', wordB: 'Photograph', keyProperties: ['reflection', 'image', 'appearance', 'capture', 'see yourself', 'truth'], abstractionLevel: 'abstract', tier: 3 },

  // === Tier 1 expansion (concrete) ===
  { id: 'ac-16', wordA: 'Shoe', wordB: 'Sock', keyProperties: ['feet', 'wear', 'pair', 'clothing', 'foot'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-17', wordA: 'Knife', wordB: 'Fork', keyProperties: ['utensil', 'metal', 'eating', 'kitchen', 'hold', 'meal'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-18', wordA: 'Bicycle', wordB: 'Motorcycle', keyProperties: ['two wheels', 'transport', 'ride', 'handlebars', 'vehicle'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-19', wordA: 'Lion', wordB: 'Tiger', keyProperties: ['big cat', 'wild', 'predator', 'fur', 'hunt', 'animal'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-20', wordA: 'Shirt', wordB: 'Jacket', keyProperties: ['clothing', 'upper body', 'wear', 'sleeves', 'cover'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-21', wordA: 'Banana', wordB: 'Lemon', keyProperties: ['fruit', 'yellow', 'food', 'peel', 'tropical'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-22', wordA: 'Pillow', wordB: 'Blanket', keyProperties: ['bed', 'soft', 'sleep', 'comfort', 'bedroom'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-23', wordA: 'Spoon', wordB: 'Ladle', keyProperties: ['utensil', 'scoop', 'kitchen', 'liquid', 'serve', 'handle'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-24', wordA: 'Cup', wordB: 'Bowl', keyProperties: ['dish', 'hold food', 'kitchen', 'open top', 'ceramic'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-25', wordA: 'Window', wordB: 'Door', keyProperties: ['opening', 'house', 'wall', 'frame', 'open close'], abstractionLevel: 'concrete', tier: 1 },
  { id: 'ac-26', wordA: 'Pencil', wordB: 'Crayon', keyProperties: ['draw', 'write', 'color', 'art', 'hold', 'point'], abstractionLevel: 'concrete', tier: 1 },

  // === Tier 2 expansion (moderate) ===
  { id: 'ac-27', wordA: 'Heart', wordB: 'Pump', keyProperties: ['move fluid', 'force', 'cycle', 'pressure', 'circulate'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-28', wordA: 'School', wordB: 'Hospital', keyProperties: ['institution', 'help people', 'professionals', 'building', 'serve community'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-29', wordA: 'Letter', wordB: 'Email', keyProperties: ['message', 'communication', 'words', 'send', 'receive', 'address'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-30', wordA: 'Painting', wordB: 'Song', keyProperties: ['art', 'expression', 'created', 'experience', 'feeling', 'creative'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-31', wordA: 'Lock', wordB: 'Password', keyProperties: ['security', 'access', 'protect', 'open', 'private', 'permission'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-32', wordA: 'Library', wordB: 'Internet', keyProperties: ['information', 'search', 'knowledge', 'access', 'learn', 'resources'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-33', wordA: 'Recipe', wordB: 'Blueprint', keyProperties: ['instructions', 'plan', 'steps', 'create something', 'guide', 'follow'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-34', wordA: 'Teacher', wordB: 'Coach', keyProperties: ['guide', 'teach', 'improve', 'mentor', 'help learn', 'feedback'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-35', wordA: 'Wallet', wordB: 'Bank', keyProperties: ['hold money', 'store value', 'access cash', 'protect money', 'transactions'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-36', wordA: 'Ladder', wordB: 'Staircase', keyProperties: ['climb up', 'reach height', 'steps', 'ascend', 'access higher'], abstractionLevel: 'moderate', tier: 2 },
  { id: 'ac-37', wordA: 'Dictionary', wordB: 'Map', keyProperties: ['reference', 'lookup', 'find', 'organized', 'guide', 'information'], abstractionLevel: 'moderate', tier: 2 },

  // === Tier 3 expansion (abstract) ===
  { id: 'ac-38', wordA: 'Friendship', wordB: 'Plant', keyProperties: ['needs care', 'grows', 'time', 'nurture', 'living', 'can die'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-39', wordA: 'Mind', wordB: 'Garden', keyProperties: ['cultivate', 'grow', 'tend', 'weed out', 'fertile', 'develop'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-40', wordA: 'Word', wordB: 'Seed', keyProperties: ['small beginning', 'grow', 'plant', 'spread', 'idea', 'potential'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-41', wordA: 'Anger', wordB: 'Fire', keyProperties: ['burns', 'spreads', 'destroys', 'heat', 'consume', 'out of control'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-42', wordA: 'Hope', wordB: 'Light', keyProperties: ['guides', 'darkness', 'shines', 'forward', 'illuminate', 'comfort'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-43', wordA: 'Lie', wordB: 'Crack', keyProperties: ['weakens', 'spreads', 'breaks trust', 'splits', 'damage', 'foundation'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-44', wordA: 'Music', wordB: 'Language', keyProperties: ['communicate', 'expression', 'rhythm', 'meaning', 'shared', 'cultural'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-45', wordA: 'Memory', wordB: 'Photograph', keyProperties: ['capture moment', 'past', 'preserve', 'fade', 'recall', 'snapshot'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-46', wordA: 'Teacher', wordB: 'Lighthouse', keyProperties: ['guide', 'safe passage', 'beacon', 'show way', 'steady', 'help others'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-47', wordA: 'Idea', wordB: 'Spark', keyProperties: ['ignite', 'start', 'small but powerful', 'lead to fire', 'beginning', 'energy'], abstractionLevel: 'abstract', tier: 3 },
  { id: 'ac-48', wordA: 'Mistake', wordB: 'Lesson', keyProperties: ['learn', 'experience', 'growth', 'teach you something', 'past', 'improve'], abstractionLevel: 'abstract', tier: 3 },
];

export function getCompareItemsByTier(tier: number): AbstractCompareItem[] {
  return ABSTRACT_COMPARE_ITEMS.filter(item => item.tier === tier);
}
