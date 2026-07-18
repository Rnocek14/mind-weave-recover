/**
 * Answer Matcher — Intelligent answer matching for inline photo naming
 * 
 * Handles real-world aphasia speech patterns:
 * 1. Exact match
 * 2. Semantic synonyms (puppy → dog, mug → cup)
 * 3. Phonetic similarity (Levenshtein distance for "dat" → "cat")
 * 4. Plural/article tolerance ("the dog" → "dog", "cups" → "cup")
 * 5. Circumlocution detection ("the thing you drink from")
 * 6. Partial/fragment matching ("ele...phant" → "elephant")
 */

// ═══════════════════════════════════════════════════════════════
// Synonym map — common semantic substitutions stroke patients make
// ═══════════════════════════════════════════════════════════════

const SYNONYM_MAP: Record<string, string[]> = {
  dish: ['plate', 'platter', 'saucer'],
  plate: ['dish', 'platter', 'saucer'],
  dog: ['puppy', 'doggy', 'doggie', 'pup', 'hound', 'pooch'],
  cat: ['kitty', 'kitten', 'kitty cat'],
  cup: ['mug', 'glass', 'drinking cup'],
  house: ['home', 'building', 'dwelling'],
  car: ['automobile', 'vehicle', 'auto'],
  bird: ['birdie', 'sparrow'],
  flower: ['blossom', 'bloom', 'rose', 'daisy'],
  tree: ['oak', 'pine', 'plant'],
  phone: ['telephone', 'cell phone', 'mobile', 'cellphone'],
  book: ['novel', 'textbook'],
  chair: ['seat', 'stool'],
  bread: ['loaf', 'toast'],
  bike: ['bicycle', 'cycle'],
  ball: ['sphere'],
  door: ['doorway', 'entrance', 'gate'],
  key: ['keys'],
  shoe: ['sneaker', 'boot', 'slipper'],
  spoon: ['ladle', 'scoop'],
  watch: ['clock', 'wristwatch', 'timepiece'],
  cake: ['cupcake', 'pastry'],
  star: ['stars'],
  rain: ['raining', 'rainy'],
  lamp: ['light', 'lantern'],
  ship: ['boat', 'vessel', 'ferry'],
  cheese: ['cheddar'],
  fish: ['fishy', 'goldfish'],
  moon: ['crescent', 'lunar'],
  ring: ['band'],
  hat: ['cap', 'bonnet', 'beanie'],
  nose: ['nostrils'],
  hand: ['palm', 'fist'],
  eye: ['eyes', 'eyeball'],
  apple: ['fruit'],
  leaf: ['leaves'],
  vase: ['pot', 'jar', 'pitcher'],
  vest: ['waistcoat', 'jacket'],
  tooth: ['teeth'],
  frog: ['toad'],
  puppy: ['dog', 'doggy', 'pup'],
  rabbit: ['bunny', 'hare'],
  monkey: ['ape', 'chimp'],
  duck: ['duckling'],
  pig: ['piggy', 'hog'],
  candle: ['candles', 'flame'],
  umbrella: ['parasol', 'brolly'],
  banana: ['fruit'],
  carrot: ['vegetable', 'veggie'],
  coffee: ['espresso', 'latte'],
  towel: ['cloth', 'rag'],
  bridge: ['overpass'],
  button: ['buttons'],
  basket: ['bin', 'container'],
  kitchen: ['cookroom'],
  lemon: ['citrus', 'lime'],
  drum: ['drums'],
  rope: ['cord', 'string'],
  rose: ['flower'],
  pie: ['pastry', 'tart'],
  feather: ['plume', 'quill'],
  pillow: ['cushion'],
  bell: ['bells', 'chime'],
  mirror: ['glass', 'reflection'],
  ladder: ['steps'],
  puzzle: ['jigsaw'],
  net: ['mesh'],
  nut: ['acorn', 'walnut', 'peanut'],
  web: ['cobweb', 'spider web'],
  jar: ['container', 'bottle', 'pot'],
  nail: ['screw', 'tack'],
  finger: ['thumb', 'digit'],
  oven: ['stove', 'microwave'],
  garage: ['carport'],
  birthday: ['party', 'celebration'],
  pigeon: ['dove', 'bird'],
};

// ═══════════════════════════════════════════════════════════════
// Core matching functions
// ═══════════════════════════════════════════════════════════════

/** Levenshtein distance — measures edit distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalized similarity 0-1 (1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Strip articles, pronouns, fillers from speech */
function cleanTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(a |an |the |it's a |it's an |it's |that's a |that's an |that's |this is a |this is an |this is |i see a |i see an |i see |it looks like a |it looks like an |looks like a |looks like an |looks like )/i, '')
    .replace(/[.,!?;:'"]/g, '')
    .trim();
}

/** Strip plural 's' for basic stemming */
function stem(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

// ═══════════════════════════════════════════════════════════════
// Match result types
// ═══════════════════════════════════════════════════════════════

export type MatchType = 
  | 'exact'              // "dog" → "dog"
  | 'synonym'            // "puppy" → "dog"
  | 'phonetic_close'     // "dat" → "cat"
  | 'partial_fragment'   // "ele" → "elephant"
  | 'circumlocution'     // "the thing you drink from" → cup
  | 'no_match';

export interface MatchResult {
  isMatch: boolean;
  matchType: MatchType;
  confidence: number;     // 0-1
  /** What the user was probably trying to say */
  inferredWord: string;
  /** Whether this should count as "correct" for scoring */
  countsAsCorrect: boolean;
  /** Whether this is a word-finding attempt worth acknowledging */
  isWordFindingAttempt: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Main matcher
// ═══════════════════════════════════════════════════════════════

export function matchAnswer(
  transcript: string,
  target: string,
  semanticFoils: string[] = [],
  category?: string,
  phonologicalFoils: string[] = [],
): MatchResult {
  const cleaned = cleanTranscript(transcript);
  const targetLower = target.toLowerCase();
  const targetStem = stem(targetLower);

  // Every known-wrong answer for this trial. A word that IS a foil must never
  // be fuzzy-promoted to correct: "cap" for target "cat" passes the ≤4-char
  // Levenshtein threshold (0.67 ≥ 0.6), which silently defeats minimal-pair
  // and phonological-foil trials. Foils are checked by exact/stem identity
  // BEFORE any similarity-based promotion below.
  const allFoilStems = new Set(
    [...semanticFoils, ...phonologicalFoils].map((f) => stem(f.toLowerCase())),
  );
  const isKnownFoilWord = (w: string): boolean => allFoilStems.has(stem(w));
  
  // Empty or very short
  if (cleaned.length === 0) {
    return { isMatch: false, matchType: 'no_match', confidence: 0, inferredWord: '', countsAsCorrect: false, isWordFindingAttempt: false };
  }
  
  // 1. EXACT MATCH (including stem)
  const cleanedStem = stem(cleaned);
  if (cleaned === targetLower || cleanedStem === targetStem) {
    return { isMatch: true, matchType: 'exact', confidence: 1, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: false };
  }
  
  // Check if any word in the transcript matches (user might say "it's a dog")
  const words = cleaned.split(/\s+/);
  for (const word of words) {
    const wordStem = stem(word);
    if (word === targetLower || wordStem === targetStem) {
      return { isMatch: true, matchType: 'exact', confidence: 0.95, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: false };
    }
  }
  
  // 2. SYNONYM MATCH
  const synonyms = SYNONYM_MAP[targetLower] || [];
  for (const syn of synonyms) {
    if (cleaned === syn || cleanedStem === stem(syn)) {
      return { isMatch: true, matchType: 'synonym', confidence: 0.9, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: false };
    }
    for (const word of words) {
      if (word === syn || stem(word) === stem(syn)) {
        return { isMatch: true, matchType: 'synonym', confidence: 0.85, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: false };
      }
    }
  }
  
  // 3. PHONETIC SIMILARITY (for aphasia speech errors)
  // Check each word the user said against the target. A word that is a known
  // foil is excluded — saying the foil is a scoreable ERROR, not a near-miss.
  for (const word of words) {
    if (isKnownFoilWord(word)) continue;
    const sim = similarity(word, targetLower);
    // High similarity threshold: "dat" vs "cat" = 0.67, "doy" vs "dog" = 0.67
    // For short words (≤4 chars), allow 1 edit; for longer words, proportional
    const threshold = targetLower.length <= 4 ? 0.6 : 0.65;
    if (sim >= threshold && word.length >= 2) {
      return { isMatch: true, matchType: 'phonetic_close', confidence: sim, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: true };
    }
  }

  // 4. PARTIAL FRAGMENT — user started the word but didn't finish
  // "ele" for "elephant", "umb" for "umbrella"
  if (cleaned.length >= 3 && targetLower.startsWith(cleaned) && !isKnownFoilWord(cleaned)) {
    return { isMatch: true, matchType: 'partial_fragment', confidence: 0.7, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: true };
  }
  // User said first 3+ correct chars among their words
  for (const word of words) {
    if (word.length >= 3 && targetLower.startsWith(word) && !isKnownFoilWord(word)) {
      return { isMatch: true, matchType: 'partial_fragment', confidence: 0.65, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: true };
    }
  }
  
  // 5. CIRCUMLOCUTION — user is describing the thing
  // Heuristic: 3+ words that aren't a foil match → likely describing
   if (words.length >= 3) {
    // Make sure they're not saying a foil word (semantic OR phonological)
    const isFoil = words.some(isKnownFoilWord);
    if (!isFoil) {
      // FIX: Circumlocution is a PARTIAL SUCCESS — the user demonstrated word knowledge
      // Scoring it as failure corrupts intelligence reports and difficulty adaptation
      return { isMatch: true, matchType: 'circumlocution', confidence: 0.5, inferredWord: target, countsAsCorrect: true, isWordFindingAttempt: true };
    }
  }
  
  // 6. CHECK FOIL MATCH — user said a related but wrong word
  for (const foil of [...semanticFoils, ...phonologicalFoils]) {
    const foilLower = foil.toLowerCase();
    if (cleaned === foilLower || words.some(w => w === foilLower || stem(w) === stem(foilLower))) {
      return { isMatch: false, matchType: 'no_match', confidence: 0.3, inferredWord: foil, countsAsCorrect: false, isWordFindingAttempt: false };
    }
  }
  
  // No match
  return { isMatch: false, matchType: 'no_match', confidence: 0, inferredWord: '', countsAsCorrect: false, isWordFindingAttempt: words.length >= 2 };
}

/**
 * Generate therapist feedback based on match result
 * This produces context-aware, human-sounding responses
 */
export function getFeedbackForMatch(
  result: MatchResult,
  target: string,
  opts: { wasQuick?: boolean; cueLevel?: number; wasHardBefore?: boolean } = {},
): string {
  const { wasQuick, cueLevel = 0, wasHardBefore } = opts;
  
  // ═══════════════════════════════════════════════════════════════
  // CONFIDENCE-BASED BEHAVIOR
  // High confidence (≥0.85) → confirm naturally, move on
  // Medium confidence (0.5-0.84) → acknowledge + gently correct
  // Low confidence (<0.5) → guide more, reinforce
  // ═══════════════════════════════════════════════════════════════
  
  switch (result.matchType) {
    case 'exact':
      if (wasHardBefore) {
        return pickRandom([
          `"${target}" — you didn't even pause. That used to be harder for you.`,
          `${target}! Remember when that one took a bit? Not anymore.`,
          `Yes, ${target}. You're getting faster with those.`,
        ]);
      }
      if (wasQuick) {
        return pickRandom([
          `Yes, ${target}. That came right out.`,
          `${target} — no hesitation at all.`,
          `Yep! ${target}. Smooth.`,
          `${target}. Easy one for you.`,
        ]);
      }
      if (cueLevel > 0) {
        return pickRandom([
          `${target} — you got there. That's what matters.`,
          `Yes! ${target}. You found it yourself.`,
          `${target}. Took a second, but you knew it.`,
          `There it is — ${target}. You just needed a moment.`,
        ]);
      }
      return pickRandom([
        `Yes, ${target}!`,
        `That's right — ${target}.`,
        `${target}, exactly.`,
      ]);
    
    case 'synonym':
      // High confidence synonym (≥0.85) → treat almost like exact
      if (result.confidence >= 0.85) {
        return pickRandom([
          `Yes — "${target}!" I knew exactly what you meant.`,
          `"${target}" — same thing. You knew it.`,
          `Right! "${target}." You had the right idea.`,
        ]);
      }
      return pickRandom([
        `Close! That's actually called a "${target}" — but I knew what you meant.`,
        `I knew exactly what you meant! The word is "${target}."`,
        `Right idea! The specific word is "${target}."`,
      ]);
    
    case 'phonetic_close':
      // High phonetic confidence (≥0.75) → very encouraging, almost there
      if (result.confidence >= 0.75) {
        return pickRandom([
          `Almost perfect — "${target}!" You practically had it.`,
          `"${target}" — so close! Just one tiny sound off.`,
          `Yes, "${target}." Your mouth almost got there completely.`,
        ]);
      }
      // Medium phonetic confidence → acknowledge effort
      return pickRandom([
        `I could tell you knew it — "${target}." The sounds were almost there.`,
        `"${target}" — you were on the right track with those sounds.`,
        `Almost! You were reaching for "${target}." Keep at it.`,
      ]);
    
    case 'partial_fragment':
      return pickRandom([
        `You started it! "${target}" — you had the beginning.`,
        `Yes — "${target}." You got the first part right.`,
        `"${target}" — you were on your way there.`,
      ]);
    
    case 'circumlocution':
      return pickRandom([
        `You described it perfectly! The word is "${target}."`,
        `I knew exactly what you meant — "${target}."`,
        `Great description! That's "${target}."`,
        `You got the idea across! The word you're looking for is "${target}."`,
      ]);
    
    case 'no_match':
      if (result.inferredWord && result.inferredWord !== target) {
        // User said a foil/related word
        return pickRandom([
          `Not quite — that's close though. It's "${target}."`,
          `I can see why you'd think that! It's actually "${target}."`,
          `Good guess — the word is "${target}."`,
          `Almost! This one is "${target}."`,
        ]);
      }
      return pickRandom([
        `That's a tough one. The word is "${target}."`,
        `No worries — it's "${target}."`,
        `This one is "${target}." We'll come back to it.`,
        `"${target}" — tricky one. Don't worry about it.`,
      ]);
  }
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
