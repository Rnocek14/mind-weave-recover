/**
 * Two Clues Word Association Game - Scoring Engine
 * 
 * Scores user responses against puzzle answer graphs with tiered matching:
 * - Strong (anchors): Best match, full points
 * - Related (cluster): Good match, most points
 * - Creative (near-miss): Interesting connection, some points
 * - Uncertain: No clear match, triggers cueing
 */

import { TwoCluesPuzzle, MatchTier } from '@/data/twoCluesBank';
import { getSemanticSimilarity } from '@/lib/semanticSimilarity';

export interface ScoringResult {
  tier: MatchTier;
  score: number;                    // 100/75/50/25
  reasoning: string;                // Human-readable explanation
  matchedWord?: string;             // Which word from the answer graph matched
  coachResponse?: string;           // Coaching hint for near-misses
  reachedAnchor: boolean;           // Did they hit a top-tier answer?
  semanticSimilarity: number | null; // Always return for telemetry
}

/**
 * Normalize a word for matching (lowercase, trim, remove punctuation)
 */
function normalizeWord(word: string): string {
  return word.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

/**
 * Check if a word matches a target using fuzzy matching.
 * Handles plurals, common ASR errors, and compound words.
 *
 * Compound matching: "sailboat" should match anchor "boat", "lightbulb"
 * should match anchor/cluster "bulb", "snowman" should match "snow".
 * To avoid false positives we require:
 *   - The shorter side is ≥ 4 chars
 *   - The shorter side appears at a word boundary inside the longer side
 *     (i.e. it is a prefix or a suffix of the compound, not embedded mid-word).
 *     "boat" inside "sailboat" → suffix → match.
 *     "boat" inside "boating" → prefix → match.
 *     "boat" inside "aboatx"  → embedded → reject.
 */
function fuzzyMatch(spoken: string, target: string): boolean {
  const s = normalizeWord(spoken);
  const t = normalizeWord(target);

  // Exact match
  if (s === t) return true;

  // Plural handling (basic)
  if (s === t + 's' || s + 's' === t) return true;
  if (s === t + 'es' || s + 'es' === t) return true;

  // Common suffix variations
  if (s.replace(/ing$/, '') === t || t.replace(/ing$/, '') === s) return true;

  // Compound-word matching (boundary-aware)
  const [shorter, longer] = s.length <= t.length ? [s, t] : [t, s];
  if (shorter.length >= 4 && longer.length > shorter.length) {
    if (longer.startsWith(shorter) || longer.endsWith(shorter)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if spoken word matches any word in a list (with aliases)
 */
function matchesListWithAliases(
  spoken: string,
  words: string[],
  aliases?: Record<string, string[]>
): { matched: boolean; matchedWord?: string } {
  const normalized = normalizeWord(spoken);
  
  // Check direct matches
  for (const word of words) {
    if (fuzzyMatch(normalized, word)) {
      return { matched: true, matchedWord: word };
    }
  }
  
  // Check aliases
  if (aliases) {
    for (const [canonical, aliasList] of Object.entries(aliases)) {
      for (const alias of aliasList) {
        if (fuzzyMatch(normalized, alias)) {
          return { matched: true, matchedWord: canonical };
        }
      }
    }
  }
  
  return { matched: false };
}

/**
 * Calculate max semantic similarity against a list of target words
 */
async function getMaxSemanticSimilarity(
  spoken: string,
  targets: string[]
): Promise<number> {
  if (targets.length === 0) return 0;
  
  try {
    const similarities = await Promise.all(
      targets.map(target => getSemanticSimilarity(spoken, target))
    );
    return Math.max(...similarities);
  } catch (error) {
    console.error('[twoCluesScorer] Semantic similarity error:', error);
    return 0;
  }
}

/**
 * Score a user's spoken answer against a puzzle's answer graph
 * 
 * Scoring tiers:
 * - Strong (100pts): Matches an anchor word
 * - Related (75pts): Matches a cluster word OR high semantic similarity to anchors
 * - Creative (50pts): Matches a near-miss OR moderate semantic similarity
 * - Uncertain (25pts): No clear match
 */
export async function scoreAnswer(
  spoken: string,
  puzzle: TwoCluesPuzzle
): Promise<ScoringResult> {
  const normalized = normalizeWord(spoken);
  
  // Empty or very short response
  if (!normalized || normalized.length < 2) {
    return {
      tier: 'uncertain',
      score: 0,
      reasoning: 'No answer detected',
      reachedAnchor: false,
      semanticSimilarity: null,
    };
  }
  
  // TIER 1: Check anchors (top intended answers)
  const anchorMatch = matchesListWithAliases(
    spoken,
    puzzle.anchors,
    puzzle.anchorAliases
  );
  
  if (anchorMatch.matched) {
    return {
      tier: 'strong',
      score: 100,
      reasoning: 'Perfect match!',
      matchedWord: anchorMatch.matchedWord,
      reachedAnchor: true,
      semanticSimilarity: 1.0, // Exact match = max similarity
    };
  }
  
  // TIER 2: Check cluster (acceptable related words)
  const clusterMatch = matchesListWithAliases(
    spoken,
    puzzle.cluster,
    puzzle.clusterAliases
  );
  
  if (clusterMatch.matched) {
    return {
      tier: 'related',
      score: 75,
      reasoning: 'Great related word!',
      matchedWord: clusterMatch.matchedWord,
      reachedAnchor: false,
      semanticSimilarity: 0.85, // High similarity for cluster match
    };
  }
  
  // TIER 3: Check near-misses (with coach hints)
  for (const nearMiss of puzzle.nearMisses) {
    if (fuzzyMatch(normalized, nearMiss)) {
      const coachHint = puzzle.coachHints[nearMiss] || 
        "Good thinking! Try another angle.";
      return {
        tier: 'creative',
        score: 50,
        reasoning: 'Creative connection!',
        matchedWord: nearMiss,
        coachResponse: coachHint,
        reachedAnchor: false,
        semanticSimilarity: 0.6, // Moderate similarity for near-miss
      };
    }
  }
  
  // TIER 4: Use semantic embeddings for unknown answers
  const maxSimilarity = await getMaxSemanticSimilarity(normalized, puzzle.anchors);
  
  if (maxSimilarity > 0.7) {
    return {
      tier: 'related',
      score: 75,
      reasoning: 'Semantically close!',
      reachedAnchor: false,
      semanticSimilarity: maxSimilarity,
    };
  }
  
  if (maxSimilarity > 0.5) {
    return {
      tier: 'creative',
      score: 50,
      reasoning: 'Interesting connection',
      coachResponse: "That's related! Can you think of the main word?",
      reachedAnchor: false,
      semanticSimilarity: maxSimilarity,
    };
  }
  
  // TIER 5: Uncertain - don't punish, offer help
  return {
    tier: 'uncertain',
    score: 25,
    reasoning: "Let me help you...",
    reachedAnchor: false,
    semanticSimilarity: maxSimilarity,
  };
}

/**
 * Get color class for a match tier
 */
export function getTierColor(tier: MatchTier): string {
  switch (tier) {
    case 'strong':
      return 'text-green-600 dark:text-green-400';
    case 'related':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'creative':
      return 'text-blue-600 dark:text-blue-400';
    case 'uncertain':
      return 'text-muted-foreground';
  }
}

/**
 * Get background color for a match tier
 */
export function getTierBgColor(tier: MatchTier): string {
  switch (tier) {
    case 'strong':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'related':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'creative':
      return 'bg-blue-100 dark:bg-blue-900/30';
    case 'uncertain':
      return 'bg-muted/50';
  }
}

/**
 * Get emoji for a match tier
 */
export function getTierEmoji(tier: MatchTier): string {
  switch (tier) {
    case 'strong':
      return '✅';
    case 'related':
      return '🟨';
    case 'creative':
      return '🟦';
    case 'uncertain':
      return '⚪';
  }
}

/**
 * Get encouraging message for a tier
 */
export function getTierMessage(tier: MatchTier, matchedWord?: string): string {
  switch (tier) {
    case 'strong':
      return matchedWord ? `Perfect! "${matchedWord}" is exactly right!` : 'Perfect match!';
    case 'related':
      return matchedWord ? `Nice! "${matchedWord}" is a great related word!` : 'Great connection!';
    case 'creative':
      return matchedWord ? `Interesting! "${matchedWord}" is creative thinking.` : 'Creative connection!';
    case 'uncertain':
      return "Let me help you find the word...";
  }
}
