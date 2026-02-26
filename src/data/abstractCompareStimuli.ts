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
];

export function getCompareItemsByTier(tier: number): AbstractCompareItem[] {
  return ABSTRACT_COMPARE_ITEMS.filter(item => item.tier === tier);
}
