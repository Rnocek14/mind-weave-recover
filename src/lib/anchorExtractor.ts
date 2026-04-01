/**
 * Anchor Extraction — extracts salient tokens from user speech
 * for mandatory context anchoring in Maya's responses.
 * 
 * Priority: corrected targets > people > places > objects > emotions > topics
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type AnchorType = 'target_word' | 'person' | 'place' | 'object' | 'emotion' | 'topic';

export interface AnchorCandidate {
  text: string;
  type: AnchorType;
  salience: number;
}

export interface AnchorContext {
  candidateAnchors: string[];
  preferredAnchor: string | null;
  anchorRequired: boolean;
}

export interface AnchorMetrics {
  candidateAnchors: string[];
  preferredAnchor: string | null;
  anchorRequired: boolean;
  anchorUsed: boolean;
  matchedAnchor: string | null;
  regenerationNeeded: boolean;
  anchoringPass: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Stop words — filtered from anchor candidates
// ═══════════════════════════════════════════════════════════════

const STOP = new Set([
  'i', 'me', 'my', 'you', 'we', 'he', 'she', 'they', 'it', 'its',
  'a', 'an', 'the', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may',
  'not', 'so', 'if', 'then', 'than', 'that', 'this', 'with', 'from', 'by',
  'um', 'uh', 'mm', 'hmm', 'yeah', 'yes', 'no', 'okay', 'ok', 'oh', 'ah',
  'thing', 'stuff', 'something', 'anything', 'like', 'just', 'really',
  'very', 'also', 'too', 'got', 'get', 'went', 'going', 'go', 'come',
  'came', 'said', 'say', 'know', 'think', 'want', 'need', 'see', 'saw',
  'made', 'make', 'take', 'took', 'put', 'give', 'gave', 'tell', 'told',
  'right', 'well', 'about', 'there', 'here', 'now', 'some', 'all',
]);

// ═══════════════════════════════════════════════════════════════
// Known word categories for salience boosting
// ═══════════════════════════════════════════════════════════════

const PEOPLE_WORDS = new Set([
  'wife', 'husband', 'daughter', 'son', 'mom', 'mother', 'dad', 'father',
  'grandma', 'grandpa', 'grandmother', 'grandfather', 'grandkid', 'grandkids',
  'granddaughter', 'grandson', 'baby', 'child', 'children', 'kid', 'kids',
  'brother', 'sister', 'uncle', 'aunt', 'cousin', 'friend', 'neighbor',
  'doctor', 'nurse', 'therapist', 'teacher', 'boss', 'coworker',
]);

const PLACE_WORDS = new Set([
  'park', 'store', 'grocery', 'beach', 'hospital', 'home', 'house',
  'zoo', 'playground', 'school', 'church', 'restaurant', 'gym',
  'garden', 'yard', 'kitchen', 'bedroom', 'bathroom', 'pool',
  'library', 'mall', 'market', 'office', 'clinic', 'pharmacy',
]);

const OBJECT_WORDS = new Set([
  'dog', 'cat', 'bird', 'fish', 'coffee', 'tea', 'cake', 'bread',
  'milk', 'eggs', 'chicken', 'soup', 'pizza', 'sandwich', 'fruit',
  'bench', 'bike', 'bicycle', 'car', 'van', 'bus', 'phone',
  'book', 'chair', 'table', 'bed', 'couch', 'tv', 'computer',
  'cane', 'walker', 'wheelchair', 'glasses', 'shoes', 'hat',
  'popsicle', 'strawberry', 'strawberries', 'orange', 'oranges',
  'broccoli', 'spinach', 'salad', 'rice', 'pasta', 'water',
  'chocolate', 'vanilla', 'ice', 'cream', 'swing', 'swings',
  'slide', 'duck', 'ducks', 'pond', 'ball', 'flowers', 'tree',
]);

const EMOTION_WORDS = new Set([
  'tired', 'frustrated', 'happy', 'sad', 'angry', 'scared', 'worried',
  'excited', 'proud', 'lonely', 'confused', 'hurt', 'pain', 'stress',
  'stressed', 'anxious', 'nervous', 'bored', 'annoyed', 'grateful',
]);

// ═══════════════════════════════════════════════════════════════
// Extractor
// ═══════════════════════════════════════════════════════════════

export function extractAnchorCandidates(
  userText: string,
  options?: {
    circumlocutionDetected?: boolean;
    completionConfidence?: 'low' | 'medium' | 'high';
    /** Words from prior turns that were recovered/corrected */
    recentTargetWords?: string[];
  }
): AnchorCandidate[] {
  if (!userText || userText.trim().length === 0) return [];

  const cleaned = userText
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  // Count token frequency
  const counts = new Map<string, number>();
  for (const token of cleaned) {
    if (STOP.has(token)) continue;
    if (token.length < 3) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const candidates: AnchorCandidate[] = [];

  for (const [text, count] of counts.entries()) {
    let type: AnchorType = 'topic';
    let salience = count;

    // Check if this is a recently recovered target word (highest priority)
    if (options?.recentTargetWords?.includes(text)) {
      type = 'target_word';
      salience += 10;
    } else if (PEOPLE_WORDS.has(text)) {
      type = 'person';
      salience += 5;
    } else if (PLACE_WORDS.has(text)) {
      type = 'place';
      salience += 4;
    } else if (OBJECT_WORDS.has(text)) {
      type = 'object';
      salience += 4;
    } else if (EMOTION_WORDS.has(text)) {
      type = 'emotion';
      salience += 3;
    }

    // Boost capitalized words (likely proper nouns) — check original text
    const originalIdx = cleaned.indexOf(text);
    if (originalIdx >= 0) {
      const originalWord = userText.split(/\s+/)[originalIdx];
      if (originalWord && /^[A-Z]/.test(originalWord) && originalIdx > 0) {
        salience += 3; // Likely a name
        if (type === 'topic') type = 'person';
      }
    }

    candidates.push({ text, type, salience });
  }

  return candidates
    .sort((a, b) => b.salience - a.salience)
    .slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// Context builder — creates the payload for the edge function
// ═══════════════════════════════════════════════════════════════

export function buildAnchorContext(
  userText: string,
  options?: {
    circumlocutionDetected?: boolean;
    completionConfidence?: 'low' | 'medium' | 'high';
    recentTargetWords?: string[];
  }
): AnchorContext {
  const candidates = extractAnchorCandidates(userText, options);

  if (candidates.length === 0) {
    return {
      candidateAnchors: [],
      preferredAnchor: null,
      anchorRequired: false,
    };
  }

  // Don't require anchoring for low-confidence ASR
  const anchorRequired = options?.completionConfidence !== 'low' && candidates.length > 0;

  return {
    candidateAnchors: candidates.map(c => c.text),
    preferredAnchor: candidates[0]?.text || null,
    anchorRequired,
  };
}

// ═══════════════════════════════════════════════════════════════
// Post-generation validator
// ═══════════════════════════════════════════════════════════════

export function validateAnchoring(
  reply: string,
  anchors: string[]
): { passed: boolean; matchedAnchor: string | null } {
  if (anchors.length === 0) return { passed: true, matchedAnchor: null };

  const lower = reply.toLowerCase();

  for (const anchor of anchors) {
    if (lower.includes(anchor.toLowerCase())) {
      return { passed: true, matchedAnchor: anchor };
    }
  }

  return { passed: false, matchedAnchor: null };
}
