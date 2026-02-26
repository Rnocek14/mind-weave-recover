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
 */

/** Stop words to exclude when deriving key concepts */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that',
  'he', 'she', 'they', 'his', 'her', 'him', 'them', 'and', 'or',
  'but', 'not', 'so', 'if', 'as', 'up', 'out', 'no', 'yes',
]);

export interface ExplanationScore {
  /** 0-100 overall score */
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

/**
 * Score a user's explanation against expected key concepts.
 * 
 * @param transcript - User's spoken explanation (lowercase, trimmed)
 * @param keyConcepts - Array of key words/phrases expected in a good explanation
 * @param correctAnswer - The correct MC option text (for on-topic check)
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
  
  // Check which key concepts appear in transcript
  const matchedConcepts = keyConcepts.filter(concept => {
    const normalizedConcept = concept.toLowerCase();
    // Check for exact word/phrase match or close substring
    return normalizedTranscript.includes(normalizedConcept);
  });

  const conceptsFound = matchedConcepts.length;
  const conceptsTotal = keyConcepts.length;
  
  // Calculate concept coverage ratio
  const coverageRatio = conceptsTotal > 0 ? conceptsFound / conceptsTotal : 0;
  
  // On-topic check: does it mention any words from the correct answer?
  const correctWords = correctAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const onTopic = correctWords.some(w => normalizedTranscript.includes(w)) || conceptsFound > 0;
  
  // Word count check (very short responses get partial credit at best)
  const wordCount = normalizedTranscript.split(/\s+/).length;
  const hasSubstance = wordCount >= 3;

  // Scoring logic
  let score: number;
  let level: ExplanationScore['level'];
  let feedback: string;

  if (!onTopic && conceptsFound === 0) {
    score = 15;
    level = 'off-topic';
    feedback = "Good try! The key idea was about something different — let's look at why.";
  } else if (coverageRatio >= 0.6 && hasSubstance) {
    score = 100;
    level = 'excellent';
    feedback = "Excellent reasoning! You explained that really well. 🧠";
  } else if (coverageRatio >= 0.3 || (conceptsFound >= 1 && hasSubstance)) {
    score = 75;
    level = 'good';
    feedback = "Good thinking! You got the key idea. 👍";
  } else if (onTopic || conceptsFound >= 1) {
    score = 50;
    level = 'partial';
    feedback = "You're on the right track! Let's see the full explanation.";
  } else {
    score = 25;
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
 * Extracts meaningful words (>3 chars, not stop words) from the explanation text,
 * combined with explicit keywords if provided.
 */
export function deriveKeyConcepts(
  explanation: string,
  keywords?: string[],
  keyConcepts?: string[]
): string[] {
  // If explicit keyConcepts provided, use them
  if (keyConcepts && keyConcepts.length > 0) return keyConcepts;
  
  const concepts = new Set<string>();
  
  // Add keywords
  if (keywords) {
    keywords.forEach(k => concepts.add(k.toLowerCase()));
  }
  
  // Extract meaningful words from explanation
  const words = explanation.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  words.forEach(w => {
    if (w.length > 3 && !STOP_WORDS.has(w)) {
      concepts.add(w);
    }
  });
  
  return Array.from(concepts).slice(0, 5); // Cap at 5 concepts
}
