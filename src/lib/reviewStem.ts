/**
 * Minimal English stemmer for review-conversation word detection.
 * Deliberately conservative: strips plural/progressive/past suffixes only,
 * so "gardens"/"gardening" match "garden" but "garden" never matches "car".
 */
export function stemWord(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) {
    w = w.slice(0, -3);
    // doubled consonant: "running" → "run"
    if (w.length > 2 && w[w.length - 1] === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
