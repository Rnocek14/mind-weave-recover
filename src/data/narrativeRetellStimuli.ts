/**
 * Narrative Retell Stimuli
 * 
 * Short storyboards (4-image sequences described as text scenes)
 * for discourse organization assessment.
 * Each story has key events the user should cover in their retell.
 */

export interface NarrativeStory {
  id: string;
  title: string;
  /** 4 scene descriptions (shown as cards with emoji illustrations) */
  scenes: Array<{
    emoji: string;
    text: string;
  }>;
  /** Key events the retell should cover (scored as eventCoverage) */
  keyEvents: string[];
  /** Expected approximate retell length (for coherence baseline) */
  expectedClauses: number;
  tier: 1 | 2 | 3;
}

export const NARRATIVE_STORIES: NarrativeStory[] = [
  // Tier 1 — Simple, concrete, short sequences
  {
    id: 'morning-coffee',
    title: 'Morning Coffee',
    scenes: [
      { emoji: '⏰', text: 'Maria woke up early and felt tired.' },
      { emoji: '☕', text: 'She went to the kitchen and made coffee.' },
      { emoji: '🐱', text: 'Her cat knocked the cup off the table.' },
      { emoji: '😅', text: 'She cleaned up the mess and made another cup.' },
    ],
    keyEvents: ['woke up', 'made coffee', 'cat knocked cup', 'cleaned up', 'made another'],
    expectedClauses: 5,
    tier: 1,
  },
  {
    id: 'lost-keys',
    title: 'The Lost Keys',
    scenes: [
      { emoji: '🔑', text: 'Tom was leaving for work but couldn\'t find his keys.' },
      { emoji: '🔍', text: 'He looked everywhere — under cushions, in his coat.' },
      { emoji: '🐕', text: 'His dog was sitting on the mat, wagging its tail.' },
      { emoji: '😂', text: 'The keys were under the dog the whole time.' },
    ],
    keyEvents: ['couldn\'t find keys', 'looked everywhere', 'dog sitting on mat', 'keys under dog'],
    expectedClauses: 4,
    tier: 1,
  },
  {
    id: 'rainy-picnic',
    title: 'The Rainy Picnic',
    scenes: [
      { emoji: '🧺', text: 'The family packed a big basket for a picnic in the park.' },
      { emoji: '🌧️', text: 'When they arrived, it started to rain heavily.' },
      { emoji: '🏠', text: 'They ran back to the car and drove home.' },
      { emoji: '🎉', text: 'They had the picnic on the living room floor instead.' },
    ],
    keyEvents: ['packed picnic', 'started raining', 'ran to car', 'picnic inside'],
    expectedClauses: 4,
    tier: 1,
  },
  // Tier 2 — More characters, cause-effect, emotions
  {
    id: 'birthday-surprise',
    title: 'Birthday Surprise',
    scenes: [
      { emoji: '🎂', text: 'Sarah thought everyone forgot her birthday.' },
      { emoji: '😢', text: 'She went to work feeling sad and quiet all day.' },
      { emoji: '🏡', text: 'When she came home, all the lights were off.' },
      { emoji: '🎉', text: 'Her friends jumped out and yelled "Surprise!" — they had planned a party.' },
    ],
    keyEvents: ['thought forgotten', 'felt sad', 'lights off', 'surprise party', 'friends planned'],
    expectedClauses: 5,
    tier: 2,
  },
  {
    id: 'broken-bike',
    title: 'The Broken Bike',
    scenes: [
      { emoji: '🚲', text: 'A boy was riding his bike fast down a hill.' },
      { emoji: '💥', text: 'He hit a rock and the front wheel bent.' },
      { emoji: '👨‍🔧', text: 'A neighbor saw what happened and offered to help fix it.' },
      { emoji: '🤝', text: 'Together they fixed the wheel, and the boy learned to be more careful.' },
    ],
    keyEvents: ['riding fast', 'hit rock', 'wheel bent', 'neighbor helped', 'fixed together', 'learned careful'],
    expectedClauses: 6,
    tier: 2,
  },
  {
    id: 'library-mix-up',
    title: 'The Library Mix-Up',
    scenes: [
      { emoji: '📚', text: 'Emma borrowed a book from the library but grabbed the wrong one by mistake.' },
      { emoji: '📖', text: 'She started reading it at home and actually loved it — it was about space.' },
      { emoji: '🔄', text: 'She went back to return it and get the book she originally wanted.' },
      { emoji: '✨', text: 'The librarian smiled and said, "Sometimes mistakes lead to discoveries."' },
    ],
    keyEvents: ['wrong book', 'loved it', 'about space', 'went back', 'mistakes discoveries'],
    expectedClauses: 5,
    tier: 2,
  },
  // Tier 3 — Abstract elements, inference required
  {
    id: 'two-neighbors',
    title: 'Two Neighbors',
    scenes: [
      { emoji: '🏘️', text: 'Two neighbors had argued for years over a fence between their yards.' },
      { emoji: '🌳', text: 'One winter, a big storm knocked down a tree onto both their houses.' },
      { emoji: '🤝', text: 'They had to work together to clear the damage and fix the roof.' },
      { emoji: '☕', text: 'After that, they became friends and took down the fence.' },
    ],
    keyEvents: ['argued over fence', 'storm knocked tree', 'worked together', 'became friends', 'took down fence'],
    expectedClauses: 5,
    tier: 3,
  },
  {
    id: 'old-photograph',
    title: 'The Old Photograph',
    scenes: [
      { emoji: '📦', text: 'While cleaning the attic, a woman found a box of old photographs.' },
      { emoji: '📸', text: 'One photo showed her grandmother as a young girl, standing in front of a house.' },
      { emoji: '🏚️', text: 'She recognized the house — it was the same one she lived in now.' },
      { emoji: '💭', text: 'She realized her family had lived in that house for three generations.' },
    ],
    keyEvents: ['found photographs', 'grandmother young', 'same house', 'three generations', 'realized connection'],
    expectedClauses: 5,
    tier: 3,
  },
];

export function getStoriesByTier(tier: number): NarrativeStory[] {
  return NARRATIVE_STORIES.filter(s => s.tier === tier);
}
