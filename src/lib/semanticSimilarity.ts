/**
 * Semantic Similarity using OpenAI Embeddings
 *
 * Computes cosine similarity between word/phrase embeddings.
 *
 * IMPORTANT (signal-quality fix, Apr 2026):
 *   The previous implementation rescaled cosine via `(cos+1)/2`. For
 *   text-embedding-3-small, the raw cosine of two unrelated common English
 *   words is ~0.15–0.40, so the rescale produced ~0.57–0.70 — i.e. nonsense
 *   words landed in "partial credit" territory and even reached "correct"
 *   for loosely related pairs. This polluted the adaptation signal across
 *   FixSentence, DescribeGuess and any scorer that downstream-thresholded
 *   on this number.
 *
 *   We now:
 *     1. Return raw clamped cosine in [0, 1] (no rescale).
 *     2. Apply a lexical guard: if there's no shared substring (≥3 chars)
 *        and no alias overlap, cap returned similarity at 0.45 (forces
 *        "incorrect" regardless of embedding noise).
 *     3. Short-circuit obvious nonsense / non-alphabetic input to 0.
 */

import { supabase } from '@/integrations/supabase/client';

interface EmbeddingCache {
  [key: string]: number[];
}

// Simple in-memory cache to avoid redundant API calls
const embeddingCache: EmbeddingCache = {};
let embeddingDisabled = false;

const NONSENSE_CAP = 0.45;
const FILLER_RE = /^(um+|uh+|er+|ah+|hmm+|huh)\.?$/i;

/**
 * Get embedding vector for a text using Supabase edge function
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  const normalized = text.toLowerCase().trim();
  if (embeddingCache[normalized]) return embeddingCache[normalized];

  try {
    const { data, error } = await supabase.functions.invoke('get-embedding', {
      body: { text: normalized },
    });

    if (error) {
      console.error('Embedding API error:', error);
      embeddingDisabled = true;
      console.warn('Embeddings disabled for this session — falling back to rule-based scoring');
      return null;
    }

    const embedding = data?.embedding;
    if (!embedding) {
      if (data?.fallback) {
        embeddingDisabled = true;
        console.warn('Embeddings disabled for this session — API unavailable');
      }
      return null;
    }

    embeddingCache[normalized] = embedding;
    return embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors. Returns value in [-1, 1].
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na);
  nb = Math.sqrt(nb);
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

/**
 * Lexical overlap heuristic — do the strings share a meaningful substring
 * or token? Used as a guard against embedding noise.
 */
export function hasLexicalOverlap(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[^a-z]/g, '');
  const y = b.toLowerCase().replace(/[^a-z]/g, '');
  if (!x || !y) return false;
  if (x === y) return true;

  // Token overlap (e.g. "ice cream" / "cream")
  const xTokens = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length >= 3));
  const yTokens = b.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
  for (const t of yTokens) if (xTokens.has(t)) return true;

  // Shared substring of length ≥3 (catches morphology: knife/knives, run/running)
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  for (let i = 0; i <= shorter.length - 3; i++) {
    const chunk = shorter.slice(i, i + 3);
    if (longer.includes(chunk)) return true;
  }
  return false;
}

/**
 * Is this input plausible as a real word/phrase answer?
 * Catches "asdfgh", pure punctuation, fillers.
 */
function isPlausibleAnswer(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  if (FILLER_RE.test(t)) return false;
  // Must contain at least 2 alpha characters
  const alpha = t.replace(/[^a-zA-Z]/g, '');
  if (alpha.length < 2) return false;
  // Reject obvious keyboard mashing: no vowels at all in 5+ char strings
  if (alpha.length >= 5 && !/[aeiouy]/i.test(alpha)) return false;
  return true;
}

/**
 * Rule-based semantic similarity as fallback (used when embeddings unavailable)
 */
function getRuleBasedSemanticSimilarity(
  word1: string,
  word2: string,
  category: string
): number {
  const semanticGroups: Record<string, string[]> = {
    'animals': ['dog', 'cat', 'bird', 'fish', 'pet', 'animal', 'puppy', 'kitten',
                'wolf', 'fox', 'eagle', 'robin', 'sparrow', 'crow', 'feline', 'tiger', 'lion'],
    'food': ['apple', 'bread', 'banana', 'fruit', 'vegetable', 'snack', 'orange',
             'pear', 'toast', 'roll', 'bagel', 'bun'],
    'furniture': ['chair', 'table', 'desk', 'sofa', 'bed', 'stool', 'bench', 'couch'],
    'transportation': ['car', 'bike', 'bus', 'train', 'vehicle', 'truck', 'van',
                      'suv', 'sedan', 'cycle', 'scooter', 'moped', 'trike'],
    'body': ['hand', 'eye', 'arm', 'leg', 'foot', 'head', 'wrist', 'finger',
             'palm', 'nose', 'face', 'brow', 'lid'],
    'buildings': ['house', 'building', 'home', 'structure'],
    'kitchenware': ['cup', 'mug', 'glass', 'bowl', 'plate', 'dish'],
    'electronics': ['phone', 'tablet', 'computer', 'watch', 'remote', 'device'],
    'cutlery': ['knife', 'blade', 'cutter', 'fork', 'spoon'],
  };

  const categoryMapping: Record<string, string> = {
    'domestic_animal': 'animals',
    'flying_animal': 'animals',
    'fruit': 'food',
    'baked_good': 'food',
    'seating': 'furniture',
    'vehicle': 'transportation',
    'body_part': 'body',
    'dwelling': 'buildings',
    'drinking_vessel': 'kitchenware',
    'communication_device': 'electronics',
    'cutting_tool': 'cutlery',
  };

  const broadCategory = categoryMapping[category] || category;
  const groupForCategory = semanticGroups[broadCategory] || [];

  const w1In = groupForCategory.includes(word1);
  const w2In = groupForCategory.includes(word2);

  if (w1In && w2In) return 0.7;
  if (word1 === broadCategory || word2 === broadCategory ||
      word1 === category || word2 === category) {
    return 0.6;
  }

  for (const [cat, words] of Object.entries(semanticGroups)) {
    if (words.includes(word1) && words.includes(word2) && cat !== broadCategory) {
      return 0.5;
    }
  }

  return 0.1;
}

/**
 * Get semantic similarity between two words/phrases.
 * Returns a value in [0, 1] where 1 = identical and <0.45 = effectively unrelated.
 */
export async function getSemanticSimilarity(
  spoken: string,
  target: string,
  category?: string
): Promise<number> {
  const ns = spoken.toLowerCase().trim();
  const nt = target.toLowerCase().trim();

  if (ns === nt) return 1.0;

  // Nonsense / filler short-circuit
  if (!isPlausibleAnswer(spoken)) return 0;

  // Compute raw embedding similarity (no rescale)
  let raw: number | null = null;
  if (!embeddingDisabled) {
    try {
      const [se, te] = await Promise.all([getEmbedding(ns), getEmbedding(nt)]);
      if (se && te) {
        const cos = cosineSimilarity(se, te);
        raw = Math.max(0, Math.min(1, cos));
      }
    } catch (error) {
      console.warn('Embeddings failed, using rule-based fallback:', error);
    }
  }

  // Fallback to rule-based if embeddings unavailable
  if (raw === null) {
    raw = getRuleBasedSemanticSimilarity(ns, nt, category || '');
  }

  // Lexical guard: if there's no morphological/token overlap and the embedding
  // score is suspicious-but-not-clearly-correct, cap it. Prevents unrelated
  // English words from drifting into the partial-credit band.
  const overlap = hasLexicalOverlap(spoken, target);
  if (!overlap && raw < 0.78) {
    return Math.min(raw, NONSENSE_CAP);
  }

  return raw;
}
