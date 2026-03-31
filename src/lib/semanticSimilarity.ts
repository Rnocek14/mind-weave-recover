/**
 * Semantic Similarity using OpenAI Embeddings
 * Computes cosine similarity between word/phrase embeddings
 */

import { supabase } from '@/integrations/supabase/client';

interface EmbeddingCache {
  [key: string]: number[];
}

// Simple in-memory cache to avoid redundant API calls
const embeddingCache: EmbeddingCache = {};
let embeddingDisabled = false;

/**
 * Get embedding vector for a text using Supabase edge function
 * Uses the supabase client (correct URL + anon key) instead of broken env vars
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  const normalized = text.toLowerCase().trim();
  
  // Check cache first
  if (embeddingCache[normalized]) {
    return embeddingCache[normalized];
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-embedding', {
      body: { text: normalized },
    });

    if (error) {
      console.error('Embedding API error:', error);
      // Disable embeddings for rest of session on quota/billing errors
      if (error?.message?.includes('503') || error?.message?.includes('429') || error?.message?.includes('quota')) {
        embeddingDisabled = true;
        console.warn('Embeddings disabled for this session due to quota limit');
      }
      return null;
    }

    const embedding = data?.embedding;
    if (!embedding) return null;

    // Cache for future use
    embeddingCache[normalized] = embedding;
    return embedding;
  } catch (error) {
    console.error('Error getting embedding:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Rule-based semantic similarity as fallback
 * (Original category-based logic from errorClassifier)
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
    'electronics': ['phone', 'tablet', 'computer', 'watch', 'remote', 'device']
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
    'communication_device': 'electronics'
  };

  const broadCategory = categoryMapping[category] || category;
  const groupForCategory = semanticGroups[broadCategory] || [];

  const word1InGroup = groupForCategory.includes(word1);
  const word2InGroup = groupForCategory.includes(word2);

  if (word1InGroup && word2InGroup) return 0.7;
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
 * Get semantic similarity between two words/phrases
 * Uses OpenAI embeddings with rule-based fallback
 */
export async function getSemanticSimilarity(
  spoken: string,
  target: string,
  category?: string
): Promise<number> {
  const normalized_spoken = spoken.toLowerCase().trim();
  const normalized_target = target.toLowerCase().trim();

  // Identical = perfect similarity
  if (normalized_spoken === normalized_target) {
    return 1.0;
  }

  // Try embeddings-based similarity (skip if previous calls failed)
  if (!embeddingDisabled) {
    try {
      const [spokenEmbed, targetEmbed] = await Promise.all([
        getEmbedding(normalized_spoken),
        getEmbedding(normalized_target),
      ]);

      if (spokenEmbed && targetEmbed) {
        const similarity = cosineSimilarity(spokenEmbed, targetEmbed);
        return Math.max(0, Math.min(1, (similarity + 1) / 2));
      }
    } catch (error) {
      console.warn('Embeddings failed, using rule-based fallback:', error);
    }
  }

  // Fallback to rule-based if embeddings unavailable
  return getRuleBasedSemanticSimilarity(
    normalized_spoken,
    normalized_target,
    category || ''
  );
}
