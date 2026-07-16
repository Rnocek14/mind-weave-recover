/**
 * Kids Mode content pack.
 *
 * Photo trials are DERIVED from the main PHOTO_BANK using its research
 * metadata: `age_of_acquisition` (years) tells us which words a young child
 * plausibly knows, so the kid pool is "words acquired by ~age 6" at the
 * easier difficulty tiers. This reuses existing curated images and foils —
 * no duplicate content to maintain.
 *
 * Sentence trials are hand-authored in the exact SentenceTrial shape used by
 * sentenceBank.ts (same conventions: lowercase option chips, capitalized
 * first word in correctAnswer, distractors listed separately), scoped to
 * kid-world topics and difficulty 1–3.
 *
 * Everything here is additive: nothing in the adult banks is modified, and
 * these selectors are only called when Kids Mode is on.
 */

import { PHOTO_BANK, PhotoTrial } from "@/data/photoBank";
import { SentenceTrial } from "@/data/sentenceBank";

// ─── Kid photo pool ────────────────────────────────────────────────────────

/** Max age-of-acquisition (years) for a word to count as kid vocabulary. */
const KIDS_MAX_AOA = 6;
/** Keep kid sessions in the easy/mid tiers. */
const KIDS_MAX_DIFFICULTY = 3;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The full kid-eligible photo pool (deduped by target word). */
export function getKidsPhotoPool(): PhotoTrial[] {
  const seen = new Set<string>();
  return PHOTO_BANK.filter((trial) => {
    if (trial.features.age_of_acquisition > KIDS_MAX_AOA) return false;
    if (trial.computed_difficulty > KIDS_MAX_DIFFICULTY) return false;
    const key = trial.target.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * A shuffled kid photo session of `count` trials, easiest-leaning first.
 * Falls back to the full pool order if the pool is smaller than requested.
 */
export function getKidsPhotoTrials(count: number): PhotoTrial[] {
  const pool = shuffle(getKidsPhotoPool());
  // Bias easy items toward the front so sessions start with quick wins.
  pool.sort((a, b) => {
    const bandA = a.computed_difficulty <= 2 ? 0 : 1;
    const bandB = b.computed_difficulty <= 2 ? 0 : 1;
    return bandA - bandB;
  });
  return pool.slice(0, count);
}

// ─── Kid sentence bank ─────────────────────────────────────────────────────

export const KIDS_SENTENCE_TRIALS: SentenceTrial[] = [
  // Difficulty 1: 4-5 words, no distractors
  {
    id: "kid_svo_1",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The puppy licks my hand",
    options: ["hand", "my", "licks", "puppy", "the"],
    correctAnswer: ["The", "puppy", "licks", "my", "hand"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The puppy licks my hand",
  },
  {
    id: "kid_svo_2",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The frog jumps high",
    options: ["high", "jumps", "frog", "the"],
    correctAnswer: ["The", "frog", "jumps", "high"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The frog jumps high",
  },
  {
    id: "kid_svo_3",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "I love my teddy bear",
    options: ["bear", "teddy", "my", "love", "I"],
    correctAnswer: ["I", "love", "my", "teddy", "bear"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "I love my teddy bear",
  },
  {
    id: "kid_svo_4",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The bunny eats a carrot",
    options: ["carrot", "a", "eats", "bunny", "the"],
    correctAnswer: ["The", "bunny", "eats", "a", "carrot"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The bunny eats a carrot",
  },
  {
    id: "kid_svo_5",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "We play in the park",
    options: ["park", "the", "in", "play", "we"],
    correctAnswer: ["We", "play", "in", "the", "park"],
    distractors: [],
    grammarFocus: "prepositions",
    modelAudio: "We play in the park",
  },
  {
    id: "kid_svo_6",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The kitten drinks milk",
    options: ["milk", "drinks", "kitten", "the"],
    correctAnswer: ["The", "kitten", "drinks", "milk"],
    distractors: [],
    grammarFocus: "SVO",
    modelAudio: "The kitten drinks milk",
  },
  {
    id: "kid_svo_7",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "My ball is red",
    options: ["red", "is", "ball", "my"],
    correctAnswer: ["My", "ball", "is", "red"],
    distractors: [],
    grammarFocus: "adjectives",
    modelAudio: "My ball is red",
  },
  {
    id: "kid_svo_8",
    taskType: "word_order",
    difficulty: 1,
    targetSentence: "The fish swims fast",
    options: ["fast", "swims", "fish", "the"],
    correctAnswer: ["The", "fish", "swims", "fast"],
    distractors: [],
    grammarFocus: "adverbs",
    modelAudio: "The fish swims fast",
  },

  // Difficulty 2: 5-6 words, 1 distractor
  {
    id: "kid_dist_1",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The monkey swings on the tree",
    options: ["tree", "the", "on", "swings", "monkey", "the", "under"],
    correctAnswer: ["The", "monkey", "swings", "on", "the", "tree"],
    distractors: ["under"],
    grammarFocus: "prepositions",
    modelAudio: "The monkey swings on the tree",
  },
  {
    id: "kid_dist_2",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "I ride my big bike",
    options: ["bike", "big", "my", "ride", "I", "small"],
    correctAnswer: ["I", "ride", "my", "big", "bike"],
    distractors: ["small"],
    grammarFocus: "adjectives",
    modelAudio: "I ride my big bike",
  },
  {
    id: "kid_dist_3",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The duck splashes in the pond",
    options: ["pond", "the", "in", "splashes", "duck", "the", "sky"],
    correctAnswer: ["The", "duck", "splashes", "in", "the", "pond"],
    distractors: ["sky"],
    grammarFocus: "prepositions",
    modelAudio: "The duck splashes in the pond",
  },
  {
    id: "kid_dist_4",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "We build a tall tower",
    options: ["tower", "tall", "a", "build", "we", "eat"],
    correctAnswer: ["We", "build", "a", "tall", "tower"],
    distractors: ["eat"],
    grammarFocus: "adjectives",
    modelAudio: "We build a tall tower",
  },
  {
    id: "kid_dist_5",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "The cow says moo",
    options: ["moo", "says", "cow", "the", "meow"],
    correctAnswer: ["The", "cow", "says", "moo"],
    distractors: ["meow"],
    grammarFocus: "SVO",
    modelAudio: "The cow says moo",
  },
  {
    id: "kid_dist_6",
    taskType: "word_order",
    difficulty: 2,
    targetSentence: "I share my toys with friends",
    options: ["friends", "with", "toys", "my", "share", "I", "hide"],
    correctAnswer: ["I", "share", "my", "toys", "with", "friends"],
    distractors: ["hide"],
    grammarFocus: "prepositions",
    modelAudio: "I share my toys with friends",
  },

  // Difficulty 3: 5-7 words, verb agreement, 1-2 distractors
  {
    id: "kid_verb_1",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "She paints a pretty rainbow",
    options: ["rainbow", "pretty", "a", "paints", "she", "paint"],
    correctAnswer: ["She", "paints", "a", "pretty", "rainbow"],
    distractors: ["paint"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "She paints a pretty rainbow",
  },
  {
    id: "kid_verb_2",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "The birds sing in the morning",
    options: ["morning", "the", "in", "sing", "birds", "the", "sings"],
    correctAnswer: ["The", "birds", "sing", "in", "the", "morning"],
    distractors: ["sings"],
    grammarFocus: "plural_agreement",
    modelAudio: "The birds sing in the morning",
  },
  {
    id: "kid_verb_3",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "He kicks the ball to me",
    options: ["me", "to", "ball", "the", "kicks", "he", "kick"],
    correctAnswer: ["He", "kicks", "the", "ball", "to", "me"],
    distractors: ["kick"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "He kicks the ball to me",
  },
  {
    id: "kid_verb_4",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "They are jumping in puddles",
    options: ["puddles", "in", "jumping", "are", "they", "is"],
    correctAnswer: ["They", "are", "jumping", "in", "puddles"],
    distractors: ["is"],
    grammarFocus: "plural_agreement",
    modelAudio: "They are jumping in puddles",
  },
  {
    id: "kid_verb_5",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "The dinosaur stomps very loud",
    options: ["loud", "very", "stomps", "dinosaur", "the", "stomp"],
    correctAnswer: ["The", "dinosaur", "stomps", "very", "loud"],
    distractors: ["stomp"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "The dinosaur stomps very loud",
  },
  {
    id: "kid_verb_6",
    taskType: "word_order",
    difficulty: 3,
    targetSentence: "My sister reads a funny book",
    options: ["book", "funny", "a", "reads", "sister", "my", "read"],
    correctAnswer: ["My", "sister", "reads", "a", "funny", "book"],
    distractors: ["read"],
    grammarFocus: "subject_verb_agreement",
    modelAudio: "My sister reads a funny book",
  },
];

/** Kid sentence levels only go 1–3; higher engine levels clamp down. */
const KIDS_MAX_SENTENCE_LEVEL = 3;

/**
 * Kids-mode replacement for sentenceBank.getMixedTrials. Clamps the level
 * into the kid range and pads from adjacent kid levels when a single level
 * doesn't have enough items, so sessions never come up short.
 */
export function getKidsMixedSentenceTrials(level: number, count: number = 10): SentenceTrial[] {
  const clamped = Math.min(Math.max(Math.round(level), 1), KIDS_MAX_SENTENCE_LEVEL);
  const atLevel = shuffle(KIDS_SENTENCE_TRIALS.filter((t) => t.difficulty === clamped));
  if (atLevel.length >= count) return atLevel.slice(0, count);
  const ids = new Set(atLevel.map((t) => t.id));
  const padding = shuffle(KIDS_SENTENCE_TRIALS.filter((t) => !ids.has(t.id)));
  return [...atLevel, ...padding].slice(0, count);
}

// ─── Kid praise ────────────────────────────────────────────────────────────

const KIDS_PRAISE = [
  "🌟 Super job!",
  "🎉 You got it!",
  "🦖 Dino-mite!",
  "🚀 Out of this world!",
  "🌈 Amazing!",
  "⭐ You're a star!",
  "🏆 Way to go!",
  "🐸 Toad-ally awesome!",
];

export function getKidsPraise(): string {
  return KIDS_PRAISE[Math.floor(Math.random() * KIDS_PRAISE.length)];
}
