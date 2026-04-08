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
  /** Maps scene indices to narrative sections for structured feedback */
  structureMap: {
    beginning: number[];
    middle: number[];
    end: number[];
  };
}

/** Default structure for all 4-scene stories */
const DEFAULT_STRUCTURE = { beginning: [0], middle: [1, 2], end: [3] };

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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
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
    structureMap: DEFAULT_STRUCTURE,
  },

  // Additional Tier 1
  {
    id: 'grocery-trip',
    title: 'The Grocery Trip',
    scenes: [
      { emoji: '📝', text: 'Dad made a shopping list before going to the store.' },
      { emoji: '🛒', text: 'At the store, he put everything in his cart.' },
      { emoji: '💳', text: 'He paid at the checkout and carried the bags to the car.' },
      { emoji: '😬', text: 'When he got home, he realized he forgot the milk.' },
    ],
    keyEvents: ['made list', 'went to store', 'put in cart', 'paid', 'forgot milk'],
    expectedClauses: 5,
    tier: 1,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'park-walk',
    title: 'A Walk in the Park',
    scenes: [
      { emoji: '🚶', text: 'Jenny decided to take a walk in the park after lunch.' },
      { emoji: '🦆', text: 'She saw some ducks swimming in the pond.' },
      { emoji: '🌧️', text: 'Suddenly it started to drizzle.' },
      { emoji: '☂️', text: 'She opened her umbrella and walked home slowly.' },
    ],
    keyEvents: ['walk after lunch', 'ducks in pond', 'started raining', 'used umbrella', 'walked home'],
    expectedClauses: 5,
    tier: 1,
    structureMap: DEFAULT_STRUCTURE,
  },

  // Additional Tier 2
  {
    id: 'new-job',
    title: 'The New Job',
    scenes: [
      { emoji: '📧', text: 'Carlos got an email saying he got the job he applied for.' },
      { emoji: '😊', text: 'He was nervous but excited on his first day.' },
      { emoji: '🤝', text: 'His new boss introduced him to the team and showed him around.' },
      { emoji: '🎯', text: 'By the end of the week, he felt like he belonged there.' },
    ],
    keyEvents: ['got the job', 'nervous first day', 'boss introduced', 'shown around', 'felt he belonged'],
    expectedClauses: 5,
    tier: 2,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'garden-project',
    title: 'The Garden Project',
    scenes: [
      { emoji: '🌱', text: 'Grandpa wanted to start a small vegetable garden in the backyard.' },
      { emoji: '🛠️', text: 'He built a raised bed and filled it with soil.' },
      { emoji: '🥕', text: 'He planted tomatoes, carrots, and herbs.' },
      { emoji: '🌻', text: 'A few weeks later, the first green sprouts appeared and he was proud.' },
    ],
    keyEvents: ['wanted garden', 'built raised bed', 'planted vegetables', 'sprouts appeared', 'felt proud'],
    expectedClauses: 5,
    tier: 2,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'hospital-visit',
    title: 'Visiting the Hospital',
    scenes: [
      { emoji: '🏥', text: 'Rosa went to visit her friend who was recovering from surgery.' },
      { emoji: '💐', text: 'She brought flowers and a card signed by their whole group.' },
      { emoji: '😊', text: 'Her friend smiled and said it was the best part of her day.' },
      { emoji: '🤗', text: 'They talked for an hour, and Rosa promised to visit again next week.' },
    ],
    keyEvents: ['visited friend', 'recovering from surgery', 'brought flowers and card', 'friend smiled', 'promised to visit again'],
    expectedClauses: 5,
    tier: 2,
    structureMap: DEFAULT_STRUCTURE,
  },

  // Additional Tier 3
  {
    id: 'retirement-gift',
    title: 'The Retirement Gift',
    scenes: [
      { emoji: '👨‍🏫', text: 'Mr. Davis taught at the same school for 35 years and was about to retire.' },
      { emoji: '📦', text: 'On his last day, the students gave him a scrapbook full of letters and drawings.' },
      { emoji: '😢', text: 'He tried to speak but was too moved — his eyes filled with tears.' },
      { emoji: '💬', text: 'He finally said, "You taught me more than I ever taught you."' },
    ],
    keyEvents: ['taught 35 years', 'retiring', 'students gave scrapbook', 'too emotional to speak', 'said they taught him'],
    expectedClauses: 5,
    tier: 3,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'wrong-train',
    title: 'The Wrong Train',
    scenes: [
      { emoji: '🚂', text: 'A tourist was trying to get to the city center but got on the wrong train.' },
      { emoji: '🗺️', text: 'She didn\'t realize until the signs outside looked unfamiliar.' },
      { emoji: '👩‍🦳', text: 'An elderly woman noticed her confusion and helped her find the right platform.' },
      { emoji: '🌆', text: 'She arrived late but grateful — sometimes getting lost leads to kindness.' },
    ],
    keyEvents: ['wrong train', 'unfamiliar signs', 'elderly woman helped', 'found right platform', 'arrived late but grateful'],
    expectedClauses: 5,
    tier: 3,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'power-outage',
    title: 'The Power Outage',
    scenes: [
      { emoji: '⚡', text: 'A big storm knocked out the power in the whole neighborhood.' },
      { emoji: '🕯️', text: 'The family lit candles and gathered in the living room.' },
      { emoji: '🎶', text: 'Instead of watching TV, they told stories and played card games.' },
      { emoji: '💡', text: 'When the power came back, they agreed the evening without screens was more fun.' },
    ],
    keyEvents: ['storm knocked out power', 'lit candles', 'told stories and played games', 'power came back', 'preferred evening without screens'],
    expectedClauses: 5,
    tier: 3,
    structureMap: DEFAULT_STRUCTURE,
  },
];

export function getStoriesByTier(tier: number): NarrativeStory[] {
  return NARRATIVE_STORIES.filter(s => s.tier === tier);
}
