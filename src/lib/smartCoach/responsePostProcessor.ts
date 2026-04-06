/**
 * Smart Coach — Response Post-Processor
 * 
 * Final cleanup before the user sees/hears the line.
 * Includes anti-repetition guard for Maya's output.
 */

/**
 * Extract content nouns from a line (words 4+ chars, not stop words)
 */
function extractContentNouns(line: string): string[] {
  const STOP = new Set([
    'about', 'after', 'also', 'been', 'before', 'being', 'between', 'both',
    'came', 'come', 'could', 'does', 'done', 'each', 'even', 'every',
    'from', 'going', 'good', 'great', 'have', 'here', 'into', 'just',
    'know', 'like', 'made', 'make', 'more', 'much', 'must', 'nice',
    'only', 'other', 'over', 'said', 'same', 'some', 'such', 'take',
    'tell', 'than', 'that', 'them', 'then', 'there', 'these', 'they',
    'this', 'time', 'very', 'want', 'well', 'were', 'what', 'when',
    'where', 'which', 'will', 'with', 'word', 'work', 'would', 'your',
    'let\'s', 'lets', 'yeah', 'okay', 'sure', 'right', 'sounds',
    'think', 'really', 'maybe', 'something', 'anything',
  ]);
  return line.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP.has(w));
}

/**
 * Check if Maya is over-repeating a noun. Returns the repeated phrase or null.
 */
export function findRepeatedNoun(
  line: string,
  recentMayaNouns: string[]
): string | null {
  const nouns = extractContentNouns(line);
  for (const noun of nouns) {
    const count = recentMayaNouns.filter(n => n === noun).length;
    if (count >= 2) return noun;
  }
  return null;
}

/**
 * Get updated noun tracking array after this line
 */
export function updateMayaNouns(
  line: string,
  recentMayaNouns: string[]
): string[] {
  const nouns = extractContentNouns(line);
  return [...recentMayaNouns, ...nouns].slice(-20);
}

export function postProcessCoachLine(line: string): string {
  let result = line
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove repeated punctuation
    .replace(/\.{2,}/g, '.')
    .replace(/\?{2,}/g, '?')
    .replace(/!{2,}/g, '!')
    // Remove quotes wrapping the whole line (LLM artifact)
    .replace(/^["'](.+)["']$/, '$1')
    // Remove "Maya:" prefix (LLM artifact)
    .replace(/^maya:\s*/i, '')
    // Remove "Coach:" prefix
    .replace(/^coach:\s*/i, '')
    .trim();

  // Tiered length protection:
  // 0–30 words: allow as-is
  // 31–40 words: allow, log warning
  // 41+ words: emergency trim at last sentence boundary
  const words = result.split(/\s+/);
  if (words.length > 40) {
    const truncated = words.slice(0, 38).join(' ');
    const lastPunct = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!')
    );
    result = lastPunct > 10
      ? truncated.slice(0, lastPunct + 1)
      : truncated + '?';
    console.warn(`[PostProcessor] Emergency trim: ${words.length} words → ${result.split(/\s+/).length}`);
  } else if (words.length > 30) {
    console.warn(`[PostProcessor] Long response (${words.length} words), allowing through`);
  }

  return result;
}
