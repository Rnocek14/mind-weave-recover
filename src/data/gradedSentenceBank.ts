/**
 * Graded Sentence Bank
 * 
 * Structured sentence stimuli for adaptive therapy progression.
 * Each target word has 4 difficulty levels:
 *   Level 1 — Single word (isolation)
 *   Level 2 — Simple sentence (2-4 words)
 *   Level 3 — Expanded phrase (5-7 words)
 *   Level 4 — Complex sentence (8+ words)
 * 
 * The adaptive engine uses these to scaffold difficulty:
 *   struggle → drop level | success → raise level
 */

export interface GradedSentence {
  id: string;
  targetWord: string;
  level: 1 | 2 | 3 | 4;
  sentence: string;
  phonemeTargets: string[];
  wordCount: number;
}

// ─── Helper to build entries consistently ────────────────────

let _idCounter = 0;
function g(
  targetWord: string,
  level: 1 | 2 | 3 | 4,
  sentence: string,
  phonemeTargets: string[]
): GradedSentence {
  _idCounter++;
  return {
    id: `gs-${_idCounter.toString().padStart(3, '0')}`,
    targetWord,
    level,
    sentence,
    phonemeTargets,
    wordCount: sentence.split(/\s+/).filter(Boolean).length,
  };
}

// ─── Graded Sentence Bank ────────────────────────────────────

export const GRADED_SENTENCE_BANK: GradedSentence[] = [
  // ── cat (/k/, /æ/, /t/) ──
  g('cat', 1, 'Cat.', ['/k/', '/æ/', '/t/']),
  g('cat', 2, 'The cat sleeps.', ['/k/', '/æ/', '/t/']),
  g('cat', 3, 'The cat sleeps on the chair.', ['/k/', '/æ/', '/t/']),
  g('cat', 4, 'The small cat sleeps quietly on the warm chair.', ['/k/', '/æ/', '/t/']),

  // ── dog (/d/, /ɔ/, /g/) ──
  g('dog', 1, 'Dog.', ['/d/', '/ɔ/', '/g/']),
  g('dog', 2, 'The dog runs.', ['/d/', '/ɔ/', '/g/']),
  g('dog', 3, 'The dog runs in the yard.', ['/d/', '/ɔ/', '/g/']),
  g('dog', 4, 'The brown dog runs quickly in the sunny yard.', ['/d/', '/ɔ/', '/g/']),

  // ── house (/h/, /aʊ/, /s/) ──
  g('house', 1, 'House.', ['/h/', '/aʊ/', '/s/']),
  g('house', 2, 'The house is big.', ['/h/', '/aʊ/', '/s/']),
  g('house', 3, 'The house is on the hill.', ['/h/', '/aʊ/', '/s/']),
  g('house', 4, 'The old house sits quietly on the green hill.', ['/h/', '/aʊ/', '/s/']),

  // ── ball (/b/, /ɔ/, /l/) ──
  g('ball', 1, 'Ball.', ['/b/', '/ɔ/', '/l/']),
  g('ball', 2, 'The ball bounces.', ['/b/', '/ɔ/', '/l/']),
  g('ball', 3, 'The ball bounces on the floor.', ['/b/', '/ɔ/', '/l/']),
  g('ball', 4, 'The red ball bounces high on the wooden floor.', ['/b/', '/ɔ/', '/l/']),

  // ── cup (/k/, /ʌ/, /p/) ──
  g('cup', 1, 'Cup.', ['/k/', '/ʌ/', '/p/']),
  g('cup', 2, 'The cup is full.', ['/k/', '/ʌ/', '/p/']),
  g('cup', 3, 'The cup is on the table.', ['/k/', '/ʌ/', '/p/']),
  g('cup', 4, 'The blue cup sits on the kitchen table near the window.', ['/k/', '/ʌ/', '/p/']),

  // ── book (/b/, /ʊ/, /k/) ──
  g('book', 1, 'Book.', ['/b/', '/ʊ/', '/k/']),
  g('book', 2, 'The book is open.', ['/b/', '/ʊ/', '/k/']),
  g('book', 3, 'The book is on the shelf.', ['/b/', '/ʊ/', '/k/']),
  g('book', 4, 'The thick book sits on the top shelf by the lamp.', ['/b/', '/ʊ/', '/k/']),

  // ── tree (/t/, /r/, /i/) ──
  g('tree', 1, 'Tree.', ['/t/', '/r/', '/i/']),
  g('tree', 2, 'The tree is tall.', ['/t/', '/r/', '/i/']),
  g('tree', 3, 'The tree grows in the park.', ['/t/', '/r/', '/i/']),
  g('tree', 4, 'The tall green tree grows slowly in the quiet park.', ['/t/', '/r/', '/i/']),

  // ── bird (/b/, /ɜ/, /r/, /d/) ──
  g('bird', 1, 'Bird.', ['/b/', '/ɜ/', '/r/', '/d/']),
  g('bird', 2, 'The bird sings.', ['/b/', '/ɜ/', '/r/', '/d/']),
  g('bird', 3, 'The bird sings in the tree.', ['/b/', '/ɜ/', '/r/', '/d/']),
  g('bird', 4, 'The small bird sings a happy song in the tall tree.', ['/b/', '/ɜ/', '/r/', '/d/']),

  // ── shoe (/ʃ/, /u/) ──
  g('shoe', 1, 'Shoe.', ['/ʃ/', '/u/']),
  g('shoe', 2, 'The shoe is new.', ['/ʃ/', '/u/']),
  g('shoe', 3, 'The shoe is under the bed.', ['/ʃ/', '/u/']),
  g('shoe', 4, 'The brown shoe is sitting under the bed near the door.', ['/ʃ/', '/u/']),

  // ── car (/k/, /ɑ/, /r/) ──
  g('car', 1, 'Car.', ['/k/', '/ɑ/', '/r/']),
  g('car', 2, 'The car is fast.', ['/k/', '/ɑ/', '/r/']),
  g('car', 3, 'The car drives down the road.', ['/k/', '/ɑ/', '/r/']),
  g('car', 4, 'The shiny red car drives quickly down the long road.', ['/k/', '/ɑ/', '/r/']),

  // ── key (/k/, /i/) ──
  g('key', 1, 'Key.', ['/k/', '/i/']),
  g('key', 2, 'The key is lost.', ['/k/', '/i/']),
  g('key', 3, 'The key is on the desk.', ['/k/', '/i/']),
  g('key', 4, 'The small silver key is sitting on the wooden desk.', ['/k/', '/i/']),

  // ── door (/d/, /ɔ/, /r/) ──
  g('door', 1, 'Door.', ['/d/', '/ɔ/', '/r/']),
  g('door', 2, 'The door is shut.', ['/d/', '/ɔ/', '/r/']),
  g('door', 3, 'The door opens to the garden.', ['/d/', '/ɔ/', '/r/']),
  g('door', 4, 'The heavy wooden door opens slowly to the sunny garden.', ['/d/', '/ɔ/', '/r/']),

  // ── fish (/f/, /ɪ/, /ʃ/) ──
  g('fish', 1, 'Fish.', ['/f/', '/ɪ/', '/ʃ/']),
  g('fish', 2, 'The fish swims.', ['/f/', '/ɪ/', '/ʃ/']),
  g('fish', 3, 'The fish swims in the lake.', ['/f/', '/ɪ/', '/ʃ/']),
  g('fish', 4, 'The golden fish swims gracefully in the clear blue lake.', ['/f/', '/ɪ/', '/ʃ/']),

  // ── flower (/f/, /l/, /aʊ/, /ɚ/) ──
  g('flower', 1, 'Flower.', ['/f/', '/l/', '/aʊ/', '/ɚ/']),
  g('flower', 2, 'The flower is red.', ['/f/', '/l/', '/aʊ/', '/ɚ/']),
  g('flower', 3, 'The flower grows in the pot.', ['/f/', '/l/', '/aʊ/', '/ɚ/']),
  g('flower', 4, 'The bright red flower grows nicely in the clay pot.', ['/f/', '/l/', '/aʊ/', '/ɚ/']),

  // ── hand (/h/, /æ/, /n/, /d/) ──
  g('hand', 1, 'Hand.', ['/h/', '/æ/', '/n/', '/d/']),
  g('hand', 2, 'The hand waves.', ['/h/', '/æ/', '/n/', '/d/']),
  g('hand', 3, 'The hand waves to the child.', ['/h/', '/æ/', '/n/', '/d/']),
  g('hand', 4, 'The gentle hand waves slowly to the happy young child.', ['/h/', '/æ/', '/n/', '/d/']),

  // ── nose (/n/, /oʊ/, /z/) ──
  g('nose', 1, 'Nose.', ['/n/', '/oʊ/', '/z/']),
  g('nose', 2, 'The nose is cold.', ['/n/', '/oʊ/', '/z/']),
  g('nose', 3, 'The nose feels cold and red.', ['/n/', '/oʊ/', '/z/']),
  g('nose', 4, 'Her small nose feels cold and red in the winter wind.', ['/n/', '/oʊ/', '/z/']),

  // ── ring (/r/, /ɪ/, /ŋ/) ──
  g('ring', 1, 'Ring.', ['/r/', '/ɪ/', '/ŋ/']),
  g('ring', 2, 'The ring shines.', ['/r/', '/ɪ/', '/ŋ/']),
  g('ring', 3, 'The ring shines in the light.', ['/r/', '/ɪ/', '/ŋ/']),
  g('ring', 4, 'The beautiful gold ring shines brightly in the warm sunlight.', ['/r/', '/ɪ/', '/ŋ/']),

  // ── spoon (/s/, /p/, /u/, /n/) ──
  g('spoon', 1, 'Spoon.', ['/s/', '/p/', '/u/', '/n/']),
  g('spoon', 2, 'The spoon is clean.', ['/s/', '/p/', '/u/', '/n/']),
  g('spoon', 3, 'The spoon sits in the bowl.', ['/s/', '/p/', '/u/', '/n/']),
  g('spoon', 4, 'The silver spoon sits neatly in the large soup bowl.', ['/s/', '/p/', '/u/', '/n/']),

  // ── cake (/k/, /eɪ/, /k/) ──
  g('cake', 1, 'Cake.', ['/k/', '/eɪ/', '/k/']),
  g('cake', 2, 'The cake is sweet.', ['/k/', '/eɪ/', '/k/']),
  g('cake', 3, 'The cake sits on the plate.', ['/k/', '/eɪ/', '/k/']),
  g('cake', 4, 'The chocolate cake sits on a pretty white plate.', ['/k/', '/eɪ/', '/k/']),

  // ── star (/s/, /t/, /ɑ/, /r/) ──
  g('star', 1, 'Star.', ['/s/', '/t/', '/ɑ/', '/r/']),
  g('star', 2, 'The star is bright.', ['/s/', '/t/', '/ɑ/', '/r/']),
  g('star', 3, 'The star glows in the sky.', ['/s/', '/t/', '/ɑ/', '/r/']),
  g('star', 4, 'The bright yellow star glows softly in the dark night sky.', ['/s/', '/t/', '/ɑ/', '/r/']),

  // ── lamp (/l/, /æ/, /m/, /p/) ──
  g('lamp', 1, 'Lamp.', ['/l/', '/æ/', '/m/', '/p/']),
  g('lamp', 2, 'The lamp is on.', ['/l/', '/æ/', '/m/', '/p/']),
  g('lamp', 3, 'The lamp sits on the desk.', ['/l/', '/æ/', '/m/', '/p/']),
  g('lamp', 4, 'The small desk lamp gives off a warm yellow light.', ['/l/', '/æ/', '/m/', '/p/']),

  // ── moon (/m/, /u/, /n/) ──
  g('moon', 1, 'Moon.', ['/m/', '/u/', '/n/']),
  g('moon', 2, 'The moon is full.', ['/m/', '/u/', '/n/']),
  g('moon', 3, 'The moon shines over the lake.', ['/m/', '/u/', '/n/']),
  g('moon', 4, 'The bright full moon shines softly over the calm lake.', ['/m/', '/u/', '/n/']),

  // ── leaf (/l/, /i/, /f/) ──
  g('leaf', 1, 'Leaf.', ['/l/', '/i/', '/f/']),
  g('leaf', 2, 'The leaf falls.', ['/l/', '/i/', '/f/']),
  g('leaf', 3, 'The leaf falls from the tree.', ['/l/', '/i/', '/f/']),
  g('leaf', 4, 'The orange leaf falls gently from the tall oak tree.', ['/l/', '/i/', '/f/']),

  // ── cheese (/tʃ/, /i/, /z/) ──
  g('cheese', 1, 'Cheese.', ['/tʃ/', '/i/', '/z/']),
  g('cheese', 2, 'The cheese is fresh.', ['/tʃ/', '/i/', '/z/']),
  g('cheese', 3, 'The cheese sits on the plate.', ['/tʃ/', '/i/', '/z/']),
  g('cheese', 4, 'The fresh yellow cheese sits on the wooden cutting board.', ['/tʃ/', '/i/', '/z/']),

  // ── bridge (/b/, /r/, /ɪ/, /dʒ/) ──
  g('bridge', 1, 'Bridge.', ['/b/', '/r/', '/ɪ/', '/dʒ/']),
  g('bridge', 2, 'The bridge is long.', ['/b/', '/r/', '/ɪ/', '/dʒ/']),
  g('bridge', 3, 'The bridge goes over the river.', ['/b/', '/r/', '/ɪ/', '/dʒ/']),
  g('bridge', 4, 'The old stone bridge stretches over the wide flowing river.', ['/b/', '/r/', '/ɪ/', '/dʒ/']),

  // ── kitchen (/k/, /ɪ/, /tʃ/, /ɪ/, /n/) ──
  g('kitchen', 1, 'Kitchen.', ['/k/', '/ɪ/', '/tʃ/', '/ɪ/', '/n/']),
  g('kitchen', 2, 'The kitchen smells good.', ['/k/', '/ɪ/', '/tʃ/', '/ɪ/', '/n/']),
  g('kitchen', 3, 'The kitchen smells like fresh bread.', ['/k/', '/ɪ/', '/tʃ/', '/ɪ/', '/n/']),
  g('kitchen', 4, 'The warm kitchen smells like fresh bread on a cold morning.', ['/k/', '/ɪ/', '/tʃ/', '/ɪ/', '/n/']),
];

// ─── Query helpers ───────────────────────────────────────────

/** Get all sentences for a specific target word */
export function getGradedSentencesForWord(word: string): GradedSentence[] {
  return GRADED_SENTENCE_BANK.filter(s => s.targetWord === word.toLowerCase());
}

/** Get sentences at a specific difficulty level */
export function getGradedSentencesByLevel(level: 1 | 2 | 3 | 4): GradedSentence[] {
  return GRADED_SENTENCE_BANK.filter(s => s.level === level);
}

/** Get sentences targeting a specific phoneme */
export function getGradedSentencesByPhoneme(phoneme: string): GradedSentence[] {
  return GRADED_SENTENCE_BANK.filter(s => s.phonemeTargets.includes(phoneme));
}

/** Get a sentence for a word at the closest available level */
export function getGradedSentenceAtLevel(word: string, level: 1 | 2 | 3 | 4): GradedSentence | null {
  const wordSentences = getGradedSentencesForWord(word);
  const exact = wordSentences.find(s => s.level === level);
  if (exact) return exact;
  const sorted = [...wordSentences].sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level));
  return sorted[0] || null;
}

/** Get sentence bank statistics */
export function getGradedSentenceBankStats() {
  const words = new Set(GRADED_SENTENCE_BANK.map(s => s.targetWord));
  const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
  const phonemes = new Set<string>();

  for (const sent of GRADED_SENTENCE_BANK) {
    byLevel[sent.level] = (byLevel[sent.level] || 0) + 1;
    for (const ph of sent.phonemeTargets) phonemes.add(ph);
  }

  // Words with full 4-level coverage
  const wordsWithFullCoverage = [...words].filter(w => {
    const levels = GRADED_SENTENCE_BANK.filter(s => s.targetWord === w).map(s => s.level);
    return [1, 2, 3, 4].every(l => levels.includes(l as 1 | 2 | 3 | 4));
  });

  return {
    totalSentences: GRADED_SENTENCE_BANK.length,
    uniqueWords: words.size,
    wordList: [...words],
    byLevel,
    uniquePhonemes: phonemes.size,
    wordsWithFullCoverage: wordsWithFullCoverage.length,
    fullCoveragePercent: Math.round((wordsWithFullCoverage.length / words.size) * 100),
  };
}
