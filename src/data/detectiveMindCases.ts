/**
 * Detective Mind: Narrative Mystery Cases
 * 
 * 20 cases across 3 difficulty tiers:
 * - Easy (tier 1): 3-4 sentences, literal questions, 3 options
 * - Medium (tier 2): 4-5 sentences, inference/causality, 4 options
 * - Hard (tier 3): 5-6 sentences, prediction/figurative, 4 options
 * 
 * Each case has exactly 1 question for clean trial-based scoring.
 */

export type QuestionType = 'literal' | 'inference' | 'cause_effect' | 'prediction' | 'figurative';

export interface DetectiveCase {
  id: string;
  title: string;
  tier: 1 | 2 | 3;
  story: string[];
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  questionType: QuestionType;
  /** Index of the sentence containing key evidence for hint highlighting */
  hintSentenceIndex: number;
}

export const DETECTIVE_CASES: DetectiveCase[] = [
  // ============ TIER 1: EASY (literal, 3-4 sentences, 3 options) ============
  {
    id: 'case-01',
    title: 'The Wet Floor',
    tier: 1,
    story: [
      'Maria came home and saw water on the kitchen floor.',
      'The sink faucet was running.',
      'Her cat was sitting on the counter looking guilty.',
    ],
    question: 'What caused the water on the floor?',
    options: ['The faucet was left running', 'It rained inside', 'Maria spilled her drink'],
    correctIndex: 0,
    explanation: 'The story says the sink faucet was running, which caused the water.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-02',
    title: 'The Missing Lunch',
    tier: 1,
    story: [
      'David put his sandwich in the fridge at work.',
      'At noon, he opened the fridge.',
      'The sandwich was gone.',
      'His coworker had crumbs on his shirt.',
    ],
    question: 'Who most likely took the sandwich?',
    options: ['His boss', 'His coworker', 'The cleaning staff'],
    correctIndex: 1,
    explanation: 'The coworker had crumbs on his shirt — a clue that he ate it.',
    questionType: 'literal',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-03',
    title: 'The Broken Vase',
    tier: 1,
    story: [
      'There was a broken vase on the living room floor.',
      'A baseball was lying next to it.',
      'The window was open.',
    ],
    question: 'What probably broke the vase?',
    options: ['An earthquake', 'A baseball came through the window', 'The cat knocked it over'],
    correctIndex: 1,
    explanation: 'The baseball next to the vase and the open window tell us the ball came in and broke it.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-04',
    title: 'The Late Bus',
    tier: 1,
    story: [
      'Emma was standing at the bus stop.',
      'It was snowing heavily.',
      'She had been waiting for 30 minutes.',
      'The roads were covered in ice.',
    ],
    question: 'Why is the bus late?',
    options: ['The driver is on vacation', 'The bad weather slowed it down', 'Emma is at the wrong stop'],
    correctIndex: 1,
    explanation: 'Heavy snow and icy roads would slow down the bus.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-05',
    title: 'The Barking Dog',
    tier: 1,
    story: [
      'The dog started barking loudly at night.',
      'Someone was walking near the fence.',
      'The motion light turned on outside.',
    ],
    question: 'Why did the dog bark?',
    options: ['It was hungry', 'Someone was near the house', 'It heard thunder'],
    correctIndex: 1,
    explanation: 'The person near the fence triggered the motion light and the barking.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-06',
    title: 'The Empty Bowl',
    tier: 1,
    story: [
      'Mom put cookies on the table.',
      'She left the room for five minutes.',
      'When she came back, the bowl was empty.',
      'Her son had chocolate on his face.',
    ],
    question: 'Who ate the cookies?',
    options: ['Mom ate them herself', 'Her son ate them', 'The dog ate them'],
    correctIndex: 1,
    explanation: 'The chocolate on her son\'s face is a clear clue.',
    questionType: 'literal',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-07',
    title: 'The Flat Tire',
    tier: 1,
    story: [
      'John drove over something sharp on the road.',
      'He heard a loud pop.',
      'The car started pulling to one side.',
    ],
    question: 'What happened to the car?',
    options: ['The engine broke', 'A tire went flat', 'It ran out of gas'],
    correctIndex: 1,
    explanation: 'Driving over something sharp, a pop sound, and pulling to one side = flat tire.',
    questionType: 'literal',
    hintSentenceIndex: 0,
  },

  // ============ TIER 2: MEDIUM (inference/causality, 4-5 sentences, 4 options) ============
  {
    id: 'case-08',
    title: 'The Nervous Sister',
    tier: 2,
    story: [
      'Tom walked into the kitchen and saw broken glass on the floor.',
      'The window was open.',
      'His dog was wagging its tail.',
      'His sister looked nervous.',
    ],
    question: 'Who likely broke the glass?',
    options: ['Tom', 'The dog', 'His sister', 'A stranger'],
    correctIndex: 2,
    explanation: 'The sister looks nervous — she likely did something wrong. The dog is happy, not guilty.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-09',
    title: 'The Secret Gift',
    tier: 2,
    story: [
      'Lisa found flowers on her desk when she arrived at work.',
      'There was no card attached.',
      'Her friend Mark smiled and quickly looked away when she asked about them.',
      'Nobody else was in the office before Lisa arrived.',
    ],
    question: 'Who most likely left the flowers?',
    options: ['A delivery service', 'Mark', 'Lisa\'s boss', 'A stranger'],
    correctIndex: 1,
    explanation: 'Mark smiled and looked away — classic sign of someone hiding that they did something nice.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-10',
    title: 'The Canceled Game',
    tier: 2,
    story: [
      'The soccer field was completely muddy.',
      'Dark clouds covered the sky all morning.',
      'The coach sent a message to all parents.',
      'Kids were disappointed but stayed home.',
    ],
    question: 'Why did the kids stay home?',
    options: ['School was closed', 'The game was canceled due to weather', 'They didn\'t want to play', 'The coach was sick'],
    correctIndex: 1,
    explanation: 'Muddy field + dark clouds + coach message = game canceled because of bad weather.',
    questionType: 'cause_effect',
    hintSentenceIndex: 0,
  },
  {
    id: 'case-11',
    title: 'The Locked Room',
    tier: 2,
    story: [
      'The jewelry box in the locked room was empty.',
      'The window had no signs of being forced open.',
      'Only two people had the key: the owner and the housekeeper.',
      'The housekeeper called in sick that day but was seen downtown.',
      'The owner was on vacation.',
    ],
    question: 'Who is the prime suspect?',
    options: ['A burglar', 'The owner', 'The housekeeper', 'A neighbor'],
    correctIndex: 2,
    explanation: 'The housekeeper lied about being sick, has a key, and no break-in occurred.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-12',
    title: 'The Changed Recipe',
    tier: 2,
    story: [
      'Grandma\'s cake tasted different this year.',
      'She couldn\'t find her reading glasses.',
      'The sugar container was next to the salt container.',
      'Both containers look exactly the same.',
    ],
    question: 'What probably went wrong?',
    options: ['She used a new recipe', 'She mixed up sugar and salt', 'The oven was broken', 'She forgot an ingredient'],
    correctIndex: 1,
    explanation: 'Without glasses, identical containers side by side — she likely grabbed salt instead of sugar.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-13',
    title: 'The Morning Rush',
    tier: 2,
    story: [
      'Sarah\'s alarm didn\'t go off this morning.',
      'She skipped breakfast and grabbed her keys.',
      'She drove faster than usual.',
      'She arrived at work with her shirt inside out.',
    ],
    question: 'Why was Sarah\'s shirt inside out?',
    options: ['It\'s a fashion trend', 'She got dressed in a rush', 'Someone played a prank', 'She wore it that way on purpose'],
    correctIndex: 1,
    explanation: 'The alarm didn\'t go off → she rushed → dressed too quickly → shirt inside out.',
    questionType: 'cause_effect',
    hintSentenceIndex: 0,
  },

  // ============ TIER 3: HARD (prediction/figurative, 5-6 sentences, 4 options) ============
  {
    id: 'case-14',
    title: 'The Interview',
    tier: 3,
    story: [
      'Jake practiced his answers for three days.',
      'He wore his best suit and arrived 15 minutes early.',
      'The interviewer smiled and said, "We\'ll be in touch."',
      'Two other candidates left looking stressed.',
      'Jake received a phone call the next morning.',
    ],
    question: 'What most likely happened?',
    options: ['He got rejected', 'He got the job', 'The company closed', 'They lost his application'],
    correctIndex: 1,
    explanation: 'Good preparation + confidence + quick callback = likely got the job.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-15',
    title: 'The New Neighbor',
    tier: 3,
    story: [
      'A moving truck arrived next door.',
      'The new neighbor carried in many boxes of books.',
      'She set up a desk near the window first thing.',
      'A university parking sticker was on her car.',
      'She introduced herself as "Professor Chen."',
    ],
    question: 'What can you predict about the new neighbor\'s daily routine?',
    options: [
      'She probably works at a restaurant',
      'She likely teaches and does research at a university',
      'She is probably retired',
      'She probably works from home as an artist',
    ],
    correctIndex: 1,
    explanation: 'Books, a desk, university sticker, and "Professor" title all point to academic work.',
    questionType: 'prediction',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-16',
    title: 'The Storm Warning',
    tier: 3,
    story: [
      'The weather report warned of a severe storm.',
      'Mr. Garcia boarded up his windows.',
      'He filled the bathtub with water.',
      'He bought batteries, canned food, and a radio.',
      'His neighbors laughed and said he was overreacting.',
      'The power went out that night.',
    ],
    question: 'What will likely happen to the neighbors compared to Mr. Garcia?',
    options: [
      'The neighbors will be fine',
      'Mr. Garcia will be better prepared than his neighbors',
      'Everyone will be equally affected',
      'Mr. Garcia wasted his time',
    ],
    correctIndex: 1,
    explanation: 'Mr. Garcia prepared while neighbors didn\'t — when the power went out, he was ready.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-17',
    title: 'Breaking the Ice',
    tier: 3,
    story: [
      'It was Amy\'s first day at a new company.',
      'Everyone in the break room was talking in small groups.',
      'Amy told a funny story about her commute.',
      'People started laughing and introducing themselves.',
      'By lunch, she had been invited to join three different groups.',
    ],
    question: 'The story says Amy "broke the ice." What does that mean?',
    options: [
      'She broke something frozen in the break room',
      'She made people feel comfortable and started conversations',
      'She created problems on her first day',
      'She made the room colder',
    ],
    correctIndex: 1,
    explanation: '"Breaking the ice" means making people feel comfortable — Amy did this with humor.',
    questionType: 'figurative',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-18',
    title: 'The Last Straw',
    tier: 3,
    story: [
      'The restaurant got Mike\'s order wrong for the third time.',
      'The waiter spilled water on his jacket.',
      'Then they charged him for food he didn\'t order.',
      'Mike stood up, left money on the table, and walked out.',
      'He never went back to that restaurant again.',
    ],
    question: 'What was "the last straw" for Mike?',
    options: [
      'He found a straw on the floor',
      'The wrong charge was the final thing that made him give up',
      'He ran out of straws for his drink',
      'The waiter took his straw away',
    ],
    correctIndex: 1,
    explanation: '"The last straw" means the final problem that pushes someone over the edge.',
    questionType: 'figurative',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-19',
    title: 'The Disappearing Act',
    tier: 3,
    story: [
      'Karen\'s coworker always volunteered for new projects.',
      'But when the hard work started, he was never around.',
      'He always had an excuse: a meeting, a phone call, a dentist appointment.',
      'Other team members had to finish his work.',
      'The boss started noticing the pattern.',
    ],
    question: 'What will the boss most likely do?',
    options: [
      'Give the coworker a promotion',
      'Confront the coworker about not doing his share',
      'Ignore the problem',
      'Fire Karen instead',
    ],
    correctIndex: 1,
    explanation: 'The boss noticed the pattern of avoiding work — they\'ll likely address it.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-20',
    title: 'The Silent Treatment',
    tier: 3,
    story: [
      'Ben forgot his wife\'s birthday.',
      'When he came home, the house was unusually quiet.',
      'Dinner wasn\'t made, and his wife was reading in the bedroom.',
      'She answered his questions with one-word replies.',
      'A calendar on the fridge had today\'s date circled with a heart.',
    ],
    question: 'Why is Ben\'s wife giving him the "silent treatment"?',
    options: [
      'She\'s tired from work',
      'She\'s upset because he forgot her birthday',
      'She doesn\'t feel well',
      'She\'s focused on her book',
    ],
    correctIndex: 1,
    explanation: 'The circled date with a heart + cold behavior = she\'s hurt he forgot her birthday.',
    questionType: 'inference',
    hintSentenceIndex: 4,
  },
];

/**
 * Get cases filtered by difficulty tier
 */
export const getCasesByTier = (tier: 1 | 2 | 3): DetectiveCase[] => {
  return DETECTIVE_CASES.filter(c => c.tier === tier);
};

// ─── Phase 1.5 Adaptive Standard ───────────────────────────────────────────
// Strict 3-tier mapping for comprehension + reasoning exercise.
// Engine level (1-10) → tier (1|2|3). No ±tolerance, no blending.
// Aligned to the canonical Phase 1.5 split (≤3 / 4-7 / ≥8) used by
// PhotoNaming and MultiStepPlanning so all games share one engine contract.

export type DetectiveTier = 1 | 2 | 3;

export const mapEngineLevelToDetectiveTier = (level: number): DetectiveTier => {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
};

/**
 * Legacy alias — kept for backward compatibility with existing imports.
 * @deprecated use mapEngineLevelToDetectiveTier
 */
export const levelToTier = mapEngineLevelToDetectiveTier;

/**
 * Strict tier-isolated selector (Phase 1.5 contract).
 * Returns ONLY cases at the tier corresponding to the engine level.
 * Never blends across tiers; if the pool is exhausted by exclusions,
 * repeats are allowed within the same tier.
 */
export function getDetectiveCasesForLevel(
  level: number,
  count: number,
  excludeIds: string[] = []
): DetectiveCase[] {
  const targetTier = mapEngineLevelToDetectiveTier(level);
  const excludeSet = new Set(excludeIds);
  let pool = DETECTIVE_CASES.filter(
    c => c.tier === targetTier && !excludeSet.has(c.id)
  );
  if (pool.length === 0) {
    pool = DETECTIVE_CASES.filter(c => c.tier === targetTier);
  }
  const order = pool.map(p => [Math.random(), p] as const).sort((a, b) => a[0] - b[0]);
  return order.slice(0, Math.min(count, order.length)).map(([, p]) => p);
}

/**
 * Per-case difficulty signal — used by the audit harness to confirm
 * an L1 → L10 perceptual curve actually exists for comprehension/reasoning.
 *   • story_length: number of sentences (working-memory load)
 *   • options_count: number of choices (decision load)
 *   • inference_depth: 0 literal, 1 cause/effect, 2 inference, 3 prediction/figurative
 */
const QUESTION_INFERENCE_DEPTH: Record<QuestionType, number> = {
  literal: 0,
  cause_effect: 1,
  inference: 2,
  prediction: 3,
  figurative: 3,
};

export function computeDetectiveDifficulty(c: DetectiveCase): {
  story_length: number;
  options_count: number;
  inference_depth: number;
  composite: number;
} {
  const story_length = c.story.length;
  const options_count = c.options.length;
  const inference_depth = QUESTION_INFERENCE_DEPTH[c.questionType] ?? 0;
  // Normalize roughly to 0-1 and weight inference heaviest.
  const composite =
    (story_length / 8) * 0.25 +
    (options_count / 5) * 0.15 +
    (inference_depth / 3) * 0.6;
  return { story_length, options_count, inference_depth, composite };
}
