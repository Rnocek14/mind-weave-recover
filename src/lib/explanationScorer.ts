/**
 * Explanation Scorer
 * 
 * Scores a user's verbal explanation of WHY a comprehension answer is correct.
 * Designed for stroke survivors: lenient on grammar, strict on concept presence.
 * 
 * Scoring rubric:
 * - On-topic: does the explanation relate to the correct answer? (not random/off-topic)
 * - Key concepts: how many expected concepts appear in the transcript?
 * - No grammar penalty
 * 
 * Matching uses stemming + synonym expansion + Jaccard token overlap
 * to handle paraphrases, circumlocutions, and ASR noise.
 */

/** Stop words to exclude when deriving key concepts */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that',
  'he', 'she', 'they', 'his', 'her', 'him', 'them', 'and', 'or',
  'but', 'not', 'so', 'if', 'as', 'up', 'out', 'no', 'yes',
  'because', 'then', 'also', 'just', 'about', 'like', 'very',
  'really', 'what', 'when', 'where', 'which', 'who', 'how',
  'there', 'here', 'than', 'been', 'some', 'any', 'each',
  'means', 'happens', 'thing', 'something', 'everything',
]);

/** Junk words that appear in explanations but don't discriminate */
const DERIVATION_JUNK = new Set([
  ...STOP_WORDS,
  'says', 'said', 'tells', 'told', 'shows', 'shown',
  'sentence', 'answer', 'correct', 'right', 'wrong',
  'story', 'text', 'question', 'option', 'meaning',
  'because', 'since', 'therefore', 'basically',
]);

export interface ExplanationScore {
  /** 0-20 bonus points (clinically calibrated) */
  score: number;
  /** How many key concepts were mentioned */
  conceptsFound: number;
  /** Total key concepts expected */
  conceptsTotal: number;
  /** Which concepts were detected */
  matchedConcepts: string[];
  /** Feedback level for UI */
  level: 'excellent' | 'good' | 'partial' | 'off-topic' | 'no-response';
  /** Short feedback message */
  feedback: string;
}

export interface ExplanationResultData {
  transcript: string;
  level: ExplanationScore['level'];
  score: number;
  conceptsFound: number;
  conceptsTotal: number;
  matchedConcepts: string[];
  durationMs: number;
  skipped: boolean;
}

// ─── Simple Porter-style stemmer (covers common English suffixes) ───

function stem(word: string): string {
  let w = word.toLowerCase();
  // Common suffixes, ordered longest-first
  const suffixes = [
    'fulness', 'lessly', 'iously', 'ation', 'ement', 'iness',
    'ously', 'ness', 'ment', 'able', 'ible', 'ting',
    'ally', 'ful', 'ous', 'ive', 'ize', 'ise',
    'ing', 'ied', 'ies', 'ers', 'est', 'ely',
    'ion', 'ly', 'ed', 'er', 'es', 's',
  ];
  for (const suffix of suffixes) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

/** Tokenize + stem a text string */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function stemTokens(text: string): Set<string> {
  return new Set(tokenize(text).map(stem));
}

// ─── Synonym expansion (cheap, no API needed) ───

const SYNONYM_MAP: Record<string, string[]> = {
  'cold': ['freezing', 'chilly', 'cool', 'frigid'],
  'hot': ['warm', 'heated', 'boiling', 'burning'],
  'happy': ['glad', 'pleased', 'joyful', 'delighted', 'excited', 'thrilled'],
  'sad': ['unhappy', 'upset', 'down', 'depressed', 'gloomy'],
  'angry': ['mad', 'furious', 'annoyed', 'irritated', 'upset'],
  'tired': ['exhausted', 'fatigued', 'weary', 'worn', 'drained'],
  'scared': ['afraid', 'frightened', 'terrified', 'nervous', 'anxious'],
  'fast': ['quick', 'rapid', 'speedy', 'swift'],
  'slow': ['sluggish', 'gradual', 'unhurried', 'delayed'],
  'big': ['large', 'huge', 'enormous', 'massive', 'giant'],
  'small': ['tiny', 'little', 'mini', 'compact'],
  'loud': ['noisy', 'booming', 'blaring'],
  'quiet': ['silent', 'soft', 'hushed', 'calm', 'still'],
  'answer': ['respond', 'reply', 'pick', 'chose'],
  'wait': ['stayed', 'remained', 'delayed', 'paused'],
  'stop': ['halt', 'ceased', 'ended', 'quit', 'paused'],
  'start': ['begin', 'began', 'commenced', 'initiated'],
  'gave': ['returned', 'handed', 'provided', 'offered'],
  'calm': ['relaxed', 'peaceful', 'composed', 'cool', 'steady'],
  'fix': ['repair', 'mend', 'solve', 'resolved', 'corrected'],
  'break': ['shatter', 'crack', 'damage', 'destroy'],
  'understand': ['comprehend', 'grasp', 'follow', 'get'],
  'agree': ['concur', 'align', 'match', 'share'],
  'avoid': ['prevent', 'dodge', 'evade', 'skip'],
  'learn': ['master', 'grasp', 'study', 'absorb'],
  'rain': ['raining', 'rained', 'rainy', 'wet', 'storm'],
  'coat': ['jacket', 'parka', 'hoodie', 'sweater'],
  'walk': ['walked', 'walking', 'stroll', 'hike'],
};

/** Get all synonym stems for a word */
function getSynonymStems(word: string): Set<string> {
  const w = word.toLowerCase();
  const stems = new Set<string>([stem(w)]);
  
  // Check if word or its stem appears in synonym map
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    const keyStem = stem(key);
    if (stem(w) === keyStem || synonyms.some(s => stem(s) === stem(w))) {
      stems.add(keyStem);
      synonyms.forEach(s => stems.add(stem(s)));
    }
  }
  return stems;
}

// ─── Concept matching ───

/**
 * Check if a concept (word or phrase) matches in the transcript.
 * Uses stemmed token matching + synonym expansion.
 */
function conceptMatches(concept: string, transcriptStems: Set<string>, transcriptTokens: string[]): boolean {
  const conceptTokens = tokenize(concept);
  
  // Single-word concept: stem match or synonym match
  if (conceptTokens.length === 1) {
    const synonymStems = getSynonymStems(conceptTokens[0]);
    return [...synonymStems].some(s => transcriptStems.has(s));
  }
  
  // Multi-word phrase: check if stemmed tokens appear in sequence or all present
  const conceptStems = conceptTokens.map(stem);
  const allPresent = conceptStems.every(cs => transcriptStems.has(cs));
  if (allPresent) return true;
  
  // Check with synonyms for each concept token
  const matchCount = conceptStems.filter(cs => {
    if (transcriptStems.has(cs)) return true;
    // Try synonyms
    const original = conceptTokens.find(t => stem(t) === cs);
    if (original) {
      const syns = getSynonymStems(original);
      return [...syns].some(s => transcriptStems.has(s));
    }
    return false;
  }).length;
  
  return matchCount >= Math.ceil(conceptStems.length * 0.6);
}

/**
 * Jaccard similarity between transcript and correct answer tokens.
 * Used for on-topic detection.
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Score a user's explanation against expected key concepts.
 * 
 * Uses stemming + synonym expansion + Jaccard overlap for fair matching.
 * Points are clinically calibrated (0-20 bonus range).
 */
export function scoreExplanation(
  transcript: string,
  keyConcepts: string[],
  correctAnswer: string
): ExplanationScore {
  // No response
  if (!transcript || transcript.trim().length < 2) {
    return {
      score: 0,
      conceptsFound: 0,
      conceptsTotal: keyConcepts.length,
      matchedConcepts: [],
      level: 'no-response',
      feedback: "That's okay — try explaining in your own words next time!",
    };
  }

  const normalizedTranscript = transcript.toLowerCase().trim();
  const transcriptTokens = tokenize(normalizedTranscript);
  const transcriptStems = stemTokens(normalizedTranscript);
  
  // Check which key concepts appear in transcript (with stemming + synonyms)
  const matchedConcepts = keyConcepts.filter(concept =>
    conceptMatches(concept, transcriptStems, transcriptTokens)
  );

  const conceptsFound = matchedConcepts.length;
  const conceptsTotal = keyConcepts.length;
  
  // Calculate concept coverage ratio
  const coverageRatio = conceptsTotal > 0 ? conceptsFound / conceptsTotal : 0;
  
  // On-topic check using Jaccard similarity on stemmed tokens
  const correctStems = stemTokens(correctAnswer);
  const jaccard = jaccardSimilarity(transcriptStems, correctStems);
  const onTopic = jaccard > 0.1 || conceptsFound > 0;
  
  // Word count check (very short responses get partial credit at best)
  const wordCount = transcriptTokens.length;
  const hasSubstance = wordCount >= 3;

  // Scoring logic — clinically calibrated bonus points (0-20)
  let score: number;
  let level: ExplanationScore['level'];
  let feedback: string;

  if (!onTopic && conceptsFound === 0) {
    score = 0;
    level = 'off-topic';
    feedback = "Good try! The key idea was about something different — let's look at why.";
  } else if (coverageRatio >= 0.6 && hasSubstance) {
    score = 20;
    level = 'excellent';
    feedback = "Excellent reasoning! You explained that really well. 🧠";
  } else if (coverageRatio >= 0.3 || (conceptsFound >= 1 && hasSubstance)) {
    score = 12;
    level = 'good';
    feedback = "Good thinking! You got the key idea. 👍";
  } else if (onTopic || conceptsFound >= 1) {
    score = 5;
    level = 'partial';
    feedback = "You're on the right track! Let's see the full explanation.";
  } else {
    score = 0;
    level = 'off-topic';
    feedback = "That's okay — explaining takes practice. Here's the key idea:";
  }

  return {
    score,
    conceptsFound,
    conceptsTotal,
    matchedConcepts,
    level,
    feedback,
  };
}

/**
 * Derive key concepts from existing item data (keywords + explanation).
 * 
 * Priority: explicit keyConcepts > curated keywords > extracted from explanation.
 * From explanation, only allows words that also appear in the correct answer or question
 * to prevent junk derivation. Capped at 3 discriminators.
 */
export function deriveKeyConcepts(
  explanation: string,
  keywords?: string[],
  keyConcepts?: string[],
  correctAnswer?: string,
): string[] {
  // If explicit keyConcepts provided, use them
  if (keyConcepts && keyConcepts.length > 0) return keyConcepts;
  
  const concepts = new Set<string>();
  
  // Priority 1: curated keywords (always best)
  if (keywords && keywords.length > 0) {
    keywords.forEach(k => concepts.add(k.toLowerCase()));
  }
  
  // Priority 2: extract discriminating words from explanation
  // Only allow words that are NOT junk and ideally overlap with the correct answer
  const explanationWords = tokenize(explanation);
  const correctStems = correctAnswer ? stemTokens(correctAnswer) : new Set<string>();
  
  for (const w of explanationWords) {
    if (w.length <= 3) continue;
    if (DERIVATION_JUNK.has(w)) continue;
    // Prefer words that also appear (stemmed) in the correct answer
    if (correctStems.size > 0 && correctStems.has(stem(w))) {
      concepts.add(w);
    } else if (concepts.size < 2) {
      // Allow a couple non-overlapping words if we don't have enough
      concepts.add(w);
    }
  }
  
  // Cap at 3 discriminators (not 5) to avoid junk inflation
  return Array.from(concepts).slice(0, 3);
}
