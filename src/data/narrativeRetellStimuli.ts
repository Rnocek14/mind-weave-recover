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
  // Tier 1 — Simple, concrete, short sequences.
  // Spec: ≤35 words across 4 short scenes, one sentence per scene.
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
      { emoji: '🔑', text: 'Tom couldn\'t find his keys before work.' },
      { emoji: '🔍', text: 'He looked under cushions and in his coat.' },
      { emoji: '🐕', text: 'His dog sat on the mat, wagging its tail.' },
      { emoji: '😂', text: 'The keys were under the dog.' },
    ],
    keyEvents: ['couldn\'t find keys', 'looked everywhere', 'dog on mat', 'keys under dog'],
    expectedClauses: 4,
    tier: 1,
    structureMap: DEFAULT_STRUCTURE,
  },
  {
    id: 'rainy-picnic',
    title: 'The Rainy Picnic',
    scenes: [
      { emoji: '🧺', text: 'The family packed a basket for a picnic.' },
      { emoji: '🌧️', text: 'When they arrived, it started raining hard.' },
      { emoji: '🏠', text: 'They ran back to the car and drove home.' },
      { emoji: '🎉', text: 'They had the picnic on the living room floor.' },
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
    tier: 2,
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
  // === Tier 1 expansion ===
  { id: 'lost-cat', title: 'The Lost Cat', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '🐈', text: 'A girl noticed her cat was missing from the house.' },
      { emoji: '🔦', text: 'She searched the yard with a flashlight, calling its name.' },
      { emoji: '🌳', text: 'She found the cat stuck up in a tall tree, scared.' },
      { emoji: '🤗', text: 'A neighbor helped get it down with a ladder, and she hugged it tight.' },
    ],
    keyEvents: ['cat missing', 'searched with flashlight', 'stuck in tree', 'neighbor helped', 'hugged cat'],
  },
  { id: 'school-bus', title: 'Missing the School Bus', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '⏰', text: 'A boy slept through his alarm.' },
      { emoji: '🏃', text: 'He ran outside but the bus was leaving.' },
      { emoji: '🚗', text: 'His mom drove him to school.' },
      { emoji: '😅', text: 'He set two alarms for next time.' },
    ],
    keyEvents: ['slept through alarm', 'missed bus', 'mom drove him', 'promised two alarms'],
  },
  { id: 'broken-glass', title: 'The Broken Glass', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '🥛', text: 'Anna was carrying a glass of juice.' },
      { emoji: '💥', text: 'She tripped on a toy and the glass broke.' },
      { emoji: '🧹', text: 'She swept up the pieces with a broom.' },
      { emoji: '😊', text: 'Her dad helped her pour a new glass.' },
    ],
    keyEvents: ['carrying juice', 'tripped and broke glass', 'swept it up', 'dad helped'],
  },
  { id: 'pizza-night', title: 'Pizza Night', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '🍕', text: 'The family decided to order pizza for dinner.' },
      { emoji: '📞', text: 'Dad called the pizza place and ordered two pizzas.' },
      { emoji: '🚪', text: 'When the doorbell rang, the kids cheered.' },
      { emoji: '😋', text: 'They ate together watching a movie on the couch.' },
    ],
    keyEvents: ['decided pizza', 'dad ordered', 'doorbell rang', 'ate watching movie'],
  },
  { id: 'flat-tire', title: 'Flat Tire', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '🚗', text: 'Mark was driving home from work.' },
      { emoji: '💨', text: 'Suddenly he heard a loud pop and the car wobbled.' },
      { emoji: '🛞', text: 'He pulled over and saw a flat tire.' },
      { emoji: '🔧', text: 'He called a tow truck to help him get home.' },
    ],
    keyEvents: ['driving home', 'loud pop', 'flat tire', 'called tow truck'],
  },
  { id: 'first-snow', title: 'The First Snow', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '🌨️', text: 'The kids woke up to see snow covering everything outside.' },
      { emoji: '🧤', text: 'They put on coats, gloves, and warm hats.' },
      { emoji: '⛄', text: 'They built a snowman with stones for eyes and a carrot nose.' },
      { emoji: '☕', text: 'They came inside for hot cocoa.' },
    ],
    keyEvents: ['woke to snow', 'put on warm clothes', 'built snowman', 'hot cocoa inside'],
  },
  { id: 'haircut', title: 'A New Haircut', tier: 1, structureMap: DEFAULT_STRUCTURE, expectedClauses: 4,
    scenes: [
      { emoji: '💇', text: 'Lisa thought her hair was too long.' },
      { emoji: '✂️', text: 'She went to the salon and got it cut short.' },
      { emoji: '😊', text: 'Lisa smiled at her new look in the mirror.' },
      { emoji: '🤗', text: 'Her friends complimented her later that day.' },
    ],
    keyEvents: ['hair too long', 'stylist cut short', 'smiled in mirror', 'friends complimented'],
  },

  // === Tier 2 expansion ===
  { id: 'apology', title: 'The Apology', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '😠', text: 'Two best friends had a big argument and stopped talking for a week.' },
      { emoji: '💭', text: 'David realized he had said something hurtful and felt guilty.' },
      { emoji: '✉️', text: 'He wrote a heartfelt note and left it on his friend\'s desk.' },
      { emoji: '🤝', text: 'They met at lunch, talked it out, and made up.' },
    ],
    keyEvents: ['argument', 'stopped talking', 'felt guilty', 'wrote note', 'made up at lunch'],
  },
  { id: 'science-fair', title: 'The Science Fair', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '💡', text: 'Mia decided to build a model volcano for the science fair.' },
      { emoji: '🛒', text: 'She gathered baking soda, vinegar, and clay from the store.' },
      { emoji: '🌋', text: 'On the day of the fair, her volcano erupted perfectly when she added vinegar.' },
      { emoji: '🏆', text: 'She won second place and felt proud of her hard work.' },
    ],
    keyEvents: ['decided model volcano', 'gathered materials', 'erupted perfectly', 'won second place', 'felt proud'],
  },
  { id: 'wallet-found', title: 'The Found Wallet', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '👛', text: 'James found a wallet on a bench in the park.' },
      { emoji: '🪪', text: 'Inside was money, an ID, and a phone number.' },
      { emoji: '📞', text: 'He called the number and arranged to meet the owner.' },
      { emoji: '🙏', text: 'The grateful man offered a reward, but James said honesty was enough.' },
    ],
    keyEvents: ['found wallet on bench', 'had money and ID', 'called the owner', 'returned wallet', 'declined reward'],
  },
  { id: 'recital', title: 'The Piano Recital', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '🎹', text: 'Sophie practiced piano for months for her first recital.' },
      { emoji: '😰', text: 'On stage, she felt nervous and forgot the first few notes.' },
      { emoji: '🎵', text: 'She took a deep breath and started over slowly, finding her place.' },
      { emoji: '👏', text: 'The audience clapped loudly and her teacher gave her a thumbs up.' },
    ],
    keyEvents: ['practiced for months', 'forgot first notes', 'started over', 'audience clapped', 'teacher proud'],
  },
  { id: 'storm-shelter', title: 'The Storm', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '⛈️', text: 'A huge storm warning came on the TV.' },
      { emoji: '🥫', text: 'The family quickly gathered flashlights, food, and water.' },
      { emoji: '🏠', text: 'They went down to the basement and waited together.' },
      { emoji: '🌈', text: 'After it passed, they came up to see the sun and a rainbow.' },
    ],
    keyEvents: ['storm warning', 'gathered supplies', 'went to basement', 'waited together', 'sun and rainbow after'],
  },
  { id: 'volunteer-day', title: 'Volunteer Day', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '🙋', text: 'Marcus signed up to volunteer at a soup kitchen on Saturday.' },
      { emoji: '🥣', text: 'He helped serve hot meals to people in need.' },
      { emoji: '💬', text: 'He talked with one elderly man for nearly an hour.' },
      { emoji: '❤️', text: 'He went home tired but feeling like he had really helped someone.' },
    ],
    keyEvents: ['signed up to volunteer', 'served hot meals', 'talked with elderly man', 'felt he really helped'],
  },
  { id: 'class-pet', title: 'The Class Pet', tier: 2, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '🐹', text: 'The class hamster escaped from its cage during lunch.' },
      { emoji: '🔍', text: 'The students searched every corner of the classroom.' },
      { emoji: '📚', text: 'They finally found it sleeping behind the bookshelf.' },
      { emoji: '🔒', text: 'The teacher fixed the cage latch so it couldn\'t happen again.' },
    ],
    keyEvents: ['hamster escaped', 'searched classroom', 'found behind bookshelf', 'teacher fixed latch'],
  },

  // === Tier 3 expansion ===
  { id: 'unexpected-letter', title: 'The Unexpected Letter', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '📬', text: 'An old man received a handwritten letter — something rare these days.' },
      { emoji: '👀', text: 'It was from a former student he hadn\'t seen in 30 years.' },
      { emoji: '🙏', text: 'The letter thanked him for believing in her when no one else did.' },
      { emoji: '🥺', text: 'He wiped his eyes and realized that small kindnesses can echo for decades.' },
    ],
    keyEvents: ['received handwritten letter', 'former student from 30 years ago', 'thanked for believing', 'wiped eyes', 'small kindnesses echo'],
  },
  { id: 'second-chance', title: 'A Second Chance', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '💔', text: 'After failing the bar exam twice, Daniel almost gave up his dream of being a lawyer.' },
      { emoji: '🪞', text: 'His grandmother told him that quitting is permanent, but trying isn\'t.' },
      { emoji: '📚', text: 'He studied for another year, balancing a job and late-night sessions.' },
      { emoji: '🎓', text: 'He passed the third time, and called his grandmother first.' },
    ],
    keyEvents: ['failed bar exam twice', 'almost gave up', 'grandmother encouraged', 'studied another year', 'passed third time', 'called grandmother'],
  },
  { id: 'gift-time', title: 'The Gift of Time', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '🕰️', text: 'A busy father always promised his daughter he\'d play with her "later".' },
      { emoji: '👧', text: 'One day she stopped asking, and that silence hurt more than any complaint.' },
      { emoji: '📅', text: 'He cleared his Saturday and built a treehouse with her instead of working.' },
      { emoji: '🌳', text: 'She said it was the best day she\'d ever had — and he realized what really mattered.' },
    ],
    keyEvents: ['always promised later', 'she stopped asking', 'cleared Saturday', 'built treehouse', 'realized what mattered'],
  },
  { id: 'old-friend', title: 'The Old Friend', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 5,
    scenes: [
      { emoji: '☕', text: 'Two college friends met for coffee after not speaking for 15 years.' },
      { emoji: '😶', text: 'At first the conversation was awkward and full of long pauses.' },
      { emoji: '😄', text: 'Slowly they started laughing about old memories and shared regrets.' },
      { emoji: '🤗', text: 'They left promising to stay in touch, knowing some bonds outlast any silence.' },
    ],
    keyEvents: ['met after 15 years', 'awkward at first', 'laughed about memories', 'promised to stay in touch', 'bonds outlast silence'],
  },
  { id: 'unexpected-mentor', title: 'The Unexpected Mentor', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '🧹', text: 'A new employee was assigned the boring job of cleaning the lab.' },
      { emoji: '🧪', text: 'The lead scientist began chatting with him while he worked, asking his opinions.' },
      { emoji: '💡', text: 'It turned out he had real insights — he had studied chemistry in another country.' },
      { emoji: '🎓', text: 'A year later, he was running his own experiments with the team.' },
    ],
    keyEvents: ['cleaning the lab', 'scientist chatted with him', 'had real insights', 'studied chemistry abroad', 'running own experiments'],
  },
  { id: 'lost-child', title: 'The Lost Child', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '🛒', text: 'A mother turned around in the grocery store and her toddler was gone.' },
      { emoji: '😱', text: 'For a few terrifying minutes, she searched every aisle calling his name.' },
      { emoji: '🧑‍🦱', text: 'A stranger had spotted him heading toward the door and gently held his hand.' },
      { emoji: '🙏', text: 'She thanked the stranger through tears, holding her child tighter than ever.' },
    ],
    keyEvents: ['toddler gone in store', 'searched every aisle', 'stranger spotted him', 'held his hand', 'thanked stranger', 'held child tighter'],
  },
  { id: 'final-game', title: 'The Final Game', tier: 3, structureMap: DEFAULT_STRUCTURE, expectedClauses: 6,
    scenes: [
      { emoji: '🏀', text: 'The team was down by two points with ten seconds left in the championship.' },
      { emoji: '🤔', text: 'The coach called a play, but the youngest player wanted to take the shot.' },
      { emoji: '🏀', text: 'She made the three-pointer right at the buzzer.' },
      { emoji: '🏆', text: 'The team realized that trusting each other mattered more than the trophy.' },
    ],
    keyEvents: ['down by two', 'youngest wanted the shot', 'made three-pointer', 'won at buzzer', 'trusting each other mattered'],
  },
];

export function getStoriesByTier(tier: number): NarrativeStory[] {
  return NARRATIVE_STORIES.filter(s => s.tier === tier);
}
