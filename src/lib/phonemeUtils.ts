/**
 * Phoneme-Level Analysis Utilities (v1)
 * 
 * Provides pseudo-phoneme conversion and accuracy scoring for speech analysis.
 * This is a lightweight v1 implementation using grapheme-to-pseudo-phoneme mapping
 * and Levenshtein distance. Can be upgraded to CMU/G2P later without changing callers.
 */

// Common English digraphs and trigraphs treated as single phoneme units
const DIGRAPHS = ['sh', 'ch', 'th', 'ph', 'gh', 'ng', 'wh', 'ck'];

/**
 * Convert a word into pseudo-phoneme sequence
 * Handles common digraphs (sh, ch, th, etc.) as single units
 * Returns array of phoneme-like units for comparison
 */
export function toPseudoPhonemes(word: string): string[] {
  const w = word.toLowerCase().trim();
  const result: string[] = [];
  let i = 0;

  while (i < w.length) {
    // Check for two-character digraphs
    const two = w.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) {
      result.push(two);
      i += 2;
    } else {
      // Single character
      const ch = w[i];
      if (/[a-z]/.test(ch)) {
        result.push(ch);
      }
      i += 1;
    }
  }
  return result;
}

/**
 * Calculate Levenshtein distance between two phoneme sequences
 * Returns minimum number of edits (insertions, deletions, substitutions)
 */
function levenshtein(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate phoneme accuracy between spoken and target words
 * Returns 0-1 score where 1.0 = perfect phoneme match
 * 
 * This is the main entry point for phoneme-level analysis.
 * Uses pseudo-phoneme mapping + Levenshtein distance.
 * 
 * Example:
 *   getPhonemeAccuracy("dok", "dog") → ~0.67 (1 phoneme different)
 *   getPhonemeAccuracy("dawg", "dog") → ~0.75 (2 phonemes different in 4-phoneme word)
 */
export function getPhonemeAccuracy(spoken: string, target: string): number {
  const s = toPseudoPhonemes(spoken);
  const t = toPseudoPhonemes(target);
  
  if (t.length === 0) return 0;
  
  const dist = levenshtein(s, t);
  const longer = Math.max(s.length, t.length);
  
  return Math.max(0, (longer - dist) / longer); // 0–1
}
