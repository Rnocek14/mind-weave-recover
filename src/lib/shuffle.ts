/**
 * Fisher-Yates shuffle algorithm for unbiased randomization
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick n random items from array without replacement
 */
export function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
